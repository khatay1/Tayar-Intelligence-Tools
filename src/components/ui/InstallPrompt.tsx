import { useState, useEffect } from 'react';
import { Download, X, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'tayar-pwa-install-dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.setItem(DISMISS_KEY, '1');
    }
  }

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[90] w-80" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      <div className="bg-[#12122a] border border-violet-500/20 rounded-2xl shadow-2xl shadow-black/50 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white text-sm font-semibold mb-1">Install Tayar Intelligence</h3>
            <p className="text-gray-500 text-xs leading-relaxed">Add to your home screen for a faster, app-like experience.</p>
          </div>
          <button onClick={handleDismiss} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" /> Install App
        </button>
      </div>
    </div>
  );
}
