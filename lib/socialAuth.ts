import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

export type OAuthProvider = 'google' | 'facebook' | 'apple';
export type OAuthResult = 'success' | 'cancel';

export type StartOAuthOptions = {
  /** Signup only: create a customer or rider profile after Google auth. */
  userType?: 'user' | 'rider';
};

const OAUTH_REDIRECT_PATH = '/oauth-callback';
const OAUTH_USER_TYPE_KEY = '@ridely/oauth_user_type';

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  const key =
    provider === 'google'
      ? process.env.EXPO_PUBLIC_OAUTH_GOOGLE_ENABLED
      : provider === 'facebook'
        ? process.env.EXPO_PUBLIC_OAUTH_FACEBOOK_ENABLED
        : process.env.EXPO_PUBLIC_OAUTH_APPLE_ENABLED;
  return parseBoolean(key);
}

export function getEnabledOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = ['google', 'facebook', 'apple'];
  return providers.filter(isOAuthProviderEnabled);
}

export function getOAuthRedirectUri(): string {
  return Linking.createURL(OAUTH_REDIRECT_PATH);
}

function parseRedirectParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryPart = url.includes('?') ? url.split('?').slice(1).join('?').split('#')[0] : '';
  const hashPart = url.includes('#') ? url.split('#').slice(1).join('#') : '';
  const combined = [queryPart, hashPart].filter(Boolean).join('&');

  for (const part of combined.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const key = eq === -1 ? part : part.slice(0, eq);
    const val = eq === -1 ? '' : part.slice(eq + 1);
    params[decodeURIComponent(key)] = decodeURIComponent(val);
  }

  return params;
}

export async function createSessionFromRedirectUrl(url: string): Promise<void> {
  const params = parseRedirectParams(url);

  if (params.error) {
    throw new Error(params.error_description || params.error);
  }

  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return;
  }

  if (params.token_hash && params.type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
    });
    if (error) throw error;
    return;
  }

  const code = params.code;
  if (!code) {
    throw new Error('This link is missing sign-in details. Open it from your email and try again.');
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

export async function ensureOAuthProfile(
  userTypeOverride?: 'user' | 'rider',
): Promise<'user' | 'rider'> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('No authenticated user after social sign-in.');

  const { data: existingRider } = await supabase
    .from('riders')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (existingRider) return 'rider';

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (existingUser) return 'user';

  const storedType = await AsyncStorage.getItem(OAUTH_USER_TYPE_KEY);
  await AsyncStorage.removeItem(OAUTH_USER_TYPE_KEY);

  const userType =
    userTypeOverride ??
    (storedType === 'rider' ? 'rider' : 'user');

  const meta = user.user_metadata ?? {};
  const fullName =
    meta.full_name ||
    meta.fullName ||
    meta.name ||
    user.email?.split('@')[0] ||
    'User';
  const phone = meta.phone || '';
  const avatarUrl = meta.avatar_url || meta.picture || null;

  const table = userType === 'rider' ? 'riders' : 'users';
  const { error: profileError } = await supabase.from(table).insert({
    id: user.id,
    email: user.email || '',
    full_name: fullName,
    phone,
    avatar_url: avatarUrl,
  } as never);

  if (profileError && profileError.code !== '23505') {
    throw profileError;
  }

  await supabase.auth.updateUser({
    data: {
      userType,
      fullName,
      phone,
    },
  });

  return userType;
}

export async function startOAuth(
  provider: OAuthProvider,
  options: StartOAuthOptions = {},
): Promise<OAuthResult> {
  if (!isOAuthProviderEnabled(provider)) {
    throw new Error(`${provider} auth is disabled. Enable it in env config first.`);
  }

  if (options.userType) {
    await AsyncStorage.setItem(OAUTH_USER_TYPE_KEY, options.userType);
  } else {
    await AsyncStorage.removeItem(OAUTH_USER_TYPE_KEY);
  }

  const redirectTo = getOAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      ...(provider === 'google'
        ? { queryParams: { access_type: 'offline', prompt: 'select_account' } }
        : {}),
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No OAuth URL returned by Supabase.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    await AsyncStorage.removeItem(OAUTH_USER_TYPE_KEY);
    return 'cancel';
  }

  if (result.type === 'success' && result.url) {
    await createSessionFromRedirectUrl(result.url);
    await ensureOAuthProfile(options.userType);
    return 'success';
  }

  await AsyncStorage.removeItem(OAUTH_USER_TYPE_KEY);
  throw new Error('Unexpected OAuth result. Please try again.');
}

export async function completeOAuthFromDeepLink(url: string): Promise<'user' | 'rider'> {
  await createSessionFromRedirectUrl(url);
  return ensureOAuthProfile();
}
