import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Shield,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function PrivacyPolicyScreen() {
  const { theme } = useTheme();

  const privacySections = [
    {
      title: 'Information We Collect',
      content: `We collect information you provide directly to us, such as when you create an account, 
      update your profile, or communicate with us. This includes your name, email address, phone number, 
      vehicle information, and payment details.\n\nWe also collect information automatically, such as 
      location data, device information, and usage data when you interact with our services.`
    },
    {
      title: 'How We Use Your Information',
      content: `We use your information to provide, maintain, and improve our services. This includes:\n\n
      • Facilitating delivery requests and connecting you with customers\n
      • Processing payments and managing your earnings\n
      • Communicating with you about your account and services\n
      • Providing customer support\n
      • Ensuring safety and security of our platform\n
      • Complying with legal obligations`
    },
    {
      title: 'Information Sharing',
      content: `We may share your information with:\n\n
      • Customers for delivery purposes\n
      • Payment processors to facilitate transactions\n
      • Law enforcement when required by law\n
      • Third-party service providers who assist us in operating our platform\n\n
      We do not sell your personal information to third parties.`
    },
    {
      title: 'Data Security',
      content: `We implement industry-standard security measures to protect your information. 
      However, no method of transmission over the internet or electronic storage is 100% secure, 
      so we cannot guarantee absolute security.`
    },
    {
      title: 'Your Rights',
      content: `You have the right to:\n\n
      • Access and update your personal information\n
      • Request deletion of your data\n
      • Object to or restrict processing of your data\n
      • Data portability\n\n
      To exercise these rights, please contact us through the support section in the app.`
    },
    {
      title: 'Changes to This Policy',
      content: `We may update this privacy policy from time to time. We will notify you of any 
      changes by posting the new policy in the app and updating the effective date below. 
      We encourage you to review this policy periodically.`
    }
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.contentContainer}>
          <View style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Shield size={32} color={theme.colors.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.policyTitle, { color: theme.colors.text }]}>Privacy Policy</Text>
            <Text style={[styles.policySubtitle, { color: theme.colors.textSecondary }]}>
              Last updated: November 18, 2025
            </Text>
          </View>

          <View style={styles.sectionsContainer}>
            {privacySections.map((section, index) => (
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
              If you have any questions about this Privacy Policy, please contact us through the 
              Support section in the app or email us at privacy@ridely.com
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