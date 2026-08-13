import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useConnectionState, useParticipants, useRoomContext } from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
import { Mic, MicOff, PhoneOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type VoiceCallSessionProps = {
  peerName: string;
  muted: boolean;
  onHangUp: () => void;
  onConnected: () => void;
  onToggleMute: () => void;
};

export function VoiceCallSession({
  peerName,
  muted,
  onHangUp,
  onConnected,
  onToggleMute,
}: VoiceCallSessionProps) {
  const { theme } = useTheme();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();

  const remoteCount = participants.filter((p) => !p.isLocal).length;
  const isConnected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (isConnected) onConnected();
  }, [isConnected, onConnected]);

  useEffect(() => {
    room.localParticipant.setMicrophoneEnabled(!muted).catch(() => {});
  }, [muted, room]);

  useEffect(() => {
    if (connectionState === ConnectionState.Disconnected) {
      onHangUp();
    }
  }, [connectionState, onHangUp]);

  const statusText = (() => {
    if (connectionState === ConnectionState.Connecting) return 'Connecting…';
    if (!isConnected) return 'Reconnecting…';
    if (remoteCount === 0) return 'Ringing…';
    return 'Connected';
  })();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.center}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.avatarText}>{peerName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: theme.colors.text }]}>{peerName}</Text>
        <View style={styles.statusRow}>
          {!isConnected ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.spinner} />
          ) : null}
          <Text style={[styles.status, { color: theme.colors.textSecondary }]}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, { backgroundColor: theme.colors.surface }]}
          onPress={onToggleMute}
        >
          {muted ? (
            <MicOff size={24} color={theme.colors.error} strokeWidth={2} />
          ) : (
            <Mic size={24} color={theme.colors.text} strokeWidth={2} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.endBtn, { backgroundColor: theme.colors.error }]}
          onPress={onHangUp}
        >
          <PhoneOff size={28} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinner: {
    marginRight: 8,
  },
  status: {
    fontSize: 16,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 24,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
