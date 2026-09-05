import { useState, useRef, useEffect, Suspense } from 'react';
import {
  Bell, Menu, X, LogOut, ChevronDown, Globe, Sun, Moon,
  Crown, Settings, CreditCard, Command, Activity, Shield, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useTranslation } from '@/lib/i18n';
import { useLocalizer } from '@/lib/ui-localization';
import { useOnboarding } from '@/context/OnboardingContext';
import { WorkspaceProvider } from '@/context/WorkspaceContext';
import AstronautLogo from '@/components/ui/AstronautLogo';
import { NAV_ITEMS, ViewId, NavItem } from './workspace-config';
import DashboardView from './DashboardView';
import MyWorkspace from './MyWorkspace';
import FileManager from './FileManager';
import ProjectView from './ProjectView';
import TrashView from './TrashView';
import AIAssistant from './AIAssistant';
import AIUsageAnalytics from './AIUsageAnalytics';
import SettingsPage from './SettingsPage';
import NotificationCenter from './NotificationCenter';
import ActivityTimeline from './ActivityTimeline';
import CommandBar from './CommandBar';
import CommandPalette from './CommandPalette';
import CookieConsent from './CookieConsent';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import ContactPage from './ContactPage';
import AboutPage from './AboutPage';
import HelpCenter from './HelpCenter';
import FeedbackPage from './FeedbackPage';
import BugReportPage from './BugReportPage';
import SubscriptionView from './SubscriptionView';
import SupportView from './SupportView';
import ResumeBuilder from '@/components/cv/ResumeBuilder';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import ProductTour from '@/components/onboarding/ProductTour';
import WelcomeDashboard from '@/components/onboarding/WelcomeDashboard';
import InstallPrompt from '@/components/ui/InstallPrompt';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { useKeyboardShortcuts, SHORTCUT_HINTS } from '@/lib/use-keyboard-shortcuts';
import { trackPageView } from '@/lib/analytics';
import '@/modules';
import { toolRegistry } from '@/modules/registry';

interface WorkspaceProps {
  onExitToLanding: () => void;
}

const LANGUAGES: { code: 'en' | 'ar' | 'sv'; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'sv', label: 'Svenska' },
];

const DEFAULT_WORKSPACE_VIEW: ViewId = 'my-workspace';
const STATIC_NAV_IDS = new Set<string>(NAV_ITEMS.map((item) => item.id));

function getWorkspaceViewFromHash(): ViewId {
  const route = window.location.hash.replace(/^#/, '');
  if (!route.startsWith('workspace/')) return DEFAULT_WORKSPACE_VIEW;

  const candidate = route.slice('workspace/'.length);
  const knownViews = new Set<string>([
    ...NAV_ITEMS.map((item) => item.id),
    ...toolRegistry.all().map((tool) => tool.id),
  ]);

  return knownViews.has(candidate) ? candidate as ViewId : DEFAULT_WORKSPACE_VIEW;
}

export default function Workspace({ onExitToLanding }: WorkspaceProps) {
  return (
    <WorkspaceProvider>
      <WorkspaceInner onExitToLanding={onExitToLanding} />
    </WorkspaceProvider>
  );
}

function WorkspaceInner({ onExitToLanding }: WorkspaceProps) {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { prefs, setTheme, setLanguage } = usePreferences();
  const { t } = useTranslation();
  const l = useLocalizer();
  const { loading: onboardingLoading, needsOnboarding } = useOnboarding();
  const [activeView, setActiveView] = useState<ViewId>(getWorkspaceViewFromHash);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [showWelcomeDash, setShowWelcomeDash] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useKeyboardShortcuts([
    { key: '/', ctrl: true, handler: () => setShortcutsOpen(o => !o), description: 'Toggle shortcuts help' },
    { key: 'b', ctrl: true, handler: () => setSidebarOpen(o => !o), description: 'Toggle sidebar' },
    { key: ',', ctrl: true, handler: () => navigate('settings'), description: 'Open settings' },
    { key: 'k', ctrl: true, handler: () => setPaletteOpen(o => !o), description: 'Command palette' },
  ]);

  const darkMode = prefs.theme === 'dark';

  const langRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const planLabel = isAdmin ? 'Admin · Business access' : `${profile?.plan || 'free'} plan`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [sidebarOpen]);

  useEffect(() => {
    const syncViewFromHash = () => {
      const nextView = getWorkspaceViewFromHash();
      setActiveView(nextView);
      if (nextView !== 'my-projects') setActiveProjectId(null);
    };

    window.addEventListener('hashchange', syncViewFromHash);
    return () => window.removeEventListener('hashchange', syncViewFromHash);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function navigate(view: ViewId, projectId?: string) {
    setActiveView(view);
    if (projectId) setActiveProjectId(projectId);
    else if (view !== 'my-projects') setActiveProjectId(null);
    setSidebarOpen(false);
    const nextHash = `#workspace/${view}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
    trackPageView(`/workspace/${view}`);
  }

  if (!onboardingLoading && needsOnboarding) {
    return <OnboardingWizard onComplete={() => { setShowWelcomeDash(true); navigate('my-workspace'); }} />;
  }

  if (showWelcomeDash && !tourActive) {
    return (
      <div className="min-h-[100dvh] overflow-x-hidden tayar-space-bg-soft text-white">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
        </div>
        <header className="relative z-10 flex min-w-0 items-center justify-between gap-3 px-3 py-3 sm:px-8 sm:py-4 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl sticky top-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <AstronautLogo size={32} />
            <span className="truncate font-bold text-sm">Tayar Intelligence</span>
          </div>
          <button onClick={() => setShowWelcomeDash(false)} className="min-h-11 shrink-0 text-gray-400 hover:text-white text-sm transition-colors">
            {l('Go to Workspace →')}
          </button>
        </header>
        <main className="relative z-10 max-w-5xl mx-auto min-w-0 overflow-x-hidden px-3 sm:px-8 py-6 sm:py-8">
          <WelcomeDashboard onNavigate={(v) => { setShowWelcomeDash(false); navigate(v); }} onStartTour={() => { setShowWelcomeDash(false); setTourActive(true); }} />
        </main>
      </div>
    );
  }

  const registryToolItems: NavItem[] = toolRegistry.available().filter((tool) => !STATIC_NAV_IDS.has(tool.id)).map(t => ({
    id: t.id as ViewId,
    label: t.name,
    icon: t.icon,
    group: 'tools' as const,
    badge: t.status === 'beta' ? 'Beta' : t.tier === 'premium' ? 'Pro' : undefined,
  }));
  const soonItems: NavItem[] = toolRegistry.all().filter(t => t.status === 'soon' && !STATIC_NAV_IDS.has(t.id)).map(t => ({
    id: t.id as ViewId,
    label: t.name,
    icon: t.icon,
    group: 'tools' as const,
    badge: 'Soon',
  }));
  const translateNavItem = (item: NavItem): NavItem => {
    const translations: Partial<Record<ViewId, string>> = {
      dashboard: t('nav.dashboard'),
      'my-workspace': t('nav.myWorkspace'),
      'ai-chat': t('nav.aiChat'),
      'cv-builder': t('nav.cvBuilder'),
      'cover-letter': t('nav.coverLetter'),
      'document-ai': t('nav.documentAI'),
      'ai-writer': t('nav.aiWriter'),
      translator: t('nav.translator'),
      'study-assistant': t('nav.studyAssistant'),
      'pdf-tools': t('nav.pdfTools'),
      'image-tools': t('nav.imageTools'),
      'my-files': t('nav.myFiles'),
      'my-projects': t('nav.projects'),
      trash: t('nav.trash'),
      'activity-timeline': t('nav.activity'),
      'ai-usage': t('nav.aiUsage'),
      subscription: t('nav.subscription'),
      settings: t('nav.settings'),
      support: t('nav.support'),
      help: t('nav.help'),
      about: t('nav.about'),
      contact: t('nav.contact'),
      feedback: t('nav.feedback'),
      'bug-report': t('nav.bugReport'),
      privacy: t('nav.privacy'),
      terms: t('nav.terms'),
      profile: t('nav.profile'),
    };

    return { ...item, label: translations[item.id] || item.label };
  };

  const translatedNavItems = NAV_ITEMS.map((item) => {
    const registered = toolRegistry.get(item.id);
    if (!registered) return translateNavItem(item);
    const badge = registered.status === 'soon'
      ? 'Soon'
      : registered.status === 'beta'
        ? 'Beta'
        : registered.tier === 'premium'
          ? 'Pro'
          : undefined;
    return translateNavItem({ ...item, badge });
  });
  const translatedRegistryToolItems = registryToolItems.map(translateNavItem);
  const translatedSoonItems = soonItems.map(translateNavItem);

  const groups: { label: string; items: NavItem[] }[] = [
    { label: '', items: translatedNavItems.filter(i => i.group === 'main') },
    { label: t('nav.toolsSection'), items: [...translatedRegistryToolItems, ...translatedSoonItems] },
    { label: t('nav.accountSection'), items: translatedNavItems.filter(i => i.group === 'account') },
  ];

  if (activeView === 'cv-builder') {
    return <ResumeBuilder onBack={() => navigate('my-workspace')} />;
  }

  return (
    <div className={`min-h-[100dvh] overflow-x-hidden ${darkMode ? 'tayar-space-bg-soft' : 'bg-gray-50'} ${darkMode ? 'text-white' : 'text-gray-900'} flex`}>
      {darkMode && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
        </div>
      )}

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-[100dvh] w-[min(18rem,calc(100vw-2rem))] max-w-full ${darkMode ? 'bg-[#090918]/90' : 'bg-white'} backdrop-blur-xl border-r ${darkMode ? 'border-violet-400/10' : 'border-gray-200'} flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex min-h-16 items-center justify-between gap-2 px-4 sm:px-5 border-b ${darkMode ? 'border-violet-400/10' : 'border-gray-200'}`}>
          <button onClick={onExitToLanding} className="flex min-w-0 items-center gap-2.5 hover:opacity-80 transition-opacity">
            <AstronautLogo size={32} />
            <span className={`truncate font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tayar Intelligence</span>
          </button>
          <button className={`lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${darkMode ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => setSidebarOpen(false)} aria-label={l('Close menu')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 px-3 py-4 space-y-4 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && <div className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{group.label}</div>}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      data-tour={item.id}
                      className={`min-h-11 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${active ? 'bg-violet-500/20 text-violet-200 font-medium border border-violet-400/30 shadow-[0_0_24px_rgba(139,92,246,0.10)]' : darkMode ? 'text-gray-400 hover:text-white hover:bg-white/[0.07] border border-transparent hover:border-white/[0.06]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'}`}
                    >
                      <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-violet-400' : ''}`} />
                      <span className="flex-1 min-w-0 truncate text-left">{item.label}</span>
                      {item.badge && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {!isAdmin && <div className="px-3 pb-3">
          <div className="relative bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 rounded-xl p-4 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-violet-500/20 rounded-full blur-2xl" />
            <div className="relative min-w-0">
              <div className="flex items-center gap-2 mb-1.5"><Crown className="w-4 h-4 text-amber-400" /><p className="text-white text-sm font-semibold">{l('Upgrade to Pro')}</p></div>
              <p className="text-gray-400 text-xs mb-3 break-words">{l('Unlock higher limits, publishing, analytics and collaboration features.')}</p>
              <button onClick={() => navigate('subscription')} className="min-h-11 w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors">{l('Upgrade Now')}</button>
            </div>
          </div>
        </div>}

        <div className={`px-3 border-t ${darkMode ? 'border-violet-400/10' : 'border-gray-200'} pt-3`} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{initials}</div>
            <div className="flex-1 min-w-0"><div className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{displayName}</div><div className="text-violet-400 text-xs capitalize truncate">{planLabel}</div></div>
            <button onClick={signOut} className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors flex-shrink-0 ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Sign out')}><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex min-w-0 relative z-10 overflow-x-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className={`sticky top-0 z-30 ${darkMode ? 'bg-[#0a0a1a]/80' : 'bg-white/90'} backdrop-blur-xl border-b ${darkMode ? 'border-violet-400/10' : 'border-gray-200'} min-h-16 flex items-center px-2.5 sm:px-6 gap-1.5 sm:gap-3`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <button className={`lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'} transition-colors`} onClick={() => setSidebarOpen(true)} aria-label={l('Open menu')}>
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden min-w-0 flex-1 sm:block"><CommandBar darkMode={darkMode} onNavigate={navigate} /></div>

            <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-2 flex-shrink-0">
              <button onClick={() => setPaletteOpen(true)} className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Command palette')} title={l('Command palette (Ctrl+K)')}><Command className="w-5 h-5" /></button>
              <button onClick={() => setTheme(darkMode ? 'light' : 'dark')} className={`hidden sm:flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Toggle theme')}>{darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</button>
              <div className="relative" ref={langRef}>
                <button onClick={() => setLangOpen(!langOpen)} className={`flex h-11 items-center gap-1.5 text-sm px-2 sm:px-2.5 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Change language')}><Globe className="w-4 h-4" /><span className="hidden md:inline">{LANGUAGES.find(lang => lang.code === prefs.language)?.label || 'English'}</span><ChevronDown className="hidden sm:block w-3.5 h-3.5" /></button>
                {langOpen && <div className={`absolute top-full right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl p-1.5 w-40 max-w-[calc(100vw-1rem)] shadow-2xl shadow-black/50 z-50`}>{LANGUAGES.map(lang => <button key={lang.code} onClick={() => { setLanguage(lang.code); setLangOpen(false); }} className={`min-h-11 w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${prefs.language === lang.code ? 'bg-violet-600/20 text-violet-300' : darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}>{lang.label}</button>)}</div>}
              </div>
              <div className="relative" ref={notifRef}>
                <button onClick={() => setNotifOpen(!notifOpen)} className={`relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Notifications')}><Bell className="w-5 h-5" /></button>
                {notifOpen && <div className={`absolute top-full right-0 mt-2 max-w-[calc(100vw-1rem)] ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden`}><NotificationCenter darkMode={darkMode} /></div>}
              </div>
              <div className="relative" ref={profileRef}>
                <button onClick={() => setProfileOpen(!profileOpen)} className="flex h-11 items-center gap-1 sm:gap-2 px-1 sm:pr-2 rounded-xl hover:bg-white/5 transition-colors" aria-label={l('Account menu')}><div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">{initials}</div><ChevronDown className={`hidden sm:block w-3.5 h-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} /></button>
                {profileOpen && (
                  <div className={`absolute top-full right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl w-56 max-w-[calc(100vw-1rem)] shadow-2xl shadow-black/50 z-50 overflow-hidden`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}><div className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{displayName}</div><div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</div></div>
                    <div className="p-1.5">
                      <button onClick={() => { navigate('settings'); setProfileOpen(false); }} className={`min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><Settings className="w-4 h-4" /> {l('Settings')}</button>
                      <button onClick={() => { navigate('subscription'); setProfileOpen(false); }} className={`min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><CreditCard className="w-4 h-4" /> {l('Subscription')}</button>
                      <button onClick={() => { navigate('activity-timeline'); setProfileOpen(false); }} className={`min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><Activity className="w-4 h-4" /> {l('Recent Activity')}</button>
                      <button onClick={() => { setProfileOpen(false); setTourActive(true); }} className={`min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-violet-300 hover:bg-violet-500/10' : 'text-violet-600 hover:bg-violet-50'}`}><Sparkles className="w-4 h-4" /> {l('Replay Tour')}</button>
                      {isAdmin && <a href="#admin" className={`min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-violet-300 hover:bg-violet-500/10' : 'text-violet-600 hover:bg-violet-50'}`}><Shield className="w-4 h-4" /> {l('Admin Panel')}</a>}
                      <button onClick={signOut} className="min-h-11 w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><LogOut className="w-4 h-4" /> {l('Sign out')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-6 lg:p-8">
            <Suspense fallback={<PageSkeleton />}>
              {activeView === 'dashboard' && <DashboardView onNavigate={navigate} />}
              {activeView === 'my-workspace' && <MyWorkspace onNavigate={navigate} />}
              {activeView === 'my-files' && <FileManager onNavigate={navigate} />}
              {activeView === 'my-projects' && !activeProjectId && <FileManager onNavigate={navigate} />}
              {activeView === 'my-projects' && activeProjectId && <ProjectView projectId={activeProjectId} onBack={() => { setActiveProjectId(null); navigate('my-workspace'); }} onNavigate={(v) => navigate(v)} />}
              {activeView === 'trash' && <TrashView />}
              {activeView === 'activity-timeline' && <ActivityTimeline darkMode={darkMode} onNavigate={navigate} />}
              {activeView === 'ai-chat' && <PlaceholderView title={l('AI Chat')} desc={l('Use the AI Assistant panel on the right to chat!')} icon={Activity} darkMode={darkMode} />}
              {(() => {
                const tool = toolRegistry.get(activeView);
                if (tool && tool.status !== 'soon') { const Component = tool.component; return <Component darkMode={darkMode} projectId={activeProjectId} />; }
                if (tool && tool.status === 'soon') return <PlaceholderView title={l(tool.name)} desc={l(tool.description)} icon={Activity} darkMode={darkMode} badge={l('Coming Soon')} />;
                return null;
              })()}
              {activeView === 'subscription' && <SubscriptionView />}
              {activeView === 'support' && <SupportView onNavigate={(v) => navigate(v)} />}
              {activeView === 'ai-usage' && <AIUsageAnalytics />}
              {(activeView === 'settings' || activeView === 'profile') && <SettingsPage darkMode={darkMode} />}
              {activeView === 'privacy' && <PrivacyPolicy />}
              {activeView === 'terms' && <TermsOfService />}
              {activeView === 'contact' && <ContactPage />}
              {activeView === 'about' && <AboutPage />}
              {activeView === 'help' && <HelpCenter />}
              {activeView === 'feedback' && <FeedbackPage />}
              {activeView === 'bug-report' && <BugReportPage />}
            </Suspense>
          </main>
        </div>

        <AIAssistant darkMode={darkMode} onNavigate={navigate} />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} darkMode={darkMode} />
      {tourActive && <ProductTour onNavigate={(v) => navigate(v as ViewId)} onComplete={() => setTourActive(false)} />}
      <InstallPrompt />

      {shortcutsOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShortcutsOpen(false)}>
          <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto bg-[#12122a] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 sm:p-6" onClick={e => e.stopPropagation()} style={{ animation: 'scaleIn 0.2s ease-out', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between gap-3 mb-4"><h2 className="min-w-0 truncate text-white font-bold text-lg">{l('Keyboard Shortcuts')}</h2><button onClick={() => setShortcutsOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-colors"><X className="w-5 h-5" /></button></div>
            <div className="space-y-2">
              {SHORTCUT_HINTS.map((hint, i) => <div key={i} className="flex min-w-0 items-center justify-between gap-3 py-1.5"><span className="min-w-0 break-words text-gray-400 text-sm">{hint.description}</span><kbd className="shrink-0 text-xs font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">{hint.key}</kbd></div>)}
            </div>
          </div>
        </div>
      )}

      <CookieConsent />
    </div>
  );
}

function PlaceholderView({ title, desc, icon: Icon, darkMode, badge }: { title: string; desc: string; icon: typeof Activity; darkMode: boolean; badge?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-3 py-16 sm:py-20 text-center">
      <div className={`w-20 h-20 rounded-3xl ${darkMode ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center mb-5`}><Icon className={`w-10 h-10 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} /></div>
      {badge && <span className="text-xs px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 font-medium mb-3">{badge}</span>}
      <h2 className={`max-w-full break-words text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
      <p className="max-w-md break-words text-sm text-gray-500">{desc}</p>
    </div>
  );
}
