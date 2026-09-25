import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  plan: string;
  language: string;
  role: 'user' | 'admin';
  suspended: boolean;
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
  const authRevision = useRef(0);
  const currentUserId = useRef<string | null>(null);

  async function isSignupAllowed() {
    const { data, error } = await supabase.rpc('is_signup_enabled');
    if (error) {
      return {
        allowed: false,
        error: 'Could not verify signup availability. Please try again.',
      };
    }

    return { allowed: data !== false, error: null };
  }

  async function isCurrentUserBlocked() {
    const { data, error } = await supabase.rpc('is_current_user_email_blocked');

    if (error) {
      return {
        blocked: false,
        error: 'Could not verify account access. Please try again.',
      };
    }

    return { blocked: data === true, error: null };
  }

  async function fetchProfile(userId: string, isCurrent: () => boolean) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, plan, language, role, suspended')
      .eq('id', userId)
      .maybeSingle();

    if (!isCurrent()) return;
    if (error) {
      console.error('Failed to fetch profile:', error);
      return;
    }

    if (data) {
      setProfile(data as Profile);
    } else {
      const { data: userData } = await supabase.auth.getUser();

      if (!isCurrent() || userData.user?.id !== userId) return;
      const fullName = userData.user?.user_metadata?.full_name || '';
      const avatarUrl = userData.user?.user_metadata?.avatar_url || null;

      const { data: created, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: fullName,
          avatar_url: avatarUrl,
          language: 'en',
        })
        .select('id, full_name, avatar_url, plan, language, role, suspended')
        .maybeSingle();

      if (!isCurrent()) return;
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
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const isCurrent = (revision: number) => mounted && authRevision.current === revision;

    async function applySession(nextSession: Session | null, revision: number) {
      if (!isCurrent(revision)) return;
      const userId = nextSession?.user.id ?? null;
      if (currentUserId.current !== userId) setProfile(null);
      currentUserId.current = userId;
      try {
        if (userId) {
          const blockState = await isCurrentUserBlocked();
          if (!isCurrent(revision)) return;
          if (blockState.error || blockState.blocked) {
            await supabase.auth.signOut();
            if (!isCurrent(revision)) return;
            nextSession = null;
            currentUserId.current = null;
            setProfile(null);
          }
        }
        if (!isCurrent(revision)) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        if (nextSession?.user) {
          await fetchProfile(nextSession.user.id, () => isCurrent(revision));
        }
      } catch (error) {
        if (!isCurrent(revision)) return;
        console.error('[AUTH] Session initialization failed:', error);
        setSession(null);
        setUser(null);
        setProfile(null);
        currentUserId.current = null;
      } finally {
        if (isCurrent(revision)) setLoading(false);
      }
    }

    const initialRevision = ++authRevision.current;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isCurrent(initialRevision)) return;
      if (error) console.error('[AUTH] getSession error:', error);
      return applySession(error ? null : data.session, initialRevision);
    }).catch((error) => {
      if (!isCurrent(initialRevision)) return;
      console.error('[AUTH] getSession failed:', error);
      void applySession(null, initialRevision);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      const revision = ++authRevision.current;
      if (event === 'PASSWORD_RECOVERY') window.location.hash = 'reset';
      if (!nextSession?.user) {
        currentUserId.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      if (currentUserId.current !== nextSession.user.id) {
        setProfile(null);
        setUser(null);
        setSession(null);
        setLoading(true);
      }
      // Defer Supabase calls until the auth callback releases its session lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        void applySession(nextSession, revision);
      }, 0);
      timers.add(timer);
    });

    return () => {
      mounted = false;
      authRevision.current += 1;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (data.session?.user) {
      const blockState = await isCurrentUserBlocked();
      if (blockState.error || blockState.blocked) {
        await supabase.auth.signOut();
        return {
          error: blockState.blocked
            ? 'This account is blocked. Contact support if you believe this is a mistake.'
            : blockState.error,
        };
      }
    }

    return { error: null };
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string
  ) {
    const signupState = await isSignupAllowed();
    if (signupState.error) return { error: signupState.error };
    if (!signupState.allowed) {
      return { error: 'New registrations are temporarily disabled.' };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
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
        redirectTo: new URL(window.location.pathname, window.location.origin).toString(),
      },
    });

    return {
      error: error?.message ?? null,
    };
  }

  async function signOut() {
    authRevision.current += 1;
    currentUserId.current = null;
    await supabase.auth.signOut();

    setSession(null);
    setUser(null);
    setProfile(null);
  }

  async function resetPassword(email: string) {
    const redirectUrl = new URL(window.location.pathname, window.location.origin);
    redirectUrl.searchParams.set('auth', 'recovery');

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: redirectUrl.toString() },
    );

    return {
      error: error?.message ?? null,
    };
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
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
        emailRedirectTo: window.location.origin + '#login',
      },
    });

    return {
      error: error?.message ?? null,
    };
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user) {
      return {
        error: 'Not authenticated',
      };
    }

    const safeUpdates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'language'>> = {};
    if (updates.full_name !== undefined) safeUpdates.full_name = updates.full_name;
    if (updates.avatar_url !== undefined) safeUpdates.avatar_url = updates.avatar_url;
    if (updates.language !== undefined) safeUpdates.language = updates.language;

    if (Object.keys(safeUpdates).length === 0) {
      return { error: null };
    }

    const userId = user.id;
    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', userId)
      .select('id')
      .single();

    if (error) {
      return {
        error: error.message,
      };
    }

    if (!data) return { error: 'Profile was not updated.' };
    if (currentUserId.current === userId) {
      setProfile((prev) => (prev?.id === userId ? { ...prev, ...safeUpdates } : prev));
    }

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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
