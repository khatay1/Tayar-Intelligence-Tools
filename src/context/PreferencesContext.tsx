import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

export type Theme = 'dark' | 'light';
export type Language = 'en' | 'ar' | 'sv';

export interface UserPreferences {
  theme: Theme;
  language: Language;
  email_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  theme: 'dark',
  language: 'en',
  email_notifications: true,
  push_notifications: true,
  marketing_emails: false,
};

interface PreferencesContextValue {
  prefs: UserPreferences;
  loading: boolean;
  updatePrefs: (updates: Partial<UserPreferences>) => Promise<void>;
  setTheme: (theme: Theme) => void;
  setLanguage: (lang: Language) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  // Load from localStorage immediately for instant theme/lang
  useEffect(() => {
    const stored = localStorage.getItem('tayar-prefs');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPrefs(prev => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    }
  }, []);

  // Load from DB when user is available
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const dbPrefs: UserPreferences = {
            theme: data.theme as Theme,
            language: data.language as Language,
            email_notifications: data.email_notifications,
            push_notifications: data.push_notifications,
            marketing_emails: data.marketing_emails,
          };
          setPrefs(dbPrefs);
          localStorage.setItem('tayar-prefs', JSON.stringify(dbPrefs));
        }
        setLoading(false);
      });
  }, [user]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [prefs.theme]);

  // Apply language/direction to document
  useEffect(() => {
    document.documentElement.lang = prefs.language;
    document.documentElement.dir = prefs.language === 'ar' ? 'rtl' : 'ltr';
  }, [prefs.language]);

  const updatePrefs = useCallback(async (updates: Partial<UserPreferences>) => {
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    localStorage.setItem('tayar-prefs', JSON.stringify(newPrefs));
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        ...newPrefs,
      }, { onConflict: 'user_id' });
    }
  }, [prefs, user]);

  const setTheme = useCallback((theme: Theme) => {
    updatePrefs({ theme });
  }, [updatePrefs]);

  const setLanguage = useCallback((language: Language) => {
    updatePrefs({ language });
  }, [updatePrefs]);

  return (
    <PreferencesContext.Provider value={{ prefs, loading, updatePrefs, setTheme, setLanguage }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
