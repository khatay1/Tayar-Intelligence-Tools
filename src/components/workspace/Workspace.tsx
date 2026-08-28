import { useState, useRef, useEffect, Suspense, lazy } from 'react';
import {
  Bell, Menu, X, LogOut, ChevronDown, Globe, Sun, Moon,
  Crown, User as UserIcon, Settings, CreditCard, Command, Activity, Shield, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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
import { translate } from '@/lib/i18n';
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

export default function Workspace({ onExitToLanding }: WorkspaceProps) {
  return (
    <WorkspaceProvider>
      <WorkspaceInner onExitToLanding={onExitToLanding} />
    </WorkspaceProvider>
  );
}

function WorkspaceInner({ onExitToLanding }: WorkspaceProps) {
  const { user, profile, signOut } = useAuth();
  const { prefs, setTheme, setLanguage } = usePreferences();
const { t } = useTranslation();
  const l = useLocalizer();
  const { state: onboardingState, loading: onboardingLoading, needsOnboarding } = useOnboarding();
  const [activeView, setActiveView] = useState<ViewId>('my-workspace');
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
  const plan = profile?.plan || 'free';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+K / Cmd+K to open command palette
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
    setSidebarOpen(false);
    trackPageView(`/workspace/${view}`);
  }

  // Onboarding gate: show wizard if user hasn't completed it
  if (!onboardingLoading && needsOnboarding) {
    return <OnboardingWizard onComplete={() => { setShowWelcomeDash(true); setActiveView('my-workspace'); }} />;
  }

  // Show welcome dashboard right after onboarding
  if (showWelcomeDash && !tourActive) {
    return (
      <div className="min-h-screen bg-[#06060f] text-white">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
        </div>
        <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4 border-b border-white/5 bg-[#0a0a1a]/80 backdrop-blur-xl sticky top-0">
          <div className="flex items-center gap-2.5">
            <AstronautLogo size={32} />
            <span className="font-bold text-sm">Tayar Intelligence</span>
          </div>
          <button onClick={() => setShowWelcomeDash(false)} className="text-gray-400 hover:text-white text-sm transition-colors">
            {l('Go to Workspace →')}
          </button>
        </header>
        <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-8 py-8">
          <WelcomeDashboard onNavigate={(v) => { setShowWelcomeDash(false); navigate(v); }} onStartTour={() => { setShowWelcomeDash(false); setTourActive(true); }} />
        </main>
      </div>
    );
  }

  const registryToolItems: NavItem[] = toolRegistry.available().map(t => ({
    id: t.id as ViewId,
    label: t.name,
    icon: t.icon,
    group: 'tools' as const,
    badge: t.status === 'beta' ? 'Beta' : t.tier === 'premium' ? 'Pro' : undefined,
  }));
  const soonItems: NavItem[] = toolRegistry.all().filter(t => t.status === 'soon').map(t => ({
    id: t.id as ViewId,
    label: t.name,
    icon: t.icon,
    group: 'tools' as const,
    badge: 'Soon',
  }));
  const getNavLabel = (item: NavItem): string => {
  const keys: Partial<Record<ViewId, string>> = {
    dashboard: 'nav.dashboard',
    'my-workspace': 'nav.myWorkspace',
    'ai-chat': 'nav.aiChat',
    'my-files': 'nav.myFiles',
    'my-projects': 'nav.projects',
    trash: 'nav.trash',
    'activity-timeline': 'nav.activity',
    'cv-builder': 'nav.cvBuilder',
    'cover-letter': 'nav.coverLetter',
    'document-ai': 'nav.documentAI',
    'ai-writer': 'nav.aiWriter',
    translator: 'nav.translator',
    'study-assistant': 'nav.studyAssistant',
    'pdf-tools': 'nav.pdfTools',
    'image-tools': 'nav.imageTools',
    'ai-usage': 'nav.aiUsage',
    subscription: 'nav.subscription',
    settings: 'nav.settings',
    support: 'nav.support',
    help: 'nav.help',
    about: 'nav.about',
    contact: 'nav.contact',
    feedback: 'nav.feedback',
    'bug-report': 'nav.bugReport',
    privacy: 'footer.privacy',
    terms: 'footer.terms',
    profile: 'nav.profile',
  };

  const key = keys[item.id];
  return key ? translate(key as any, prefs.language) : item.label;
};

const translatedMainItems = NAV_ITEMS
  .filter(i => i.group === 'main')
  .map(item => ({ ...item, label: getNavLabel(item) }));



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

  return {
    ...item,
    label: translations[item.id] || item.label,
  };
};

const translatedNavItems = NAV_ITEMS.map(translateNavItem);
const translatedRegistryToolItems = registryToolItems.map(translateNavItem);
const translatedSoonItems = soonItems.map(translateNavItem);


const groups: { label: string; items: NavItem[] }[] = [
  {
    label: '',
    items: translatedNavItems.filter(i => i.group === 'main'),
  },
  {
    label: t('nav.toolsSection'),
    items: [...translatedRegistryToolItems, ...translatedSoonItems],
  },
  {
    label: t('nav.accountSection'),
    items: translatedNavItems.filter(i => i.group === 'account'),
  },
];
  if (activeView === 'cv-builder') {
    return <ResumeBuilder onBack={() => setActiveView('my-workspace')} />;
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'tayar-space-bg-soft' : 'bg-gray-50'} ${darkMode ? 'text-white' : 'text-gray-900'} flex`}>
      {darkMode && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 ${darkMode ? 'bg-[#0a0a1a]/80' : 'bg-white'} backdrop-blur-xl border-r ${darkMode ? 'border-white/5' : 'border-gray-200'} flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className={`flex items-center justify-between px-5 h-16 border-b ${darkMode ? 'border-white/5' : 'border-gray-200'}`}>
          <button onClick={onExitToLanding} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <AstronautLogo size={32} />
            <span className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>Tayar Intelligence</span>
          </button>
          <button className={`lg:hidden ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className={`text-xs font-semibold uppercase tracking-wider px-3 mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{group.label}</div>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      data-tour={item.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${active ? 'bg-violet-600/15 text-violet-300 font-medium border border-violet-500/20' : darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'} ${item.id === 'image-tools' ? 'opacity-60' : ''}`}
                    >
                      <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-violet-400' : ''}`} />
                     <span className="flex-1 text-left">
  {item.label}
</span>
                      {item.badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-3">
          <div className="relative bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 rounded-xl p-4 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-violet-500/20 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="w-4 h-4 text-amber-400" />
                <p className="text-white text-sm font-semibold">{l('Upgrade to Pro')}</p>
              </div>
              <p className="text-gray-400 text-xs mb-3">{l('Unlock higher limits, publishing, analytics and collaboration features.')}</p>
              <button onClick={() => navigate('subscription')} className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors">{l('Upgrade Now')}</button>
            </div>
          </div>
        </div>

        <div className={`px-3 pb-4 border-t ${darkMode ? 'border-white/5' : 'border-gray-200'} pt-3`}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{displayName}</div>
              <div className="text-violet-400 text-xs capitalize">{plan} plan</div>
            </div>
            <button onClick={signOut} className={`transition-colors flex-shrink-0 ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main + Assistant */}
      <div className="flex-1 flex min-w-0 relative z-10">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar with Command Bar */}
          <header className={`sticky top-0 z-30 ${darkMode ? 'bg-[#0a0a1a]/70' : 'bg-white/80'} backdrop-blur-xl border-b ${darkMode ? 'border-white/5' : 'border-gray-200'} h-16 flex items-center px-4 sm:px-6 gap-3`}>
            <button className={`lg:hidden ${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`} onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>

            {/* Universal AI Command Bar */}
            <CommandBar darkMode={darkMode} onNavigate={navigate} />

            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button onClick={() => setPaletteOpen(true)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Command palette')} title={l('Command palette (Ctrl+K)')}>
                <Command className="w-5 h-5" />
              </button>
              <button onClick={() => setTheme(darkMode ? 'light' : 'dark')} className={`p-2 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Toggle theme')}>
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <div className="relative" ref={langRef}>
                <button onClick={() => setLangOpen(!langOpen)} className={`flex items-center gap-1.5 text-sm px-2.5 py-2 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Change language')}>
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">{LANGUAGES.find(l => l.code === prefs.language)?.label || 'English'}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {langOpen && (
                  <div className={`absolute top-full right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl p-1.5 w-40 shadow-2xl shadow-black/50 z-50`}>
                    {LANGUAGES.map(lang => (
                      <button key={lang.code} onClick={() => { setLanguage(lang.code); setLangOpen(false); }} className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${prefs.language === lang.code ? 'bg-violet-600/20 text-violet-300' : darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}>{lang.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={notifRef}>
                <button onClick={() => setNotifOpen(!notifOpen)} className={`relative p-2 rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`} aria-label={l('Notifications')}>
                  <Bell className="w-5 h-5" />
                </button>
                {notifOpen && (
                  <div className={`absolute top-full right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden`}>
                    <NotificationCenter darkMode={darkMode} />
                  </div>
                )}
              </div>
              <div className="relative" ref={profileRef}>
                <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">{initials}</div>
                  <ChevronDown className={`w-3.5 h-3.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </button>
                {profileOpen && (
                  <div className={`absolute top-full right-0 mt-2 ${darkMode ? 'bg-[#12122a]' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'} rounded-xl w-56 shadow-2xl shadow-black/50 z-50 overflow-hidden`}>
                    <div className={`px-4 py-3 border-b ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
                      <div className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{displayName}</div>
                      <div className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</div>
                    </div>
                    <div className="p-1.5">
                      <button onClick={() => { navigate('settings'); setProfileOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><Settings className="w-4 h-4" /> {l('Settings')}</button>
                      <button onClick={() => { navigate('subscription'); setProfileOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><CreditCard className="w-4 h-4" /> {l('Subscription')}</button>
                      <button onClick={() => { navigate('activity-timeline'); setProfileOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-100'}`}><Activity className="w-4 h-4" /> {l('Recent Activity')}</button>
                      <button onClick={() => { setProfileOpen(false); setTourActive(true); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-violet-300 hover:bg-violet-500/10' : 'text-violet-600 hover:bg-violet-50'}`}><Sparkles className="w-4 h-4" /> {l('Replay Tour')}</button>
                      <a href="#admin" className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${darkMode ? 'text-violet-300 hover:bg-violet-500/10' : 'text-violet-600 hover:bg-violet-50'}`}><Shield className="w-4 h-4" /> {l('Admin Panel')}</a>
                      <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><LogOut className="w-4 h-4" /> {l('Sign out')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            <Suspense fallback={<PageSkeleton />}>
              {activeView === 'dashboard' && <DashboardView onNavigate={navigate} />}
              {activeView === 'my-workspace' && <MyWorkspace onNavigate={navigate} />}
              {activeView === 'my-files' && <FileManager onNavigate={navigate} />}
              {activeView === 'my-projects' && !activeProjectId && <FileManager onNavigate={navigate} />}
              {activeView === 'my-projects' && activeProjectId && (
                <ProjectView projectId={activeProjectId} onBack={() => { setActiveProjectId(null); setActiveView('my-workspace'); }} onNavigate={(v) => navigate(v)} />
              )}
              {activeView === 'trash' && <TrashView />}
              {activeView === 'activity-timeline' && <ActivityTimeline darkMode={darkMode} onNavigate={navigate} />}
              {activeView === 'ai-chat' && <PlaceholderView title={l('AI Chat')} desc={l('Use the AI Assistant panel on the right to chat!')} icon={Activity} darkMode={darkMode} />}
              {(() => {
                const tool = toolRegistry.get(activeView);
                if (tool && tool.status !== 'soon') {
                  const Component = tool.component;
                  return <Component darkMode={darkMode} />;
                }
                if (tool && tool.status === 'soon') {
                  return <PlaceholderView title={tool.name} desc={tool.description} icon={Activity} darkMode={darkMode} badge="Coming Soon" />;
                }
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

        {/* AI Assistant Panel — right side */}
        <AIAssistant darkMode={darkMode} onNavigate={navigate} />
      </div>


      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={navigate} darkMode={darkMode} />

      {/* Product Tour overlay */}
      {tourActive && (
        <ProductTour onNavigate={(v) => navigate(v as ViewId)} onComplete={() => setTourActive(false)} />
      )}

      {/* PWA Install Prompt */}
      <InstallPrompt />

      {/* Keyboard Shortcuts Help */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShortcutsOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-[#12122a] border border-white/10 rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()} style={{ animation: 'scaleIn 0.2s ease-out' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">{l('Keyboard Shortcuts')}</h2>
              <button onClick={() => setShortcutsOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {SHORTCUT_HINTS.map((hint, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-gray-400 text-sm">{hint.description}</span>
                  <kbd className="text-xs font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300">{hint.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cookie Consent */}
      <CookieConsent />
    </div>
  );
}

function PlaceholderView({ title, desc, icon: Icon, darkMode, badge }: { title: string; desc: string; icon: typeof Activity; darkMode: boolean; badge?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className={`w-20 h-20 rounded-3xl ${darkMode ? 'bg-white/5' : 'bg-gray-100'} flex items-center justify-center mb-5`}>
        <Icon className={`w-10 h-10 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`} />
      </div>
      {badge && <span className="text-xs px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 font-medium mb-3">{badge}</span>}
      <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
      <p className={`text-sm max-w-md ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{desc}</p>
    </div>
  );
}
