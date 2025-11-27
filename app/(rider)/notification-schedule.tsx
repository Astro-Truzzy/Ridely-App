import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Clock,
  Bell,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function NotificationScheduleScreen() {
  const { theme, isDark } = useTheme();
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [startTime, setStartTime] = useState('22:00');
  const [endTime, setEndTime] = useState('07:00');

  const timeOptions = [
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
    '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
  ];

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    return hour > 12 ? `${hour - 12}:${minutes} PM` : `${hour}:${minutes} AM`;
  };

  const handleSave = () => {
    if (quietHoursEnabled) {
      Alert.alert(
        'Schedule Updated',
        `Quiet hours set from ${formatTime(startTime)} to ${formatTime(endTime)}. You won't receive non-critical notifications during this period.`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Notifications Enabled',
        'All notifications are now enabled. You will receive all alerts according to your notification settings.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Notification Schedule</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={[styles.saveText, { color: theme.colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.switchContainer}>
              <View style={styles.switchInfo}>
                <Bell size={24} color={theme.colors.primary} strokeWidth={2} />
                <View style={styles.switchText}>
                  <Text style={[styles.switchTitle, { color: theme.colors.text }]}>Quiet Hours</Text>
                  <Text style={[styles.switchSubtitle, { color: theme.colors.textSecondary }]}>
                    Mute non-critical notifications during specified hours
                  </Text>
                </View>
              </View>
              <Switch
                value={quietHoursEnabled}
                onValueChange={setQuietHoursEnabled}
                trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                thumbColor={quietHoursEnabled ? theme.colors.primary : theme.colors.textTertiary}
              />
            </View>
          </View>
        </View>

        {quietHoursEnabled && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Schedule</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                Set the time period when you don't want to receive notifications
              </Text>
              
              <View style={[styles.timeContainer, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.timeSection, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.timeLabel, { color: theme.colors.text }]}>Start Time</Text>
                  <TouchableOpacity 
                    style={styles.timePicker}
                    onPress={() => Alert.alert('Time Picker', 'Time picker would open here')}>
                    <Text style={[styles.timeValue, { color: theme.colors.primary }]}>{formatTime(startTime)}</Text>
                    <Clock size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.timeSection}>
                  <Text style={[styles.timeLabel, { color: theme.colors.text }]}>End Time</Text>
                  <TouchableOpacity 
                    style={styles.timePicker}
                    onPress={() => Alert.alert('Time Picker', 'Time picker would open here')}>
                    <Text style={[styles.timeValue, { color: theme.colors.primary }]}>{formatTime(endTime)}</Text>
                    <Clock size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Exceptions</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                Select which notifications can still come through during quiet hours
              </Text>
              
              <View style={[styles.exceptionsContainer, { backgroundColor: theme.colors.surface }]}>
                <View style={[styles.exceptionItem, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.exceptionText, { color: theme.colors.text }]}>Urgent Delivery Requests</Text>
                  <Switch
                    value={true}
                    disabled
                    trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                    thumbColor={theme.colors.primary}
                  />
                </View>
                
                <View style={[styles.exceptionItem, { borderBottomColor: theme.colors.border }]}>
                  <Text style={[styles.exceptionText, { color: theme.colors.text }]}>Critical System Alerts</Text>
                  <Switch
                    value={true}
                    disabled
                    trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                    thumbColor={theme.colors.primary}
                  />
                </View>
                
                <View style={styles.exceptionItem}>
                  <Text style={[styles.exceptionText, { color: theme.colors.text }]}>Personal Messages</Text>
                  <Switch
                    value={false}
                    trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                    thumbColor={theme.colors.textTertiary}
                  />
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.noteContainer}>
          <Text style={[styles.noteTitle, { color: theme.colors.text }]}>Important:</Text>
          <Text style={[styles.noteText, { color: theme.colors.textSecondary }]}>
            During quiet hours, you will still receive critical notifications such as urgent delivery requests, 
            safety alerts, and account security notifications. Quiet hours apply to all non-critical notifications.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  saveButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchText: {
    marginLeft: 16,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  switchSubtitle: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  timeContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  timeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  exceptionsContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  exceptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  exceptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  noteContainer: {
    marginHorizontal: 20,
    marginBottom: 32,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
});