import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Clock, Bell } from 'lucide-react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';

const STORAGE_KEY = '@ridely/rider_notification_schedule';

const TIME_OPTIONS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

interface StoredSchedule {
  quietHoursEnabled: boolean;
  startTime: string;
  endTime: string;
  allowPersonalMessagesDuringQuietHours: boolean;
}

const defaultSchedule: StoredSchedule = {
  quietHoursEnabled: false,
  startTime: '22:00',
  endTime: '07:00',
  allowPersonalMessagesDuringQuietHours: false,
};

export default function NotificationScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert } = useAlert();
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(defaultSchedule.quietHoursEnabled);
  const [startTime, setStartTime] = useState(defaultSchedule.startTime);
  const [endTime, setEndTime] = useState(defaultSchedule.endTime);
  const [allowPersonalMessages, setAllowPersonalMessages] = useState(defaultSchedule.allowPersonalMessagesDuringQuietHours);
  const [timePickerField, setTimePickerField] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw) as Partial<StoredSchedule>;
        if (typeof parsed.quietHoursEnabled === 'boolean') setQuietHoursEnabled(parsed.quietHoursEnabled);
        if (typeof parsed.startTime === 'string') setStartTime(parsed.startTime);
        if (typeof parsed.endTime === 'string') setEndTime(parsed.endTime);
        if (typeof parsed.allowPersonalMessagesDuringQuietHours === 'boolean') setAllowPersonalMessages(parsed.allowPersonalMessagesDuringQuietHours);
      } catch {
        // keep defaults
      }
    })();
    return () => { mounted = false; };
  }, []);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    return hour > 12 ? `${hour - 12}:${minutes} PM` : hour === 12 ? `12:${minutes} PM` : hour === 0 ? `12:${minutes} AM` : `${hour}:${minutes} AM`;
  };

  const handleSave = async () => {
    try {
      const payload: StoredSchedule = {
        quietHoursEnabled,
        startTime,
        endTime,
        allowPersonalMessagesDuringQuietHours: allowPersonalMessages,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      if (quietHoursEnabled) {
        showAlert(
          'Schedule Updated',
          `Quiet hours set from ${formatTime(startTime)} to ${formatTime(endTime)}. You won't receive non-critical notifications during this period.`,
          [{ text: 'OK' }]
        );
      } else {
        showAlert(
          'Notifications Enabled',
          'All notifications are now enabled. You will receive all alerts according to your notification settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      showAlert('Error', 'Failed to save schedule. Please try again.');
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingTop: 16 + insets.top }]}>
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
                    onPress={() => setTimePickerField('start')}>
                    <Text style={[styles.timeValue, { color: theme.colors.primary }]}>{formatTime(startTime)}</Text>
                    <Clock size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.timeSection}>
                  <Text style={[styles.timeLabel, { color: theme.colors.text }]}>End Time</Text>
                  <TouchableOpacity
                    style={styles.timePicker}
                    onPress={() => setTimePickerField('end')}>
                    <Text style={[styles.timeValue, { color: theme.colors.primary }]}>{formatTime(endTime)}</Text>
                    <Clock size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              <Modal
                visible={timePickerField !== null}
                transparent
                animationType="slide">
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setTimePickerField(null)}>
                  <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                      {timePickerField === 'start' ? 'Start Time' : 'End Time'}
                    </Text>
                    <FlatList
                      data={TIME_OPTIONS}
                      keyExtractor={(item) => item}
                      style={styles.timeList}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[
                            styles.timeOption,
                            (timePickerField === 'start' && item === startTime) || (timePickerField === 'end' && item === endTime) ? styles.timeOptionSelected : null,
                          ]}
                          onPress={() => {
                            if (timePickerField === 'start') setStartTime(item);
                            else setEndTime(item);
                            setTimePickerField(null);
                          }}>
                          <Text style={[styles.timeOptionText, { color: theme.colors.text }]}>{formatTime(item)}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    <TouchableOpacity style={[styles.modalClose, { backgroundColor: theme.colors.border }]} onPress={() => setTimePickerField(null)}>
                      <Text style={[styles.modalCloseText, { color: theme.colors.text }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>
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
                    value={allowPersonalMessages}
                    onValueChange={setAllowPersonalMessages}
                    trackColor={{ false: theme.colors.border, true: `${theme.colors.primary}50` }}
                    thumbColor={allowPersonalMessages ? theme.colors.primary : theme.colors.textTertiary}
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  timeList: {
    maxHeight: 280,
  },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  timeOptionSelected: {
    opacity: 0.7,
  },
  timeOptionText: {
    fontSize: 16,
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});