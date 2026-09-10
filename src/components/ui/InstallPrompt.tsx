import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';

const DOWNLOAD_COPY = {
  en: 'Download Android',
  ar: 'تنزيل Android',
  sv: 'Ladda ner Android',
} as const;

export default function InstallPrompt() {
  const { prefs } = usePreferences();
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const label = DOWNLOAD_COPY[prefs.language] || DOWNLOAD_COPY.en;

  useEffect(() => {
    setNavTarget(document.querySelector<HTMLElement>('aside nav'));
  }, []);

  if (!navTarget) return null;

  return createPortal(
    <div className="pt-1">
      <a
        href="/download/android"
        className="min-h-11 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-emerald-400/15 text-sm font-medium text-emerald-300 transition-all hover:bg-emerald-500/10 hover:text-emerald-200 hover:border-emerald-400/25"
        aria-label={label}
        title={label}
      >
        <Download className="w-4.5 h-4.5 flex-shrink-0" />
        <span className="flex-1 min-w-0 truncate text-left">{label}</span>
      </a>
    </div>,
    navTarget,
  );
}
