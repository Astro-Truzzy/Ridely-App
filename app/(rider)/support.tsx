import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Phone,
  HelpCircle,
  FileText,
  Clock,
  User,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export default function RiderSupportScreen() {
  const { theme, isDark } = useTheme();
  const [activeFAQ, setActiveFAQ] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const faqs: FAQItem[] = [
    {
      id: '1',
      question: 'How do I accept a delivery request?',
      answer: 'When a delivery request comes in, you\'ll receive a notification. Open the app and tap "Accept" on the job details screen to claim the delivery.',
    },
    {
      id: '2',
      question: 'How do I track my earnings?',
      answer: 'Go to the "Earnings" tab in your dashboard to view your daily, weekly, and monthly earnings. All completed deliveries are automatically calculated.',
    },
    {
      id: '3',
      question: 'What should I do if I encounter a problem during delivery?',
      answer: 'Use the "Report Issue" button in the active delivery screen to notify our support team. You can also contact support directly through this page.',
    },
    {
      id: '4',
      question: 'How do ratings work?',
      answer: 'Users rate riders after each delivery. Your rating affects your visibility in the system - higher-rated riders get more delivery requests.',
    },
    {
      id: '5',
      question: 'What are the requirements for vehicle maintenance?',
      answer: 'All riders must maintain their vehicles in good working condition. Regular checks include brakes, lights, tires, and overall safety. Vehicles are subject to periodic inspections.',
    },
  ];

  const supportOptions = [
    {
      icon: MessageCircle,
      title: 'Live Chat',
      subtitle: 'Chat with support team',
      color: '#5A47FF',
      action: () => Alert.alert('Live Chat', 'Live chat will be available soon!'),
    },
    {
      icon: Mail,
      title: 'Email Support',
      subtitle: 'Send us an email',
      color: '#10B981',
      action: () => Linking.openURL('mailto:support@ridely.com'),
    },
    {
      icon: Phone,
      title: 'Call Us',
      subtitle: 'Call our support line',
      color: '#FFC947',
      action: () => Linking.openURL('tel:18005551234'),
    },
  ];

  const toggleFAQ = (id: string) => {
    setActiveFAQ(activeFAQ === id ? null : id);
  };

  const handleSubmit = () => {
    if (message.trim()) {
      Alert.alert(
        'Message Sent',
        'Thank you for contacting support. We\'ll get back to you as soon as possible.',
        [{ text: 'OK' }]
      );
      setMessage('');
    } else {
      Alert.alert('Error', 'Please enter a message before submitting.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Support Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>How can we help?</Text>
          <View style={styles.optionsContainer}>
            {supportOptions.map((option, index) => {
              const IconComponent = option.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.optionCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
                  onPress={option.action}>
                  <View style={[styles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                    <IconComponent size={24} color={option.color} strokeWidth={2} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{option.title}</Text>
                    <Text style={[styles.optionSubtitle, { color: theme.colors.textSecondary }]}>{option.subtitle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Frequently Asked Questions</Text>
          <View style={[styles.faqContainer, { backgroundColor: theme.colors.surface }]}>
            {faqs.map((faq) => (
              <View
                key={faq.id}
                style={[
                  styles.faqItem,
                  { borderBottomColor: theme.colors.border },
                  activeFAQ === faq.id && styles.activeFAQ,
                ]}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleFAQ(faq.id)}>
                  <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{faq.question}</Text>
                  <HelpCircle
                    size={20}
                    color={theme.colors.textSecondary}
                    strokeWidth={2}
                    style={[styles.faqIcon, activeFAQ === faq.id && styles.faqIconActive]}
                  />
                </TouchableOpacity>
                {activeFAQ === faq.id && (
                  <View style={styles.faqAnswerContainer}>
                    <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary }]}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Contact Form */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Contact Us</Text>
          <View style={[styles.contactContainer, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Your Message</Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: isDark ? theme.colors.card : '#F3F4F6',
                  color: theme.colors.text,
                  borderColor: theme.colors.border
                }]}
                multiline
                numberOfLines={4}
                placeholder="Describe your issue or question..."
                placeholderTextColor={theme.colors.textTertiary}
                value={message}
                onChangeText={setMessage}
              />
            </View>
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSubmit}>
              <Text style={styles.submitButtonText}>Send Message</Text>
            </TouchableOpacity>
          </View>
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
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  optionsContainer: {
    paddingHorizontal: 20,
  },
  optionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
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
  faqContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  faqItem: {
    borderBottomWidth: 1,
  },
  activeFAQ: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  faqIcon: {
    transform: [{ rotate: '0deg' }],
    transition: 'transform 0.2s ease',
  },
  faqIconActive: {
    transform: [{ rotate: '180deg' }],
  },
  faqAnswerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 0,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  contactContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  textInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});