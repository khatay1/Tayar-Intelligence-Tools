import { usePreferences } from '@/context/PreferencesContext';
import { useCallback } from 'react';
import { localizeUi } from './ui-localization-complete-data';
export { localizeUi, arSupplement, svSupplement } from './ui-localization-complete-data';

export function useLocalizer() {
  const { prefs } = usePreferences();
  const language = prefs.language;
  return useCallback((text: string) => localizeUi(text, language), [language]);
}
