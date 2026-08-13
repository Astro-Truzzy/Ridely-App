import { useState, useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { uploadChatImage, getChatImageSignedUrl } from '@/lib/chatAttachmentUpload';
import { withRetry } from '@/lib/retry';

export interface ChatMessage {
  id: string;
  delivery_id: string;
  sender_id: string;
  sender_type: 'user' | 'rider';
  content: string | null;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
  /** Resolved signed URL for image messages (client-side only). */
  imageUrl?: string | null;
  /** Local-only flag while an optimistic message is in flight. */
  pending?: boolean;
  /** Local-only flag when a send failed. */
  failed?: boolean;
}

const TYPING_IDLE_MS = 3500;
const TYPING_THROTTLE_MS = 1500;

export function useDeliveryChat(deliveryId: string | null) {
  const { user, userType } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const mountedRef = useRef(true);

  const senderType: 'user' | 'rider' = userType === 'rider' ? 'rider' : 'user';

  const resolveImageUrl = useCallback(async (msg: ChatMessage): Promise<ChatMessage> => {
    if (!msg.image_path) return msg;
    const url = await getChatImageSignedUrl(msg.image_path);
    return { ...msg, imageUrl: url };
  }, []);

  // Initial fetch + realtime inserts/updates for this thread.
  useEffect(() => {
    mountedRef.current = true;
    if (!deliveryId || !user?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    (async () => {
      try {
        const data = await withRetry(async () => {
          const { data, error } = await (supabase as any)
            .from('delivery_messages')
            .select('*')
            .eq('delivery_id', deliveryId)
            .order('created_at', { ascending: true });
          if (error) throw error;
          return (data ?? []) as ChatMessage[];
        });
        const resolved = await Promise.all(data.map(resolveImageUrl));
        if (mountedRef.current) setMessages(resolved);
      } catch (e) {
        console.error('Error loading chat messages:', e);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    const messagesChannel = supabase
      .channel(`chat-messages-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_messages',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        async (payload: { new: ChatMessage }) => {
          const incoming = await resolveImageUrl(payload.new);
          if (!mountedRef.current) return;
          // The other side stopped typing the moment their message arrives.
          if (incoming.sender_id !== user.id) setPeerTyping(false);
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) {
              return prev.map((m) => (m.id === incoming.id ? { ...incoming, imageUrl: m.imageUrl ?? incoming.imageUrl } : m));
            }
            return [...prev, incoming];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_messages',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload: { new: ChatMessage }) => {
          if (!mountedRef.current) return;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m
            )
          );
        }
      )
      .subscribe();

    // Ephemeral typing indicator over broadcast (never touches the DB).
    const typingChannel = supabase
      .channel(`chat-typing-${deliveryId}`)
      .on('broadcast', { event: 'typing' }, (payload: { payload?: { senderId?: string } }) => {
        if (!mountedRef.current) return;
        if (payload.payload?.senderId === user.id) return;
        setPeerTyping(true);
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        peerTypingTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setPeerTyping(false);
        }, TYPING_IDLE_MS);
      })
      .on('broadcast', { event: 'stop_typing' }, (payload: { payload?: { senderId?: string } }) => {
        if (!mountedRef.current) return;
        if (payload.payload?.senderId === user.id) return;
        setPeerTyping(false);
      })
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      mountedRef.current = false;
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      typingChannelRef.current = null;
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [deliveryId, user?.id, resolveImageUrl]);

  /** Call on every keystroke; throttled broadcast so the peer sees "typing…". */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { senderId: user?.id },
    });
  }, [user?.id]);

  const notifyStopTyping = useCallback(() => {
    lastTypingSentRef.current = 0;
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { senderId: user?.id },
    });
  }, [user?.id]);

  const insertMessage = useCallback(
    async (fields: { content?: string | null; image_path?: string | null; imageUrl?: string | null }) => {
      if (!deliveryId || !user?.id) throw new Error('Chat not ready');

      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        delivery_id: deliveryId,
        sender_id: user.id,
        sender_type: senderType,
        content: fields.content ?? null,
        image_path: fields.image_path ?? null,
        imageUrl: fields.imageUrl ?? null,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const { data, error } = await (supabase as any)
          .from('delivery_messages')
          .insert({
            delivery_id: deliveryId,
            sender_id: user.id,
            sender_type: senderType,
            content: fields.content ?? null,
            image_path: fields.image_path ?? null,
          })
          .select()
          .single();
        if (error) throw error;

        const saved = data as ChatMessage;
        setMessages((prev) => {
          // Realtime may have already delivered the row; drop the temp either way.
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
          return [...withoutTemp, { ...saved, imageUrl: fields.imageUrl ?? null }];
        });
      } catch (e) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
        );
        throw e;
      }
    },
    [deliveryId, user?.id, senderType]
  );

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setSending(true);
      try {
        notifyStopTyping();
        await insertMessage({ content: trimmed });
      } finally {
        setSending(false);
      }
    },
    [insertMessage, notifyStopTyping]
  );

  const sendImage = useCallback(
    async (picked: { uri: string; mimeType?: string }) => {
      if (!deliveryId) return;
      setSending(true);
      try {
        const path = await uploadChatImage(deliveryId, picked);
        const url = await getChatImageSignedUrl(path);
        await insertMessage({ image_path: path, imageUrl: url ?? picked.uri });
      } finally {
        setSending(false);
      }
    },
    [deliveryId, insertMessage]
  );

  const retryMessage = useCallback(
    async (message: ChatMessage) => {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      if (message.content) await sendText(message.content);
    },
    [sendText]
  );

  /** Mark all messages from the other participant as read. */
  const markThreadRead = useCallback(async () => {
    if (!deliveryId || !user?.id) return;
    try {
      await (supabase as any)
        .from('delivery_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('delivery_id', deliveryId)
        .neq('sender_id', user.id)
        .is('read_at', null);
    } catch {}
  }, [deliveryId, user?.id]);

  // Mark incoming messages read while the thread is open.
  useEffect(() => {
    if (loading || !messages.length) return;
    const hasUnreadIncoming = messages.some(
      (m) => m.sender_id !== user?.id && !m.read_at && !m.pending
    );
    if (hasUnreadIncoming) markThreadRead();
  }, [messages, loading, user?.id, markThreadRead]);

  return {
    messages,
    loading,
    sending,
    peerTyping,
    sendText,
    sendImage,
    retryMessage,
    notifyTyping,
    notifyStopTyping,
  };
}
