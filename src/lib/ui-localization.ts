import { usePreferences } from '@/context/PreferencesContext';
import { useCallback } from 'react';
import { localizeUi } from './ui-localization-data';
export { localizeUi } from './ui-localization-data';

export function useLocalizer() {
  const { prefs } = usePreferences();
  const language = prefs.language;
  return useCallback((text: string) => localizeUi(text, language), [language]);
}
