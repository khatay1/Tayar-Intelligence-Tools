import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const ANDROID_COPY = {
  en: {
    title: 'Tayar for Android',
    download: 'Download Android',
    help: 'How to download',
    webInstall: 'Install web app',
  },
  ar: {
    title: 'Tayar لأندرويد',
    download: 'تنزيل Android',
    help: 'كيفية التنزيل',
    webInstall: 'تثبيت تطبيق الويب',
  },
  sv: {
    title: 'Tayar för Android',
    download: 'Ladda ner Android',
    help: 'Så laddar du ner',
    webInstall: 'Installera webbappen',
  },
} as const;

export default function InstallPrompt() {
  const { prefs } = usePreferences();
  const copy = ANDROID_COPY[prefs.language] || ANDROID_COPY.en;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleWebInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <aside
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[calc(100%_-_2rem)] max-w-xs -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0"
      aria-label={copy.title}
    >
      <div className="rounded-2xl border border-emerald-400/25 bg-[#101021]/95 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15">
            <Smartphone className="h-5 w-5 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{copy.title}</p>
            <a href="/download/android" className="text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:underline">
              {copy.help} →
            </a>
          </div>
          <a
            href="/download/android"
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
          >
            <Download className="h-4 w-4" />
            <span>{copy.download}</span>
          </a>
        </div>
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleWebInstall}
            className="mt-2.5 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            {copy.webInstall}
          </button>
        )}
      </div>
    </aside>
  );
}
