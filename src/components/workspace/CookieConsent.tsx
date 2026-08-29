import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect } from 'react';
import { Cookie, X, Check, Settings } from 'lucide-react';

interface CookiePreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export default function CookieConsent() {
  const l = useLocalizer();
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState<CookiePreferences>({ necessary: true, analytics: false, marketing: false });

  useEffect(() => {
    const consent = localStorage.getItem('tayar-cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
    try {
      const saved = JSON.parse(consent);
      setPrefs({ necessary: true, analytics: saved.analytics === true, marketing: saved.marketing === true });
    } catch {
      // ignore
    }
  }, []);

  function save(p: CookiePreferences) {
    localStorage.setItem('tayar-cookie-consent', JSON.stringify(p));
    window.dispatchEvent(new CustomEvent('tayar-cookie-consent-changed', { detail: p }));
    setVisible(false);
  }

  function handleAcceptAll() {
    save({ necessary: true, analytics: true, marketing: true });
  }

  function handleDeclineAll() {
    save({ necessary: true, analytics: false, marketing: false });
  }

  function handleSavePreferences() {
    save(prefs);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:max-w-md z-[100] animate-[fadeInUp_0.3s_ease-out]" role="dialog" aria-label={l('Cookie consent')} aria-live="polite">
      <div className="bg-[#12122a] border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white text-sm font-semibold mb-1">{l('Cookie Consent')}</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              We use cookies to improve your experience, analyze traffic, and personalize content. You can choose which cookies to accept. See our{' '}
              <button onClick={() => window.location.hash = 'privacy'} className="text-violet-400 hover:text-violet-300 underline">{l('Privacy Policy')}</button>.
            </p>
          </div>
          <button onClick={() => setVisible(false)} className="text-gray-500 hover:text-white flex-shrink-0" aria-label={l('Close cookie consent')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {showSettings && (
          <div className="mb-4 space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white text-xs font-medium">{l('Necessary')}</span>
                <span className="text-gray-600 text-xs ml-1">(required)</span>
              </div>
              <div className="w-9 h-5 rounded-full bg-violet-600 flex items-center justify-end pr-0.5">
                <span className="w-4 h-4 rounded-full bg-white" />
              </div>
            </div>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white text-xs font-medium">{l('Analytics')}</span>
              <input type="checkbox" checked={prefs.analytics} onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))} className="w-4 h-4 accent-violet-600" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white text-xs font-medium">{l('Marketing')}</span>
              <input type="checkbox" checked={prefs.marketing} onChange={e => setPrefs(p => ({ ...p, marketing: e.target.checked }))} className="w-4 h-4 accent-violet-600" />
            </label>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAcceptAll} className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
            <Check className="w-3.5 h-3.5" /> Accept All
          </button>
          <button onClick={handleDeclineAll} className="flex-1 text-gray-400 hover:text-white text-xs font-medium py-2 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
            Decline
          </button>
          <button onClick={() => setShowSettings(s => !s)} className="flex items-center justify-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium py-2 px-3 rounded-lg border border-white/10 hover:border-white/20 transition-colors" aria-label={l('Cookie settings')}>
            <Settings className="w-3.5 h-3.5" /> {showSettings ? 'Hide' : 'Settings'}
          </button>
        </div>
        {showSettings && (
          <button onClick={handleSavePreferences} className="w-full mt-2 text-violet-400 hover:text-violet-300 text-xs font-semibold py-2 rounded-lg border border-violet-500/20 hover:bg-violet-600/10 transition-colors">
            Save My Preferences
          </button>
        )}
      </div>
    </div>
  );
}
