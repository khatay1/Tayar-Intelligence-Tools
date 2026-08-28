import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { OnboardingState, DEFAULT_ONBOARDING, ACHIEVEMENTS } from '@/lib/onboarding-types';

interface OnboardingContextValue {
  state: OnboardingState;
  loading: boolean;
  needsOnboarding: boolean;
  updateState: (updates: Partial<OnboardingState>) => Promise<void>;
  unlockAchievement: (id: string) => Promise<void>;
  hasAchievement: (id: string) => boolean;
  recordTourStep: (stepId: string) => Promise<void>;
  completeTour: () => Promise<void>;
  skipTour: () => Promise<void>;
  completeWizard: (data: Partial<OnboardingState>) => Promise<void>;
  markSampleSeeded: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadState = useCallback(async () => {
    if (!user) {
      setState(DEFAULT_ONBOARDING);
      setLoading(false);
      setNeedsOnboarding(false);
      return;
    }
    const { data } = await supabase
      .from('user_onboarding')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const loaded: OnboardingState = {
        user_type: data.user_type || '',
        full_name: data.full_name || '',
        country: data.country || '',
        profession: data.profession || '',
        main_goal: data.main_goal || '',
        language: data.language || 'en',
        recommended_tools: data.recommended_tools || [],
        tour_completed: data.tour_completed || false,
        tour_skipped: data.tour_skipped || false,
        tour_steps_seen: data.tour_steps_seen || [],
        wizard_completed: data.wizard_completed || false,
        achievements: data.achievements || {},
        progress: data.progress || 0,
        sample_content_seeded: data.sample_content_seeded || false,
      };
      setState(loaded);
      setNeedsOnboarding(!loaded.wizard_completed);
    } else {
      setState(DEFAULT_ONBOARDING);
      setNeedsOnboarding(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const updateState = useCallback(async (updates: Partial<OnboardingState>) => {
  if (!user) return;

  const newState = { ...state, ...updates };


  const { error } = await supabase
    .from('user_onboarding')
    .upsert(
      {
        user_id: user.id,
        user_type: newState.user_type,
        full_name: newState.full_name,
        country: newState.country,
        profession: newState.profession,
        main_goal: newState.main_goal,
        language: newState.language,
        recommended_tools: newState.recommended_tools,
        tour_completed: newState.tour_completed,
        tour_skipped: newState.tour_skipped,
        tour_steps_seen: newState.tour_steps_seen,
        wizard_completed: newState.wizard_completed,
        achievements: newState.achievements,
        progress: newState.progress,
        sample_content_seeded: newState.sample_content_seeded,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('🔴 user_onboarding upsert FAILED:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return;
  }


  setState(newState);
}, [user, state]);
    
const unlockAchievement = useCallback(async (id: string) => {
    if (!user || state.achievements[id]) return;
    const achievements = { ...state.achievements, [id]: new Date().toISOString() };
    await updateState({ achievements });
  }, [user, state, updateState]);

  const hasAchievement = useCallback((id: string) => !!state.achievements[id], [state]);

  const recordTourStep = useCallback(async (stepId: string) => {
    if (!user || state.tour_steps_seen.includes(stepId)) return;
    const steps = [...state.tour_steps_seen, stepId];
    await updateState({ tour_steps_seen: steps });
  }, [user, state, updateState]);

  const completeTour = useCallback(async () => {
    await updateState({ tour_completed: true, tour_skipped: false });
  }, [updateState]);

  const skipTour = useCallback(async () => {
    await updateState({ tour_skipped: true, tour_completed: true });
  }, [updateState]);

  const completeWizard = useCallback(async (data: Partial<OnboardingState>) => {
    if (!user) return;
    const progress = 100;
    const achievements = { ...state.achievements, first_login: new Date().toISOString() };
    await updateState({ ...data, wizard_completed: true, progress, achievements });
    setNeedsOnboarding(false);
  }, [user, state, updateState]);

  const markSampleSeeded = useCallback(async () => {
    await updateState({ sample_content_seeded: true });
  }, [updateState]);

  return (
    <OnboardingContext.Provider value={{
      state, loading, needsOnboarding,
      updateState, unlockAchievement, hasAchievement,
      recordTourStep, completeTour, skipTour, completeWizard, markSampleSeeded,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}

export { ACHIEVEMENTS };
