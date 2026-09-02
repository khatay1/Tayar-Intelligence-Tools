import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe2, Menu, X } from 'lucide-react';
import AstronautLogo from '@/components/ui/AstronautLogo';
import { usePreferences } from '@/context/PreferencesContext';
import { useTranslation } from '@/lib/i18n';
import { useLandingCopy } from '@/lib/landing-copy';
import { useLocalizer } from '@/lib/ui-localization';

interface NavbarProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
}

const LANGUAGES = [
  { code: 'en' as const, label: 'English' },
  { code: 'ar' as const, label: 'العربية' },
  { code: 'sv' as const, label: 'Svenska' },
];

export default function Navbar({ onGetStarted, onLogin }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const l = useLocalizer();
  const landing = useLandingCopy();
  const { prefs, setLanguage } = usePreferences();

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setLanguageOpen(false);
      }
    }
    function handlePointer(event: MouseEvent) {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setLanguageOpen(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointer);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointer);
    };
  }, []);

  const closeMobile = () => setMobileOpen(false);
  const navLinks = [
    { label: t('nav.home'), href: '#top' },
    { label: t('nav.tools'), href: '#tools' },
    { label: t('nav.business'), href: '#business' },
    { label: t('nav.pricing'), href: '#pricing' },
    { label: landing.nav.faq, href: '#faq' },
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#070711]/85 backdrop-blur-2xl supports-[backdrop-filter]:bg-[#070711]/70" aria-label={l('Primary navigation')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" onClick={closeMobile} className="group flex items-center gap-2.5 rounded-xl" aria-label={l('Tayar Intelligence home')}>
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10 shadow-[0_0_30px_rgba(124,58,237,0.12)] transition-transform group-hover:scale-[1.03]">
            <AstronautLogo size={30} />
          </div>
          <div className="leading-none">
            <span className="block text-sm font-bold tracking-tight text-white sm:text-[15px]">Tayar Intelligence</span>
            <span className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300/70 sm:block">{l('Build · Create · Ship')}</span>
          </div>
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map(link => (
            <a key={link.href} href={link.href} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-white">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <div className="relative" ref={languageRef}>
            <button
              type="button"
              onClick={() => setLanguageOpen(v => !v)}
              aria-expanded={languageOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-gray-300 transition-colors hover:border-white/15 hover:text-white"
              title={landing.nav.language}
            >
              <Globe2 className="h-4 w-4" />
              <span className="uppercase">{prefs.language}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${languageOpen ? 'rotate-180' : ''}`} />
            </button>
            {languageOpen && (
              <div role="menu" className="absolute end-0 top-full mt-2 w-40 rounded-xl border border-white/10 bg-[#111122] p-1.5 shadow-2xl shadow-black/50">
                {LANGUAGES.map(language => (
                  <button
                    type="button"
                    role="menuitem"
                    key={language.code}
                    onClick={() => { setLanguage(language.code); setLanguageOpen(false); }}
                    className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors ${prefs.language === language.code ? 'bg-violet-500/15 text-violet-200' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                  >
                    {language.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={onLogin} className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/[0.04] hover:text-white">
            {t('nav.login')}
          </button>
          <button type="button" onClick={onGetStarted} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-all hover:bg-violet-500 hover:shadow-violet-700/20 active:scale-[0.98]">
            {t('nav.signup')}
          </button>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-white md:hidden"
          onClick={() => setMobileOpen(v => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-[#090914] px-4 pb-5 pt-3 md:hidden">
          <div className="mx-auto max-w-7xl space-y-1">
            {navLinks.map(link => (
              <a key={link.href} href={link.href} onClick={closeMobile} className="block rounded-xl px-3 py-3 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white">
                {link.label}
              </a>
            ))}
            <div className="my-3 h-px bg-white/[0.06]" />
            <div className="grid grid-cols-3 gap-2 pb-2" aria-label={landing.nav.language}>
              {LANGUAGES.map(language => (
                <button
                  type="button"
                  key={language.code}
                  onClick={() => setLanguage(language.code)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${prefs.language === language.code ? 'border-violet-400/30 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.02] text-gray-400'}`}
                >
                  {language.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="button" onClick={() => { closeMobile(); onLogin?.(); }} className="rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-white">
                {t('nav.login')}
              </button>
              <button type="button" onClick={() => { closeMobile(); onGetStarted?.(); }} className="rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white">
                {t('nav.signup')}
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
