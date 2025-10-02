import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';

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
  updateProfile: (updates: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
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
    } finally {
      setLoading(false);
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
      // 1. Sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation for now
        },
      });

      if (error) throw error;

      // 2. Sign in (to get auth.uid() for RLS)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // 3. Get the current user (now authenticated)
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('No user session after sign in');

      // 4. Insert profile
      const profileData = {
        id: userId,
        email,
        full_name: userData.fullName,
        phone: userData.phone,
      };

      const table = userType === 'rider' ? 'riders' : 'users';
      const { error: profileError } = await supabase
        .from(table)
        .insert([profileData]);
      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      // Load the newly created profile
      await loadUserProfile(userId);
    } catch (error) {
      console.error('Signup error:', error);
      setLoading(false);
      throw error;
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
      } else {
        console.log('No user in sign in response');
        setLoading(false);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
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
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: any) => {
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
