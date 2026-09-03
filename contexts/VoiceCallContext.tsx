import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import {
  fetchLiveKitToken,
  isVoiceCallSupported,
  notifyIncomingVoiceCall,
  resolveVoiceCallPeerTargets,
  type LiveKitCredentials,
} from '@/lib/voiceCall';
import {
  getLiveKitNative,
  isLiveKitRuntimeAvailable,
} from '@/lib/livekitSetup';
import {
  setNotificationResponseHandler,
  type PushNotificationData,
} from '@/hooks/usePushNotifications';
import { Phone, PhoneOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export type CallPhase = 'idle' | 'connecting' | 'connected' | 'incoming';

type IncomingCall = {
  deliveryId: string;
  callerName: string;
};

interface VoiceCallContextValue {
  phase: CallPhase;
  deliveryId: string | null;
  peerName: string;
  muted: boolean;
  startCall: (deliveryId: string, peerName: string) => Promise<void>;
  hangUp: () => void;
  acceptIncoming: () => Promise<void>;
  declineIncoming: () => void;
  setConnected: () => void;
  toggleMute: () => void;
}

const VoiceCallContext = createContext<VoiceCallContextValue | undefined>(
  undefined,
);

type VoiceCallSessionComponent =
  typeof import('@/components/VoiceCallSession').VoiceCallSession;

let VoiceCallSessionComp: VoiceCallSessionComponent | null = null;

function getVoiceCallSession(): VoiceCallSessionComponent | null {
  if (!isLiveKitRuntimeAvailable()) return null;
  if (!VoiceCallSessionComp) {
    VoiceCallSessionComp = (
      require('@/components/VoiceCallSession') as typeof import('@/components/VoiceCallSession')
    ).VoiceCallSession;
  }
  return VoiceCallSessionComp;
}

function NativeVoiceCallRoom({
  serverUrl,
  token,
  peerName,
  muted,
  onHangUp,
  onConnected,
  onToggleMute,
}: {
  serverUrl: string;
  token: string;
  peerName: string;
  muted: boolean;
  onHangUp: () => void;
  onConnected: () => void;
  onToggleMute: () => void;
}) {
  const livekit = getLiveKitNative();
  const Session = getVoiceCallSession();
  if (!livekit || !Session) return null;

  const { LiveKitRoom } = livekit;
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio
      video={false}
      onDisconnected={onHangUp}
    >
      <Session
        peerName={peerName}
        muted={muted}
        onHangUp={onHangUp}
        onConnected={onConnected}
        onToggleMute={onToggleMute}
      />
    </LiveKitRoom>
  );
}

export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { showAlert } = useAlert();

  const [phase, setPhase] = useState<CallPhase>('idle');
  const [peerName, setPeerName] = useState('');
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<LiveKitCredentials | null>(
    null,
  );
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioStartedRef = useRef(false);

  const resetCall = useCallback(() => {
    setPhase('idle');
    setPeerName('');
    setDeliveryId(null);
    setCredentials(null);
    setIncoming(null);
    setMuted(false);
    setError(null);
  }, []);

  const hangUp = useCallback(() => {
    resetCall();
  }, [resetCall]);

  const setConnected = useCallback(() => {
    setPhase('connected');
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const ensureSupported = useCallback(() => {
    if (Platform.OS === 'web') {
      showAlert(
        'Voice calls',
        'In-app voice calls are only available in the mobile app.',
      );
      return false;
    }
    if (Constants.appOwnership === 'expo') {
      showAlert(
        'Development build required',
        'Voice calls need a custom development build. They are not available in Expo Go.',
      );
      return false;
    }
    if (!isVoiceCallSupported()) {
      showAlert(
        'Voice calls unavailable',
        'LiveKit is not configured. Add EXPO_PUBLIC_LIVEKIT_URL to your environment.',
      );
      return false;
    }
    return true;
  }, [showAlert]);

  const connectToDelivery = useCallback(
    async (
      targetDeliveryId: string,
      targetPeerName: string,
      notifyPeer: boolean,
    ) => {
      if (!user?.id) {
        showAlert(
          'Sign in required',
          'You must be signed in to start a voice call.',
        );
        return;
      }
      if (!ensureSupported()) return;

      setError(null);
      setPhase('connecting');
      setPeerName(targetPeerName);
      setDeliveryId(targetDeliveryId);

      try {
        const creds = await fetchLiveKitToken(targetDeliveryId);
        setCredentials(creds);

        if (notifyPeer) {
          const targets = await resolveVoiceCallPeerTargets(
            targetDeliveryId,
            user.id,
          );
          const callerName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Ridely user';
          await notifyIncomingVoiceCall({
            deliveryId: targetDeliveryId,
            ...targets,
            callerName,
          });
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Could not start voice call';
        setError(message);
        resetCall();
        showAlert('Voice call failed', message);
      }
    },
    [user, ensureSupported, showAlert, resetCall],
  );

  const startCall = useCallback(
    async (targetDeliveryId: string, targetPeerName: string) => {
      await connectToDelivery(targetDeliveryId, targetPeerName, true);
    },
    [connectToDelivery],
  );

  const acceptIncoming = useCallback(async () => {
    if (!incoming) return;
    const { deliveryId: id, callerName } = incoming;
    setIncoming(null);
    await connectToDelivery(id, callerName, false);
  }, [incoming, connectToDelivery]);

  const declineIncoming = useCallback(() => {
    setIncoming(null);
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (incoming) setPhase('incoming');
  }, [incoming]);

  useEffect(() => {
    if (!deliveryId || !user?.id || phase === 'idle') return;

    const channel = supabase.channel(`delivery-call-${deliveryId}`);
    const send = (next: CallPhase) => {
      channel.send({
        type: 'broadcast',
        event: 'call_state',
        payload: { senderId: user.id, phase: next },
      });
    };

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') send(phase);
    });

    return () => {
      send('idle');
      supabase.removeChannel(channel);
    };
  }, [deliveryId, phase, user?.id]);

  useEffect(() => {
    if (!isLiveKitRuntimeAvailable()) return;
    const livekit = getLiveKitNative();
    if (!livekit) return;

    const startAudio = async () => {
      if (!credentials || audioStartedRef.current) return;
      audioStartedRef.current = true;
      try {
        await livekit.AudioSession.startAudioSession();
      } catch {
        // LiveKit may still connect; ignore session start failures.
      }
    };

    if (credentials) {
      startAudio();
    } else if (audioStartedRef.current) {
      audioStartedRef.current = false;
      livekit.AudioSession.stopAudioSession().catch(() => {});
    }
  }, [credentials]);

  useEffect(() => {
    const handlePush = (data: PushNotificationData) => {
      if (data.type !== 'voice_call' || !data.deliveryId) return;
      if (phase !== 'idle' || credentials) return;

      setIncoming({
        deliveryId: String(data.deliveryId),
        callerName:
          typeof data.callerName === 'string' ? data.callerName : 'Ridely user',
      });
    };

    setNotificationResponseHandler(handlePush);

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = (notification.request.content.data ||
          {}) as PushNotificationData;
        handlePush(data);
      },
    );

    return () => {
      setNotificationResponseHandler(null);
      receivedSub.remove();
    };
  }, [phase, credentials]);

  const value = useMemo(
    () => ({
      phase,
      deliveryId,
      peerName,
      muted,
      startCall,
      hangUp,
      acceptIncoming,
      declineIncoming,
      setConnected,
      toggleMute,
    }),
    [
      phase,
      deliveryId,
      peerName,
      muted,
      startCall,
      hangUp,
      acceptIncoming,
      declineIncoming,
      setConnected,
      toggleMute,
    ],
  );

  const showCallModal = Boolean(credentials) || Boolean(incoming);

  return (
    <VoiceCallContext.Provider value={value}>
      {children}

      <Modal
        visible={showCallModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {credentials ? (
          <NativeVoiceCallRoom
            serverUrl={credentials.serverUrl}
            token={credentials.token}
            peerName={peerName}
            muted={muted}
            onHangUp={hangUp}
            onConnected={setConnected}
            onToggleMute={toggleMute}
          />
        ) : incoming ? (
          <View
            style={[
              styles.incomingWrap,
              { backgroundColor: theme.colors.background },
            ]}
          >
            <View style={styles.incomingCenter}>
              <View
                style={[
                  styles.incomingAvatar,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Phone size={36} color="#FFFFFF" strokeWidth={2} />
              </View>
              <Text
                style={[styles.incomingTitle, { color: theme.colors.text }]}
              >
                Incoming call
              </Text>
              <Text style={[styles.incomingName, { color: theme.colors.text }]}>
                {incoming.callerName}
              </Text>
              <Text
                style={[
                  styles.incomingSub,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Ridely delivery voice call
              </Text>
            </View>
            <View style={styles.incomingActions}>
              <TouchableOpacity
                style={[
                  styles.declineBtn,
                  { backgroundColor: theme.colors.error },
                ]}
                onPress={declineIncoming}
              >
                <PhoneOff size={28} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.actionLabel}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.acceptBtn,
                  { backgroundColor: theme.colors.success },
                ]}
                onPress={() => {
                  acceptIncoming().catch(() => {
                    showAlert(
                      'Voice call failed',
                      error ?? 'Could not join the call.',
                    );
                  });
                }}
              >
                <Phone size={28} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.actionLabel}>Answer</Text>
              </TouchableOpacity>
            </View>
            {phase === 'connecting' ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.primary}
                style={styles.connecting}
              />
            ) : null}
          </View>
        ) : null}
      </Modal>
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall(): VoiceCallContextValue {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) {
    throw new Error('useVoiceCall must be used within VoiceCallProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  incomingWrap: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  incomingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  incomingTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  incomingName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  incomingSub: {
    fontSize: 15,
    textAlign: 'center',
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 32,
  },
  declineBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  connecting: {
    marginBottom: 16,
  },
});
