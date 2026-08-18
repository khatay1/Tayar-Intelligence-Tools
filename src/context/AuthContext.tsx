import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  plan: string;
  language: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, plan, language')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return;
    }

    if (data) {
      setProfile(data as Profile);
    } else {
      const { data: userData } = await supabase.auth.getUser();

      const fullName =
        userData.user?.user_metadata?.full_name || '';

      const avatarUrl =
        userData.user?.user_metadata?.avatar_url || null;

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: fullName,
          avatar_url: avatarUrl,
          plan: 'free',
          language: 'en',
        })
        .select('id, full_name, avatar_url, plan, language')
        .maybeSingle();

      if (createError) {
        console.error('Failed to create profile:', createError);
        return;
      }

      if (created) {
        setProfile(created as Profile);
      }
    }
  }

  useEffect(() => {
  let mounted = true;

  async function initializeAuth() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (!mounted) return;

    if (error) {
      console.error('[AUTH] getSession error:', error);
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    console.log('[AUTH] Initial session:', session?.user?.id ?? 'NO SESSION');

    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      await fetchProfile(session.user.id);
    }

    if (mounted) {
      setLoading(false);
    }
  }

  initializeAuth();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!mounted) return;

    console.log(
      '[AUTH] Auth state change:',
      event,
      session?.user?.id ?? 'NO USER'
    );

    setSession(session);
    setUser(session?.user ?? null);

    if (!session?.user) {
      setProfile(null);
    }
  });

  return () => {
    mounted = false;
    subscription.unsubscribe();
  };
}, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      error: error?.message ?? null,
    };
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string
  ) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    return {
      error: error?.message ?? null,
    };
  }

  async function signOut() {
    await supabase.auth.signOut();

    setSession(null);
    setUser(null);
    setProfile(null);
  }

  async function resetPassword(email: string) {
    const { error } =
      await supabase.auth.resetPasswordForEmail(email);

    return {
      error: error?.message ?? null,
    };
  }

  async function updatePassword(newPassword: string) {
    const { error } =
      await supabase.auth.updateUser({
        password: newPassword,
      });

    return {
      error: error?.message ?? null,
    };
  }

  async function resendVerification(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo:
          window.location.origin + '#login',
      },
    });

    return {
      error: error?.message ?? null,
    };
  }

  async function updateProfile(
    updates: Partial<Profile>
  ) {
    if (!user) {
      return {
        error: 'Not authenticated',
      };
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      return {
        error: error.message,
      };
    }

    setProfile((prev) =>
      prev ? { ...prev, ...updates } : prev
    );

    return {
      error: null,
    };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        resendVerification,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}