import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NotificationCardProps = {
  title: string;
  message: string;
  timeLabel: string;
  read: boolean;
  expanded: boolean;
  icon: React.ReactNode;
  iconBackground: string;
  actionLabel?: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onAction?: () => void;
};

export function NotificationCard({
  title,
  message,
  timeLabel,
  read,
  expanded,
  icon,
  iconBackground,
  actionLabel,
  onToggle,
  onDelete,
  onAction,
}: NotificationCardProps) {
  const { theme, isDark } = useTheme();

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handleToggle}
      style={[
        styles.card,
        expanded && styles.cardExpanded,
        {
          backgroundColor: read
            ? theme.colors.card
            : isDark
              ? '#182033'
              : '#F5F8FF',
          borderColor: read
            ? isDark
              ? 'rgba(255,255,255,0.06)'
              : theme.colors.border
            : `${theme.colors.primary}40`,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: iconBackground }]}>
          {icon}
        </View>
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {!read && (
              <View
                style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]}
              />
            )}
          </View>
          <Text
            style={[styles.time, { color: theme.colors.textTertiary }]}
            numberOfLines={1}
          >
            {timeLabel}
          </Text>
        </View>
        <ChevronDown
          size={16}
          color={theme.colors.textTertiary}
          strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </View>

      {expanded ? (
        <View style={styles.details}>
          <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
            {message}
          </Text>
          <View style={styles.metaRow}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={onDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Trash2
                size={15}
                color={theme.colors.textTertiary}
                strokeWidth={1.75}
              />
            </TouchableOpacity>
            {actionLabel && onAction ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: `${theme.colors.primary}14`,
                    borderColor: `${theme.colors.primary}2E`,
                  },
                ]}
                onPress={onAction}
              >
                <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                  {actionLabel}
                </Text>
                <ChevronRight
                  size={14}
                  color={theme.colors.primary}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
            ) : (
              <View />
            )}
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  cardExpanded: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  main: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  time: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  details: {
    marginTop: 10,
    paddingTop: 10,
    paddingLeft: 42,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.22)',
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
