import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/context/AuthContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import MediaStudioMax from '@/modules/media-studio-max/MediaStudioMax';
import type { Language } from '@/lib/i18n';
import '@/index.css';

const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
const language: Language = requestedLanguage === 'ar' || requestedLanguage === 'sv' ? requestedLanguage : 'en';

localStorage.clear();
localStorage.setItem('tayar-prefs', JSON.stringify({
  theme: 'dark',
  language,
  email_notifications: false,
  push_notifications: false,
  marketing_emails: false,
}));

document.documentElement.lang = language;
document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
document.body.style.margin = '0';
document.body.style.minHeight = '100vh';

const root = document.getElementById('root');
if (!root) throw new Error('Media Studio MAX regression root is missing.');
root.style.minHeight = '100vh';
root.style.padding = '24px';

createRoot(root).render(
  <AuthProvider>
    <PreferencesProvider>
      <MediaStudioMax darkMode />
    </PreferencesProvider>
  </AuthProvider>,
);
