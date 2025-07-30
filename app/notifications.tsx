import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Clock, Sun, Moon, Bell } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function NotificationScheduleScreen() {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<'anytime' | 'day' | 'night' | 'custom'>('anytime');
  const [customStart, setCustomStart] = useState(new Date(0, 0, 0, 8, 0)); // 8:00 AM
  const [customEnd, setCustomEnd] = useState(new Date(0, 0, 0, 20, 0));   // 8:00 PM
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const scheduleOptions = [
    {
      key: 'anytime' as const,
      title: 'Anytime',
      subtitle: 'Receive notifications at any time',
      icon: Bell,
    },
    {
      key: 'day' as const,
      title: 'Daytime Only',
      subtitle: 'Only between 8:00 AM and 8:00 PM',
      icon: Sun,
    },
    {
      key: 'night' as const,
      title: 'Nighttime Only',
      subtitle: 'Only between 8:00 PM and 8:00 AM',
      icon: Moon,
    },
    {
      key: 'custom' as const,
      title: 'Custom Schedule',
      subtitle: `Set your own notification hours`,
      icon: Clock,
    },
  ];

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Notification Schedule</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Choose when you want to receive notifications about your deliveries.
          </Text>
        </View>
        <View style={[styles.section, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
          {scheduleOptions.map((option, index) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.optionItem,
                index < scheduleOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
                selected === option.key && { backgroundColor: `${theme.colors.primary}10` },
              ]}
              onPress={() => setSelected(option.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                <option.icon size={20} color={theme.colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{option.title}</Text>
                <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>
                  {option.key === 'custom'
                    ? `From ${formatTime(customStart)} to ${formatTime(customEnd)}`
                    : option.subtitle}
                </Text>
              </View>
              {selected === option.key && (
                <View style={[styles.selectedDot, { backgroundColor: theme.colors.primary }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        {selected === 'custom' && (
          <View style={[styles.customContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.customLabel, { color: theme.colors.text }]}>Custom Schedule</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.colors.primary + '10' }]}
                onPress={() => setShowStartPicker(true)}
              >
                <Text style={[styles.timeButtonText, { color: theme.colors.primary }]}>
                  Start: {formatTime(customStart)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.colors.primary + '10' }]}
                onPress={() => setShowEndPicker(true)}
              >
                <Text style={[styles.timeButtonText, { color: theme.colors.primary }]}>
                  End: {formatTime(customEnd)}
                </Text>
              </TouchableOpacity>
            </View>
            {showStartPicker && (
              <DateTimePicker
                value={customStart}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowStartPicker(false);
                  if (date) setCustomStart(date);
                }}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={customEnd}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowEndPicker(false);
                  if (date) setCustomEnd(date);
                }}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 16,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  section: {
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 32,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
  },
  selectedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  customContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
  },
  customLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  timeButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
