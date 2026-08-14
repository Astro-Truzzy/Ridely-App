import { Linking, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getAuthRedirectUrl } from '@/lib/authRedirect';

export async function openEmailApp(): Promise<void> {
  const candidates =
    Platform.OS === 'ios'
      ? ['message://', 'googlegmail://', 'ms-outlook://', 'mailto:']
      : ['googlegmail://', 'https://mail.google.com', 'mailto:'];

  for (const url of candidates) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // try the next inbox URL
    }
  }

  await Linking.openURL('mailto:');
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  const trimmed = email.trim();
  if (!trimmed) {
    throw new Error('Enter the email you used to sign up first.');
  }
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmed,
    options: { emailRedirectTo: getAuthRedirectUrl('callback') },
  });
  if (error) throw error;
}
