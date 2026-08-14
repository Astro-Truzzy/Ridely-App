import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Keyboard,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert, type AlertButton } from '@/contexts/AlertContext';
import { useVoiceCall } from '@/contexts/VoiceCallContext';
import { useDeliveryChat, type ChatMessage } from '@/hooks/useDeliveryChat';
import { pickChatImage, type PickSource } from '@/lib/chatAttachmentUpload';
import { supabase } from '@/lib/supabase';
import { tapLight, notifyError } from '@/lib/haptics';
import {
  ArrowLeft,
  Plus,
  ArrowUp,
  Phone,
  Camera,
  ImageIcon,
  X,
} from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';

interface PeerInfo {
  name: string;
  phone: string | null;
  subtitle: string;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user, userType } = useAuth();
  const { showAlert } = useAlert();
  const {
    startCall,
    phase: callPhase,
    deliveryId: callDeliveryId,
  } = useVoiceCall();
  const params = useLocalSearchParams<{
    deliveryId?: string;
    peerName?: string;
    peerPhone?: string;
  }>();
  const deliveryId = params.deliveryId ?? null;

  const {
    messages,
    loading,
    sending,
    peerTyping,
    peerCallPhase,
    sendText,
    sendImage,
    retryMessage,
    notifyTyping,
    notifyStopTyping,
  } = useDeliveryChat(deliveryId);

  const [inputText, setInputText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [peer, setPeer] = useState<PeerInfo>({
    name: params.peerName || (userType === 'rider' ? 'Customer' : 'Rider'),
    phone: params.peerPhone || null,
    subtitle: userType === 'rider' ? 'Customer' : 'Your delivery rider',
  });
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Customer side: resolve the assigned rider's name/phone from the delivery.
  useEffect(() => {
    if (!deliveryId || userType === 'rider' || params.peerName) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: delivery } = await (supabase as any)
          .from('deliveries')
          .select('rider_id')
          .eq('id', deliveryId)
          .maybeSingle();
        if (!delivery?.rider_id || cancelled) return;
        const { data: rider } = await (supabase as any)
          .from('riders')
          .select('full_name, phone')
          .eq('id', delivery.rider_id)
          .maybeSingle();
        if (rider && !cancelled) {
          setPeer((prev) => ({
            ...prev,
            name: rider.full_name ?? prev.name,
            phone: rider.phone ?? prev.phone,
          }));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [deliveryId, userType, params.peerName]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true }),
    );
  }, []);

  // Edge-to-edge Android often ignores adjustResize; lift the composer manually.
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      scrollToEnd();
    });
    const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [scrollToEnd]);

  useEffect(() => {
    if (messages.length) scrollToEnd();
  }, [messages.length, peerTyping, scrollToEnd]);

  const callActiveOnThread =
    !!deliveryId &&
    callDeliveryId === deliveryId &&
    (callPhase === 'connecting' || callPhase === 'incoming');
  const peerOnCall =
    peerCallPhase === 'connecting' ||
    peerCallPhase === 'connected' ||
    peerCallPhase === 'incoming';
  const callConnecting =
    callActiveOnThread ||
    peerCallPhase === 'connecting' ||
    peerCallPhase === 'incoming';
  const chatLocked = callConnecting || sending;

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || chatLocked) return;
    tapLight();
    setInputText('');
    try {
      await sendText(text);
    } catch {
      notifyError();
    }
  };

  const handleChangeText = (text: string) => {
    if (callConnecting) return;
    setInputText(text);
    if (text.length > 0) notifyTyping();
    else notifyStopTyping();
  };

  const handlePickImage = async (source: PickSource) => {
    if (callConnecting) return;
    setAttachOpen(false);
    try {
      const picked = await pickChatImage(source);
      if (!picked) return;
      await sendImage(picked);
    } catch {
      notifyError();
    }
  };

  const handleCall = () => {
    if (!deliveryId) {
      showAlert('Voice call', 'Chat is not linked to an active delivery yet.');
      return;
    }

    const buttons: AlertButton[] = [
      {
        text: 'In-App Call',
        onPress: () => {
          startCall(deliveryId, peer.name).catch(() => notifyError());
        },
      },
    ];

    if (peer.phone) {
      buttons.push({
        text: 'Phone Call',
        onPress: () => {
          Linking.openURL(`tel:${peer.phone}`).catch(() => {});
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });

    showAlert(`Call ${peer.name}`, 'Choose how you want to call', buttons);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isMine = item.sender_id === user?.id;
    const prev = messages[index - 1];
    const isFirstOfGroup = !prev || prev.sender_id !== item.sender_id;

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.messageRowMine : styles.messageRowTheirs,
          { marginTop: isFirstOfGroup ? 14 : 3 },
        ]}
      >
        <TouchableOpacity
          activeOpacity={item.failed || item.imageUrl ? 0.7 : 1}
          onPress={() => {
            if (item.failed) {
              retryMessage(item).catch(() => notifyError());
            } else if (item.imageUrl) {
              setPreviewUrl(item.imageUrl);
            }
          }}
          style={[
            styles.bubble,
            item.imageUrl ? styles.imageBubble : null,
            isMine
              ? {
                  backgroundColor: theme.colors.primary,
                  borderBottomRightRadius: isFirstOfGroup ? 18 : 6,
                }
              : {
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderBottomLeftRadius: isFirstOfGroup ? 18 : 6,
                },
            item.pending ? { opacity: 0.65 } : null,
          ]}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : null}
          {item.content ? (
            <Text
              style={[
                styles.messageText,
                { color: isMine ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              {item.content}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {item.failed ? (
              <Text
                style={[
                  styles.metaText,
                  { color: isMine ? '#FFD5D5' : theme.colors.error },
                ]}
              >
                Failed · tap to retry
              </Text>
            ) : (
              <Text
                style={[
                  styles.metaText,
                  {
                    color: isMine
                      ? 'rgba(255,255,255,0.75)'
                      : theme.colors.textTertiary,
                  },
                ]}
              >
                {item.pending ? 'Sending…' : formatTime(item.created_at)}
                {isMine && !item.pending && item.read_at ? '  ·  Read' : ''}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const missingThread = !deliveryId;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: 12 + insets.top,
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <ArrowLeft size={22} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerName, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {peer.name}
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              {
                color:
                  peerOnCall || callActiveOnThread
                    ? theme.colors.success
                    : peerTyping
                      ? theme.colors.primary
                      : theme.colors.textTertiary,
              },
            ]}
            numberOfLines={1}
          >
            {callActiveOnThread
              ? 'Connecting voice call…'
              : peerCallPhase === 'connected'
                ? 'On a voice call'
                : peerCallPhase === 'connecting' || peerCallPhase === 'incoming'
                  ? 'Joining a voice call…'
                  : peerTyping
                    ? 'typing…'
                    : peer.subtitle}
          </Text>
        </View>
        {deliveryId ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleCall}
            hitSlop={8}
          >
            <Phone size={20} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <View
        style={[
          styles.flex,
          // Lift above keyboard (adjustResize often fails with Android edge-to-edge).
          { paddingBottom: keyboardHeight > 0 ? keyboardHeight : 0 },
        ]}
      >
        {missingThread ? (
          <View style={styles.centerFill}>
            <Text
              style={[styles.emptyText, { color: theme.colors.textSecondary }]}
            >
              Chat is available once a delivery is in progress.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Say hello — messages about this delivery appear here.
                </Text>
              </View>
            }
            ListFooterComponent={
              peerOnCall ? (
                <View
                  style={[
                    styles.messageRow,
                    styles.messageRowTheirs,
                    { marginTop: 14 },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      styles.callStatusBubble,
                      {
                        backgroundColor: theme.colors.surface,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Phone
                      size={14}
                      color={theme.colors.success}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.callStatusText,
                        { color: theme.colors.textSecondary },
                      ]}
                    >
                      {peerCallPhase === 'connected'
                        ? `${peer.name} is on a voice call`
                        : `${peer.name} is connecting a voice call`}
                    </Text>
                  </View>
                </View>
              ) : peerTyping ? (
                <View
                  style={[
                    styles.messageRow,
                    styles.messageRowTheirs,
                    { marginTop: 14 },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      styles.typingBubble,
                      {
                        backgroundColor: theme.colors.surface,
                        borderWidth: 1,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <TypingDots color={theme.colors.textTertiary} />
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {/* Composer */}
        {!missingThread && (
          <View
            style={[
              styles.composer,
              {
                backgroundColor: theme.colors.background,
                borderTopColor: theme.colors.border,
                // Keep a little breathing room above the keyboard; restore safe-area when closed.
                paddingBottom:
                  keyboardHeight > 0 ? 16 : Math.max(insets.bottom, 12),
              },
            ]}
          >
            {callConnecting ? (
              <View
                style={[
                  styles.callLockBanner,
                  {
                    backgroundColor: isDark ? theme.colors.surface : '#EEF2FF',
                  },
                ]}
              >
                <Phone size={14} color={theme.colors.primary} strokeWidth={2} />
                <Text
                  style={[
                    styles.callLockText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Chat is paused while the call connects
                </Text>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <TouchableOpacity
                style={[
                  styles.attachBtn,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => {
                  tapLight();
                  setAttachOpen(true);
                }}
                disabled={chatLocked}
              >
                <Plus
                  size={20}
                  color={theme.colors.textSecondary}
                  strokeWidth={2}
                />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                  },
                ]}
                placeholder={
                  callConnecting ? 'Chat paused while connecting…' : 'Message'
                }
                placeholderTextColor={theme.colors.textTertiary}
                value={inputText}
                onChangeText={handleChangeText}
                onBlur={notifyStopTyping}
                editable={!callConnecting}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      inputText.trim() && !chatLocked
                        ? theme.colors.primary
                        : theme.colors.border,
                  },
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || chatLocked}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ArrowUp size={18} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Attachment sheet */}
      <Modal
        visible={attachOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachOpen(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setAttachOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={[
                styles.sheetHandle,
                { backgroundColor: theme.colors.border },
              ]}
            />
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => handlePickImage('camera')}
            >
              <Camera size={20} color={theme.colors.primary} strokeWidth={2} />
              <Text
                style={[styles.sheetOptionText, { color: theme.colors.text }]}
              >
                Take photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => handlePickImage('gallery')}
            >
              <ImageIcon
                size={20}
                color={theme.colors.primary}
                strokeWidth={2}
              />
              <Text
                style={[styles.sheetOptionText, { color: theme.colors.text }]}
              >
                Choose from gallery
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Fullscreen image preview */}
      <Modal
        visible={!!previewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={[styles.previewClose, { top: insets.top + 12 }]}
            onPress={() => setPreviewUrl(null)}
            hitSlop={12}
          >
            <X size={26} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TypingDots({ color }: { color: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => (t + 1) % 3), 350);
    return () => clearInterval(interval);
  }, []);
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: color, opacity: tick === i ? 1 : 0.35 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 12, marginTop: 1 },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  listContent: { paddingHorizontal: 16, paddingBottom: 16, flexGrow: 1 },
  messageRow: { flexDirection: 'row' },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  imageBubble: {
    padding: 4,
    overflow: 'hidden',
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
  },
  messageText: { fontSize: 15, lineHeight: 21 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 3,
    paddingHorizontal: 2,
  },
  metaText: { fontSize: 10.5 },
  typingBubble: { paddingVertical: 13, paddingHorizontal: 16 },
  callStatusBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  callStatusText: { fontSize: 13, fontWeight: '500' },
  callLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  callLockText: { fontSize: 12, fontWeight: '600', flex: 1 },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 8,
    paddingBottom: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  sheetOptionText: { fontSize: 16, fontWeight: '500' },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
  },
  previewImage: { width: '100%', height: '80%' },
});
