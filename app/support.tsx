import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

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
      action: () => Alert.alert('Live Chat', 'Connecting to support...'),
      color: '#5A47FF',
    },
    {
      icon: Phone,
      title: 'Call Support',
      subtitle: 'Speak with a representative',
      action: () => Alert.alert('Call Support', 'Calling +1 (555) 123-HELP...'),
      color: '#10B981',
    },
    {
      icon: Mail,
      title: 'Email Support',
      subtitle: 'Send us an email',
      action: () => Alert.alert('Email Support', 'Opening email client...'),
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Immediate Help?</Text>
          <View style={styles.supportOptions}>
            {supportOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.supportOption}
                onPress={option.action}>
                <View style={[styles.supportIcon, { backgroundColor: option.color }]}>
                  <option.icon size={24} color="#FFFFFF" strokeWidth={2} />
                </View>
                <View style={styles.supportInfo}>
                  <Text style={styles.supportTitle}>{option.title}</Text>
                  <Text style={styles.supportSubtitle}>{option.subtitle}</Text>
                </View>
                <ChevronRight size={20} color="#D1D5DB" strokeWidth={2} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Business Hours */}
        <View style={styles.section}>
          <View style={styles.hoursCard}>
            <Clock size={24} color="#5A47FF" strokeWidth={2} />
            <View style={styles.hoursInfo}>
              <Text style={styles.hoursTitle}>Support Hours</Text>
              <Text style={styles.hoursText}>Monday - Friday: 8 AM - 8 PM</Text>
              <Text style={styles.hoursText}>Weekend: 9 AM - 6 PM</Text>
            </View>
            <View style={styles.statusBadge}>
              <CheckCircle size={16} color="#10B981" strokeWidth={2} />
              <Text style={styles.statusText}>Open</Text>
            </View>
          </View>
        </View>

        {/* Search FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.searchContainer}>
            <Search size={20} color="#6B7280" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for help..."
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
              style={styles.faqItem}
              onPress={() => toggleFAQ(faq.id)}>
              <View style={styles.faqHeader}>
                <HelpCircle size={20} color="#5A47FF" strokeWidth={2} />
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <View style={[
                  styles.expandIcon,
                  expandedFAQ === faq.id && styles.expandIconRotated,
                ]}>
                  <ChevronRight size={16} color="#6B7280" strokeWidth={2} />
                </View>
              </View>
              {expandedFAQ === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.answerText}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {filteredFAQs.length === 0 && searchQuery && (
          <View style={styles.noResults}>
            <HelpCircle size={48} color="#D1D5DB" strokeWidth={2} />
            <Text style={styles.noResultsTitle}>No results found</Text>
            <Text style={styles.noResultsText}>
              Try different keywords or contact our support team for help.
            </Text>
          </View>
        )}

        {/* Contact Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Still Need Help?</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>Send us a message</Text>
            <Text style={styles.contactSubtitle}>
              Describe your issue and we'll get back to you as soon as possible.
            </Text>
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={() => Alert.alert('Contact Form', 'Contact form coming soon!')}>
              <MessageCircle size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.contactButtonText}>Contact Support</Text>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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