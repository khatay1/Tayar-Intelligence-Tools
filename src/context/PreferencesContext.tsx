import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
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
  language: 'ar',
  email_notifications: true,
  push_notifications: true,
  marketing_emails: false,
};

function normalizePreferences(value: unknown, fallback: UserPreferences): UserPreferences {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<UserPreferences> : {};
  return {
    theme: raw.theme === 'dark' || raw.theme === 'light' ? raw.theme : fallback.theme,
    language: raw.language === 'en' || raw.language === 'ar' || raw.language === 'sv' ? raw.language : fallback.language,
    email_notifications: typeof raw.email_notifications === 'boolean' ? raw.email_notifications : fallback.email_notifications,
    push_notifications: typeof raw.push_notifications === 'boolean' ? raw.push_notifications : fallback.push_notifications,
    marketing_emails: typeof raw.marketing_emails === 'boolean' ? raw.marketing_emails : fallback.marketing_emails,
  };
}

function storePreferences(prefs: UserPreferences) {
  try { localStorage.setItem('tayar-prefs', JSON.stringify(prefs)); } catch { /* Keep in-memory preferences when storage is blocked. */ }
}

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
  const userId = user?.id;
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const prefsRef = useRef(prefs);
  const editRevision = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    try {
      const next = normalizePreferences(JSON.parse(localStorage.getItem('tayar-prefs') || 'null'), DEFAULT_PREFS);
      prefsRef.current = next;
      setPrefs(next);
    } catch { /* Private browsing and malformed stored data must not crash the app. */ }
  }, []);

  useEffect(() => {
    let active = true;
    const revision = editRevision.current;
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    void Promise.resolve(supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle())
      .then(({ data, error }) => {
        if (!active || revision !== editRevision.current || error || !data) return;
        const next = normalizePreferences(data, prefsRef.current);
        prefsRef.current = next;
        setPrefs(next);
        storePreferences(next);
      })
      .catch(() => { /* Stored device preferences remain usable offline. */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

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
    editRevision.current += 1;
    const next = normalizePreferences(updates, prefsRef.current);
    prefsRef.current = next;
    setPrefs(next);
    storePreferences(next);
    if (userId) {
      // Serialize saves so an older language/theme write cannot finish last.
      const save = saveQueue.current.catch(() => undefined).then(async () => {
        const { error } = await supabase.from('user_preferences').upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
        if (error) console.warn('Could not sync preferences:', error.message);
      }).catch(() => { /* Device preferences remain available if the network fails. */ });
      saveQueue.current = save;
      await save;
    }
  }, [userId]);

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

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
