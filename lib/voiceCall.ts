import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

export type LiveKitCredentials = {
  token: string;
  serverUrl: string;
  roomName: string;
};

export function isVoiceCallSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (Constants.appOwnership === 'expo') return false;
  return Boolean(process.env.EXPO_PUBLIC_LIVEKIT_URL);
}

export function getLiveKitServerUrl(): string | null {
  const url = process.env.EXPO_PUBLIC_LIVEKIT_URL?.trim();
  return url || null;
}

export function deliveryRoomName(deliveryId: string): string {
  return `delivery-${deliveryId}`;
}

export async function fetchLiveKitToken(deliveryId: string): Promise<LiveKitCredentials> {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { deliveryId },
  });

  if (error) {
    throw new Error(error.message || 'Could not start voice call');
  }

  const payload = data as {
    token?: string;
    serverUrl?: string;
    roomName?: string;
    error?: string;
  };

  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.token || !payload?.serverUrl) {
    throw new Error('Invalid voice call token response');
  }

  return {
    token: payload.token,
    serverUrl: payload.serverUrl,
    roomName: payload.roomName ?? deliveryRoomName(deliveryId),
  };
}

export async function notifyIncomingVoiceCall(params: {
  deliveryId: string;
  riderIds?: string[];
  userIds?: string[];
  callerName: string;
}): Promise<void> {
  const { deliveryId, callerName, riderIds, userIds } = params;
  if ((!riderIds?.length && !userIds?.length) || (riderIds?.length && userIds?.length)) return;

  try {
    await supabase.functions.invoke('send-push', {
      body: {
        ...(riderIds?.length ? { riderIds } : { userIds }),
        title: 'Incoming Ridely call',
        body: `${callerName} is calling about your delivery`,
        data: {
          type: 'voice_call',
          deliveryId,
          callerName,
        },
      },
    });
  } catch {
    // Non-fatal: callee can still join from the active delivery screen.
  }
}

export async function resolveVoiceCallPeerTargets(
  deliveryId: string,
  callerUserId: string
): Promise<{ riderIds?: string[]; userIds?: string[] }> {
  const { data: delivery, error } = await (supabase as any)
    .from('deliveries')
    .select('user_id, rider_id')
    .eq('id', deliveryId)
    .maybeSingle();

  if (error || !delivery) return {};

  if (delivery.user_id === callerUserId && delivery.rider_id) {
    return { riderIds: [delivery.rider_id] };
  }
  if (delivery.rider_id === callerUserId && delivery.user_id) {
    return { userIds: [delivery.user_id] };
  }
  return {};
}
