import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';

interface ProfileUpdates {
  full_name?: string;
  phone?: string;
  email?: string;
  avatar_url?: string | null;
  /** Rider-only: vehicle type (e.g. Motorcycle, Bike) */
  vehicle_type?: string;
  /** Rider-only: license plate number */
  plate_number?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: any | null;
  userType: 'user' | 'rider' | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    userData: any,
    userType: 'user' | 'rider'
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [userType, setUserType] = useState<'user' | 'rider' | null>(null);
  const [loading, setLoading] = useState(true);

  // Read role from JWT app_metadata when set by Custom Access Token hook (avoids DB hit for redirect)
  const getRoleFromSession = (s: Session | null): 'user' | 'rider' | null => {
    const ut = (s?.user?.app_metadata as { user_type?: string } | undefined)?.user_type;
    return ut === 'rider' || ut === 'user' ? ut : null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const jwtRole = getRoleFromSession(session);
        if (jwtRole) {
          setUserType(jwtRole);
          setLoading(false);
          loadUserProfile(session.user.id); // background: fill userProfile
        } else {
          const resolved = await loadUserProfile(session.user.id);
          if (resolved) setUserType(resolved);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setUserType(null);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const jwtRole = getRoleFromSession(session);
        if (jwtRole) {
          setUserType(jwtRole);
          setLoading(false);
          loadUserProfile(session.user.id);
        } else {
          const resolved = await loadUserProfile(session.user.id);
          if (resolved) setUserType(resolved);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setUserType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string): Promise<'user' | 'rider' | null> => {
    try {
      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('id', userId)
        .single();

      if (riderData && !riderError) {
        setUserProfile(riderData);
        setUserType('rider');
        return 'rider';
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData && !userError) {
        setUserProfile(userData);
        setUserType('user');
        return 'user';
      }
      return null;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    userData: any,
    userType: 'user' | 'rider'
  ) => {
    setLoading(true);

    try {
      // 1. Sign up with user metadata for profile creation
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation for now
          data: {
            fullName: userData.fullName,
            phone: userData.phone,
            userType: userType,
          },
        },
      });

      if (error) {
        // Handle various cases where user already exists
        const errorMessage = (error.message || '').toLowerCase();
        const errorCode = error.status || error.code || '';
        const errorString = String(errorCode).toLowerCase();
        
        // Check for various patterns that indicate user already exists
        const isExistingAccount = 
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already registered') ||
          errorMessage.includes('email already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('user already exists') ||
          errorMessage.includes('email address is already registered') ||
          errorString === '422' || // Unprocessable Entity
          errorString === 'user_already_registered';
        
        if (isExistingAccount) {
          setLoading(false);
          throw new Error('ACCOUNT_EXISTS: An account with this email already exists. Please sign in instead.');
        }
        
        // Handle other errors
        setLoading(false);
        throw error;
      }

      // Check if we received user data from signUp
      if (!data.user) {
        setLoading(false);
        throw new Error('No user data received from sign up');
      }

      const userId = data.user.id;
      if (!userId) {
        setLoading(false);
        throw new Error('No user ID received from sign up');
      }

      // Check if email confirmation is required (no session returned)
      // This is NOT an error - it's expected behavior when email confirmation is enabled
      if (!data.session) {
        // Email confirmation is enabled - this is normal for first-time signups
        // Profile will be created automatically via database trigger when email is confirmed
        setLoading(false);
        // Return a special success indicator instead of throwing an error
        return; // Success - user needs to check email
      }

      // We have a session, proceed with profile creation
      const activeSession = data.session;

      // Verify the session user ID matches the user ID we're inserting
      if (activeSession.user.id !== userId) {
        throw new Error('Session user ID does not match signup user ID');
      }

      // 4. Insert profile with active session
      // The id must match auth.uid() for RLS policy to allow the insert
      type ProfileData = {
        id: string;
        email: string;
        full_name: string;
        phone: string;
      };

      const profileData: ProfileData = {
        id: userId, // This must match auth.uid() for RLS to work
        email,
        full_name: userData.fullName,
        phone: userData.phone,
      };

      const table: 'riders' | 'users' = userType === 'rider' ? 'riders' : 'users';
      const { error: profileError } = await supabase
        .from(table)
        .insert([profileData] as any);

      if (profileError) {
        console.error('Profile creation error:', profileError);

        // Handle RLS policy violation (42501)
        if (profileError.code === '42501') {
          // Clean up the auth user we just created
          await supabase.auth.signOut();
          throw new Error(
            'Failed to create profile due to security policy. Please contact support.'
          );
        }

        // Handle duplicate email constraint error
        if (profileError.code === '23505') {
          // This is a duplicate key error
          // First, try to clean up the auth user we just created
          await supabase.auth.signOut();

          // Then throw a more user-friendly error
          throw new Error(
            'An account with this email already exists. Please try signing in instead.'
          );
        }

        throw profileError;
      }

      // Load the newly created profile
      await loadUserProfile(userId);

      // Update session state with the active session
      setSession(activeSession);
      setUser(activeSession.user);

      // Set loading to false before returning
      setLoading(false);
    } catch (error) {
      console.error('Signup error:', error);

      // Re-throw ACCOUNT_EXISTS errors as-is (they're already user-friendly)
      if (
        error instanceof Error &&
        (error.message.includes('ACCOUNT_EXISTS') ||
         error.message.includes('An account with this email already exists'))
      ) {
        setLoading(false);
        throw error;
      }

      // General error case - wrap in user-friendly message
      setLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't wrap if it's already a user-friendly message
      if (errorMessage.includes('ACCOUNT_EXISTS') || errorMessage.includes('EMAIL_CONFIRMATION')) {
        throw error;
      }

      // Auth "Database error updating user" usually means a trigger failed; run migration 20250632000000_handle_new_user_defensive.sql
      if (errorMessage.toLowerCase().includes('database error updating user')) {
        throw new Error(
          'Registration failed: a server configuration issue prevented creating your account. Please try again in a moment or contact support.'
        );
      }
      
      throw new Error(
        `Registration failed: ${errorMessage}`
      );
    }
  };

  const signIn = async (email: string, password: string) => {
    console.log('Attempting to sign in with email:', email);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        setLoading(false);
        throw error;
      }

      console.log('Sign in successful, session:', data.session);

      // Explicitly set the session and user data
      setSession(data.session);
      setUser(data.user);

      if (data.user) {
        let resolvedType = await loadUserProfile(data.user.id);

        if (!resolvedType && data.user.user_metadata) {
          const metadata = data.user.user_metadata;
          const userTypeFromMeta = metadata.userType || 'user';
          const table: 'riders' | 'users' = userTypeFromMeta === 'rider' ? 'riders' : 'users';
          const { error: profileError } = await supabase
            .from(table)
            .insert({
              id: data.user.id,
              email: data.user.email || '',
              full_name: metadata.fullName || metadata.full_name || 'User',
              phone: metadata.phone || '',
            } as any);

          if (!profileError) {
            resolvedType = await loadUserProfile(data.user.id);
          }
        }

        if (resolvedType === 'rider') {
          router.push('/(rider)/dashboard');
        } else {
          router.push('/(tabs)');
        }
      }
      setLoading(false);
    } catch (error: any) {
      console.error('Sign in error:', error);
      setLoading(false);

      // Provide more specific error messages
      if (error.message?.includes('Invalid login credentials')) {
        throw new Error(
          'Invalid email or password. Please check your credentials and try again.'
        );
      } else if (error.message?.includes('Email not confirmed')) {
        throw new Error('Please confirm your email address before signing in.');
      }

      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        throw error;
      }
      // Clear local auth state after successful sign out
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setUserType(null);
      // Navigate to auth/login screen
      try {
        router.replace('/(auth)/login');
      } catch (navErr) {
        // ignore navigation errors in non-router contexts
        console.warn('Navigation after signOut failed:', navErr);
      }
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: ProfileUpdates) => {
    try {
      if (!user || !userType) throw new Error('No user logged in');

      const table = userType === 'rider' ? 'riders' : 'users';

      // Create a copy of updates without undefined values to avoid type issues
      const updatesToApply: Record<string, any> = {};
      if (updates.full_name !== undefined) updatesToApply.full_name = updates.full_name;
      if (updates.phone !== undefined) updatesToApply.phone = updates.phone;
      if (updates.email !== undefined) updatesToApply.email = updates.email;
      if (updates.avatar_url !== undefined) updatesToApply.avatar_url = updates.avatar_url;
      if (table === 'riders') {
        if (updates.vehicle_type !== undefined) updatesToApply.vehicle_type = updates.vehicle_type;
        if (updates.plate_number !== undefined) updatesToApply.plate_number = updates.plate_number;
      }

      const { error } = await (supabase as any)
        .from(table)
        .update(updatesToApply)
        .eq('id', user.id);

      if (error) {
        console.error('Profile update error:', error);
        throw error;
      }

      // Reload profile
      await loadUserProfile(user.id);
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await loadUserProfile(user.id);
  };

  const value: AuthContextType = {
    session,
    user,
    userProfile,
    userType,
    loading,
    refreshProfile,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}