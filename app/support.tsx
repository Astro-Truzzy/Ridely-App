import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FormError } from '@/components/FormError';
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  Mail,
  HelpCircle,
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
} from 'lucide-react-native';
import { router } from 'expo-router';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'delivery' | 'payment' | 'account' | 'general';
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { showAlert, showToast } = useAlert();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const SUPPORT_PHONE = '+15551234357';
  const SUPPORT_EMAIL = 'ridelyi.nc@gmail.com';

  const openLiveChat = async () => {
    try {
      const text = encodeURIComponent('Hello Ridely support, I need help with my account.');
      const whatsappUrl = `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, '')}?text=${text}`;
      await Linking.openURL(whatsappUrl);
    } catch {
      const subject = encodeURIComponent('Ridely support request');
      const body = encodeURIComponent('Hello support team, I need help with:');
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
    }
  };

  const openCallSupport = async () => {
    try {
      await Linking.openURL(`tel:${SUPPORT_PHONE}`);
    } catch {
      showToast(`Unable to launch the dialer. Please call ${SUPPORT_PHONE}.`, 'error');
    }
  };

  const faqs: FAQ[] = [
    {
      id: '1',
      question: 'How long does delivery usually take?',
      answer: 'Delivery times vary based on distance and traffic, but typically range from 25-45 minutes for most deliveries within the city.',
      category: 'delivery',
    },
    {
      id: '2',
      question: 'What payment methods do you accept?',
      answer: 'We accept credit/debit cards, cash on delivery, and Ridely wallet balance. All card payments are processed securely.',
      category: 'payment',
    },
    {
      id: '3',
      question: 'Can I track my delivery in real-time?',
      answer: 'Yes! Once your rider picks up your package, you can track their location in real-time through the app.',
      category: 'delivery',
    },
    {
      id: '4',
      question: 'What if my package gets damaged?',
      answer: 'All packages are insured up to $100. If your package arrives damaged, please report it immediately through the app for a full refund.',
      category: 'general',
    },
    {
      id: '5',
      question: 'How do I update my profile information?',
      answer: 'Go to Profile tab, tap the edit button, and update your information. Don\'t forget to save your changes.',
      category: 'account',
    },
  ];

  const supportOptions = [
    {
      icon: MessageCircle,
      title: 'Live Chat',
      subtitle: 'Chat with our support team',
      action: openLiveChat,
      color: '#5A47FF',
    },
    {
      icon: Phone,
      title: 'Call Support',
      subtitle: 'Speak with a representative',
      action: openCallSupport,
      color: '#10B981',
    },
    {
      icon: Mail,
      title: 'Email Support',
      subtitle: 'Send us an email',
      action: () => Linking.openURL('mailto:ridelyi.nc@gmail.com'),
      color: '#3B82F6',
    },
  ];

  const filteredFAQs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleSubmitSupport = async () => {
    const trimmed = contactMessage.trim();
    if (!trimmed) {
      setFormError('Please enter a message before submitting.');
      return;
    }
    if (!user?.id) {
      setFormError('You must be signed in to send a support request.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from('support_requests').insert({
        user_id: user.id,
        user_type: 'user',
        message: trimmed,
        category: 'general',
      });
      if (error) throw error;
      showToast('Thanks — we will get back to you shortly.');
      setContactMessage('');
      setFormError(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to send support message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border, paddingTop: 16 + insets.top }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Need Immediate Help?</Text>
          <View style={styles.supportOptions}>
            {supportOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.supportOption, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}
                onPress={option.action}>
                <View style={[styles.supportIcon, { backgroundColor: option.color }]}>
                  <option.icon size={24} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View style={styles.supportInfo}>
                  <Text style={[styles.supportTitle, { color: theme.colors.text }]}>{option.title}</Text>
                  <Text style={[styles.supportSubtitle, { color: theme.colors.textSecondary }]}>{option.subtitle}</Text>
                </View>
                <ChevronRight size={20} color={theme.colors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Business Hours */}
        <View style={styles.section}>
          <View style={[styles.hoursCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <Clock size={24} color={theme.colors.primary} strokeWidth={2} />
            <View style={styles.hoursInfo}>
              <Text style={[styles.hoursTitle, { color: theme.colors.text }]}>Support Hours</Text>
              <Text style={[styles.hoursText, { color: theme.colors.textSecondary }]}>Monday - Friday: 8 AM - 8 PM</Text>
              <Text style={[styles.hoursText, { color: theme.colors.textSecondary }]}>Weekend: 9 AM - 6 PM</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5' }]}>
              <CheckCircle size={16} color="#10B981" strokeWidth={2} />
              <Text style={[styles.statusText, { color: '#10B981' }]}>Open</Text>
            </View>
          </View>
        </View>

        {/* Search FAQ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Frequently Asked Questions</Text>
          <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Search size={20} color={theme.colors.textTertiary} strokeWidth={2} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder="Search for help..."
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* FAQ List */}
        <View style={styles.faqContainer}>
          {filteredFAQs.map((faq) => (
            <TouchableOpacity
              key={faq.id}
              style={[styles.faqItem, { backgroundColor: theme.colors.surface }, theme.shadows.small]}
              onPress={() => toggleFAQ(faq.id)}>
              <View style={styles.faqHeader}>
                <HelpCircle size={20} color={theme.colors.primary} strokeWidth={2} />
                <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{faq.question}</Text>
                <View style={[
                  styles.expandIcon,
                  expandedFAQ === faq.id && styles.expandIconRotated,
                ]}>
                  <ChevronRight size={16} color={theme.colors.textTertiary} strokeWidth={2} />
                </View>
              </View>
              {expandedFAQ === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={[styles.answerText, { color: theme.colors.textSecondary }]}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {filteredFAQs.length === 0 && searchQuery && (
          <View style={styles.noResults}>
            <HelpCircle size={48} color={theme.colors.textTertiary} strokeWidth={2} />
            <Text style={[styles.noResultsTitle, { color: theme.colors.text }]}>No results found</Text>
            <Text style={[styles.noResultsText, { color: theme.colors.textSecondary }]}>
              Try different keywords or contact our support team for help.
            </Text>
          </View>
        )}

        {/* Contact Form */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Still Need Help?</Text>
          <View style={[styles.contactCard, { backgroundColor: theme.colors.surface }, theme.shadows.medium]}>
            <Text style={[styles.contactTitle, { color: theme.colors.text }]}>Send us a message</Text>
            <Text style={[styles.contactSubtitle, { color: theme.colors.textSecondary }]}>
              Describe your issue and we&apos;ll get back to you as soon as possible.
            </Text>
            <TextInput
              style={[styles.contactInput, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}
              placeholder="Tell us what went wrong..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              numberOfLines={4}
              value={contactMessage}
              onChangeText={(t) => {
                setContactMessage(t);
                setFormError(null);
              }}
            />
            <FormError message={formError} />
            <TouchableOpacity 
              style={[styles.contactButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleSubmitSupport}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MessageCircle size={20} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.contactButtonText}>Contact Support</Text>
                </>
              )}
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
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 20,
  },
  supportOptions: {
    paddingHorizontal: 20,
    gap: 12,
  },
  supportOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  supportSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  hoursCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  hoursInfo: {
    flex: 1,
    marginLeft: 16,
  },
  hoursTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  hoursText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  faqContainer: {
    paddingHorizontal: 20,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 12,
  },
  expandIcon: {
    transform: [{ rotate: '0deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '90deg' }],
  },
  faqAnswer: {
    paddingHorizontal: 52,
    paddingBottom: 20,
  },
  answerText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  contactInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    textAlignVertical: 'top',
    minHeight: 100,
    fontSize: 15,
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: '#5A47FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});