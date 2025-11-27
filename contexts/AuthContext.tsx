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
  avatar_url?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: any | null;
  userType: 'user' | 'rider' | null;
  loading: boolean;
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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setUserType(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setUserType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    console.log('Loading user profile for userId:', userId);
    try {
      // Check if user is a rider first
      const { data: riderData, error: riderError } = await supabase
        .from('riders')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('Rider data:', riderData, 'Rider error:', riderError);

      if (riderData && !riderError) {
        setUserProfile(riderData);
        setUserType('rider');
        console.log('User is a rider');
        return;
      }

      // Check if user is a regular user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      console.log('User data:', userData, 'User error:', userError);

      if (userData && !userError) {
        setUserProfile(userData);
        setUserType('user');
        console.log('User is a regular user');
      } else {
        console.log('No user profile found for userId:', userId);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
    // Remove setLoading(false) from here since we want to keep loading true
    // until navigation completes in signIn
  };

  const signUp = async (
    email: string,
    password: string,
    userData: any,
    userType: 'user' | 'rider'
  ) => {
    setLoading(true);

    try {
      // 1. Sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation for now
        },
      });

      if (error) {
        // Handle specific case where user already exists in Supabase Auth
        if (error.message.includes('already registered')) {
          throw new Error(
            'An account with this email already exists. Please try signing in instead.'
          );
        }
        throw error;
      }

      // Check if we received user data from signUp
      if (!data.user) {
        throw new Error('No user data received from sign up');
      }

      // Use the user data from signUp directly instead of signing in again
      const userId = data.user.id;
      if (!userId) {
        throw new Error('No user ID received from sign up');
      }

      // 4. Insert profile
      type ProfileData = {
        id: string;
        email: string;
        full_name: string;
        phone: string;
      };

      const profileData: ProfileData = {
        id: userId,
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

      // Update session state
      setSession(data.session);
      setUser(data.user);

      // Set loading to false before returning
      setLoading(false);
    } catch (error) {
      console.error('Signup error:', error);

      // Additional cleanup for specific error cases
      if (
        error instanceof Error &&
        error.message.includes('An account with this email already exists')
      ) {
        // Supabase cleanup is handled in the profileError block
        // Here we just need to ensure loading state is reset
        setLoading(false);
        throw error;
      }

      // General error case
      setLoading(false);
      throw new Error(
        `Registration failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
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

      // Load user profile
      if (data.user) {
        console.log('Loading profile for user:', data.user.id);
        await loadUserProfile(data.user.id);

        // After successful sign in and profile load, navigate to home
        // We'll handle navigation before setting loading to false
        if (userType === 'rider') {
          router.push('/(rider)/dashboard');
        } else {
          router.push('/(tabs)');
        }
      } else {
        console.log('No user in sign in response');
        setLoading(false);
      }
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

      const { error } = await supabase
        .from(table)
        .update(updates)
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

  const value: AuthContextType = {
    session,
    user,
    userProfile,
    userType,
    loading,
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
