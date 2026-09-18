import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/context/AuthContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import WebsiteBuilderTool from '@/modules/website-builder/WebsiteBuilderTool';
import '@/index.css';

localStorage.clear();
localStorage.setItem('tayar-prefs', JSON.stringify({
  theme: 'dark',
  language: 'en',
  email_notifications: false,
  push_notifications: false,
  marketing_emails: false,
}));

document.documentElement.lang = 'en';
document.documentElement.dir = 'ltr';
document.body.style.margin = '0';
document.body.style.height = '100vh';
document.body.style.overflow = 'hidden';

const root = document.getElementById('root');
if (!root) throw new Error('Website Builder regression root is missing.');
root.style.height = '100vh';

createRoot(root).render(
  <AuthProvider>
    <PreferencesProvider>
      <WebsiteBuilderTool darkMode />
    </PreferencesProvider>
  </AuthProvider>,
);
