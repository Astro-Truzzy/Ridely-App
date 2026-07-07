import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  FileText,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { LEGAL_LAST_UPDATED } from '@/lib/legal';

export default function TermsOfServiceScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const termsSections = [
    {
      title: 'Acceptance of Terms',
      content: `By accessing or using the Ridely Rider application, you agree to be bound by these 
      Terms of Service and all applicable laws and regulations. If you do not agree with any of 
      these terms, you are prohibited from using or accessing this app.`
    },
    {
      title: 'Eligibility',
      content: `To use the Ridely Rider services, you must:\n\n
      • Be at least 18 years old\n
      • Have a valid driver's license\n
      • Own or have permission to use a motorcycle that meets our requirements\n
      • Pass our background check and vehicle inspection\n
      • Maintain valid insurance coverage\n
      • Have the legal right to work in the country where you operate`
    },
    {
      title: 'Account Responsibilities',
      content: `You are responsible for maintaining the confidentiality of your account and password. 
      You agree to accept responsibility for all activities that occur under your account. 
      You must notify us immediately of any unauthorized use of your account.`
    },
    {
      title: 'Rider Obligations',
      content: `As a Ridely rider, you agree to:\n\n
      • Provide safe and professional delivery services\n
      • Maintain your vehicle in good working condition\n
      • Follow all traffic laws and regulations\n
      • Treat customers with respect and courtesy\n
      • Keep customer information confidential\n
      • Accept and complete deliveries as agreed\n
      • Report any issues or incidents promptly`
    },
    {
      title: 'Fees and Payments',
      content: `Ridely charges a 15% service fee on each delivery. Earnings are calculated based on 
      delivery distance, time, and other factors. Payments are processed weekly and deposited 
      directly into your bank account. You are responsible for any taxes associated with your earnings.`
    },
    {
      title: 'Termination',
      content: `We may suspend or terminate your account at any time for any reason, including but not 
      limited to violation of these terms, safety concerns, or legal requirements. You may terminate 
      your account at any time through the app settings.`
    },
    {
      title: 'Limitation of Liability',
      content: `Ridely shall not be liable for any indirect, incidental, special, consequential or 
      punitive damages, including without limitation, loss of profits, data, use, goodwill, or 
      other intangible losses, resulting from your access to or use of or inability to access or 
      use the services.`
    },
    {
      title: 'Changes to Terms',
      content: `We reserve the right to modify or replace these Terms at any time. We will provide 
      notice of any significant changes by posting the new Terms in the app and updating the 
      effective date below. Your continued use of the app after any such changes constitutes 
      acceptance of the new Terms.`
    }
  ];

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
        <Text style={[styles.title, { color: theme.colors.text }]}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <View style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
              <FileText size={32} color={theme.colors.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.policyTitle, { color: theme.colors.text }]}>Terms of Service</Text>
            <Text style={[styles.policySubtitle, { color: theme.colors.textSecondary }]}>
              Last updated: {LEGAL_LAST_UPDATED}
            </Text>
          </View>

          <View style={styles.sectionsContainer}>
            {termsSections.map((section, index) => (
              <View 
                key={index} 
                style={[styles.section, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
                <Text style={[styles.sectionContent, { color: theme.colors.textSecondary }]}>
                  {section.content}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
              By using Ridely Rider services, you acknowledge that you have read, understood, 
              and agree to be bound by these Terms of Service.
            </Text>
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
  contentContainer: {
    paddingBottom: 32,
  },
  headerCard: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  policyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  policySubtitle: {
    fontSize: 14,
  },
  sectionsContainer: {
    marginHorizontal: 20,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});