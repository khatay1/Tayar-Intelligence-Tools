import type { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';

type SignUpResult = { needsEmailConfirmation: boolean };

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<SignUpResult>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function linkParam(url: URL, key: string) {
  const direct = url.searchParams.get(key);
  if (direct) return direct;
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  return hash ? new URLSearchParams(hash).get(key) : null;
}

async function handleIncomingUrl(rawUrl: string) {
  if (!rawUrl.startsWith('tayartools://')) return;
  const url = new URL(rawUrl);

  if (url.hostname === 'billing') {
    router.replace('/(tabs)/profile');
    return;
  }

  if (url.hostname !== 'auth' || !url.pathname.includes('callback')) return;

  const errorDescription = linkParam(url, 'error_description');
  if (errorDescription) throw new Error(errorDescription);

  const code = linkParam(url, 'code');
  const accessToken = linkParam(url, 'access_token');
  const refreshToken = linkParam(url, 'refresh_token');
  const type = linkParam(url, 'type');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  } else {
    return;
  }

  router.replace(type === 'recovery' ? '/reset-password' : '/(tabs)/home');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    void Linking.getInitialURL().then((url) => {
      if (url) void handleIncomingUrl(url).catch((error) => console.warn('[mobile-auth] deep link failed', error instanceof Error ? error.message : 'unknown'));
    });
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url).catch((error) => console.warn('[mobile-auth] deep link failed', error instanceof Error ? error.message : 'unknown'));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    },
    signUp: async (email, password, fullName) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
        },
      });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    },
    resetPassword: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
