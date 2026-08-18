import { useState, useRef, useEffect } from 'react';
import {
  Search, Bell, Menu, X, LogOut, ChevronDown, Globe,
  FileText, PenLine, BookOpen, GraduationCap, Languages, Mail,
  ChevronRight, TrendingUp, Zap, HardDrive, Crown,
  LayoutGrid, History, CreditCard, Settings, LifeBuoy, Sparkles,
  Plus, ArrowUpRight, Star, Clock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AstronautLogo from '@/components/ui/AstronautLogo';

type NavKey = 'dashboard' | 'tools' | 'documents' | 'history' | 'subscription' | 'settings' | 'support';

const navItems: { key: NavKey; icon: typeof LayoutGrid; label: string }[] = [
  { key: 'dashboard', icon: LayoutGrid, label: 'Dashboard' },
  { key: 'tools', icon: Sparkles, label: 'AI Tools' },
  { key: 'documents', icon: FileText, label: 'My Documents' },
  { key: 'history', icon: History, label: 'History' },
  { key: 'subscription', icon: CreditCard, label: 'Subscription' },
  { key: 'settings', icon: Settings, label: 'Settings' },
  { key: 'support', icon: LifeBuoy, label: 'Support' },
];

const tools = [
  {
    icon: FileText,
    name: 'AI CV Builder',
    desc: 'Create ATS-friendly resumes that get you noticed by recruiters.',
    color: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    badge: 'Popular',
  },
  {
    icon: Mail,
    name: 'Cover Letter Generator',
    desc: 'Generate personalized cover letters tailored to each job.',
    color: 'from-fuchsia-500 to-purple-700',
    bg: 'bg-fuchsia-500/10',
    iconColor: 'text-fuchsia-400',
  },
  {
    icon: BookOpen,
    name: 'Document AI',
    desc: 'Analyze, summarize and extract key info from any document.',
    color: 'from-cyan-500 to-cyan-700',
    bg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-400',
  },
  {
    icon: GraduationCap,
    name: 'Study Assistant',
    desc: 'Get answers, explain concepts and improve your learning.',
    color: 'from-emerald-500 to-green-700',
    bg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    badge: 'Popular',
  },
  {
    icon: PenLine,
    name: 'AI Writer',
    desc: 'Write blogs, articles, emails and more with AI assistance.',
    color: 'from-violet-500 to-violet-700',
    bg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
  },
  {
    icon: Languages,
    name: 'AI Translator',
    desc: 'Translate text into 100+ languages instantly and accurately.',
    color: 'from-sky-400 to-blue-600',
    bg: 'bg-sky-500/10',
    iconColor: 'text-sky-400',
  },
];

const stats = [
  { icon: FileText, label: 'Documents Created', value: '24', change: '+12%', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: Zap, label: 'AI Requests', value: '1,847', change: '+24%', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { icon: Crown, label: 'Active Plan', value: 'Pro', change: 'Active', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { icon: HardDrive, label: 'Storage Used', value: '2.4 GB', change: '48%', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

const recentActivity = [
  { tool: 'AI CV Builder', action: 'Created "Software Engineer CV"', time: '2 hours ago' },
  { tool: 'AI Writer', action: 'Generated blog post draft', time: '5 hours ago' },
  { tool: 'AI Translator', action: 'Translated 3 documents', time: 'Yesterday' },
  { tool: 'Document AI', action: 'Summarized report.pdf', time: '2 days ago' },
];

const languages = ['English', 'Français', 'العربية', 'Español', 'Deutsch', '中文', '日本語'];
const notifications = [
  { title: 'New AI tool available', desc: 'Image Tools is now in beta', time: '5m ago', unread: true },
  { title: 'Storage almost full', desc: 'You have used 48% of your storage', time: '1h ago', unread: true },
  { title: 'Welcome to Tayar Intelligence', desc: 'Explore our 50+ AI tools', time: '1d ago', unread: false },
];

interface DashboardProps {
  onOpenCVBuilder?: () => void;
}

export default function Dashboard({ onOpenCVBuilder }: DashboardProps) {
  const { user, profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [language, setLanguage] = useState('English');

  const langRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();
  const plan = profile?.plan || 'free';
  const unreadCount = notifications.filter(n => n.unread).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="min-h-screen bg-[#06060f] text-white flex">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/8 rounded-full blur-[100px]" />
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#0a0a1a]/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <AstronautLogo size={32} />
            <span className="text-white font-bold text-sm">Tayar Intelligence</span>
          </div>
          <button className="lg:hidden text-gray-400" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveNav(item.key);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-violet-600/15 text-violet-300 font-medium border border-violet-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? 'text-violet-400' : ''}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Upgrade card */}
        <div className="px-3 pb-3">
          <div className="relative bg-gradient-to-br from-violet-600/20 to-fuchsia-600/10 border border-violet-500/20 rounded-xl p-4 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-violet-500/20 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown className="w-4 h-4 text-amber-400" />
                <p className="text-white text-sm font-semibold">Upgrade to Pro</p>
              </div>
              <p className="text-gray-400 text-xs mb-3">Unlock all 50+ AI tools and unlimited documents.</p>
              <button className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="px-3 pb-4 border-t border-white/5 pt-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-medium truncate">{displayName}</div>
              <div className="text-violet-400 text-xs capitalize">{plan} plan</div>
            </div>
            <button
              onClick={signOut}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#0a0a1a]/70 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-4 sm:px-6 gap-4">
          {/* Left: menu + search */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button className="lg:hidden text-gray-400 hover:text-white transition-colors" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                placeholder="Search tools, documents..."
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Language selector */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm px-2.5 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{language}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {langOpen && (
                <div className="absolute top-full right-0 mt-2 bg-[#12122a] border border-white/10 rounded-xl p-1.5 w-40 shadow-2xl shadow-black/50 z-50">
                  {languages.map(lang => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setLangOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                        language === lang ? 'bg-violet-600/20 text-violet-300' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-violet-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute top-full right-0 mt-2 bg-[#12122a] border border-white/10 rounded-xl w-80 shadow-2xl shadow-black/50 z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <span className="text-white text-sm font-semibold">Notifications</span>
                    <span className="text-violet-400 text-xs">{unreadCount} new</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((n, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer ${
                          n.unread ? 'bg-violet-600/5' : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.unread ? 'bg-violet-500' : 'bg-gray-600'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">{n.title}</div>
                          <div className="text-gray-400 text-xs">{n.desc}</div>
                          <div className="text-gray-500 text-xs mt-1">{n.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full text-center text-violet-400 text-sm py-2.5 hover:bg-white/5 transition-colors">
                    View all
                  </button>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {profileOpen && (
                <div className="absolute top-full right-0 mt-2 bg-[#12122a] border border-white/10 rounded-xl w-56 shadow-2xl shadow-black/50 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5">
                    <div className="text-white text-sm font-medium truncate">{displayName}</div>
                    <div className="text-gray-400 text-xs truncate">{user?.email}</div>
                  </div>
                  <div className="p-1.5">
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    <button className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors">
                      <CreditCard className="w-4 h-4" /> Subscription
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Welcome banner */}
          <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 sm:p-8 mb-8 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.15),transparent_70%)]" />
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AstronautLogo size={28} />
                  <span className="text-violet-400 text-xs font-medium uppercase tracking-wider">Dashboard</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Welcome to Tayar Intelligence Tools</h1>
                <p className="text-gray-400 text-sm">What would you like to create today, {displayName}?</p>
              </div>
              <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 whitespace-nowrap">
                <Plus className="w-4 h-4" /> New Document
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="group bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-violet-500/20 transition-all duration-300"
                  style={{ animation: `fadeInUp 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <span className="text-xs text-gray-500">{stat.change}</span>
                  </div>
                  <div className="text-white text-2xl font-bold mb-0.5">{stat.value}</div>
                  <div className="text-gray-500 text-xs">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* AI Tools Grid */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">AI Tools</h2>
                <p className="text-gray-500 text-xs mt-0.5">Choose a tool to get started</p>
              </div>
              <button className="text-violet-400 text-sm hover:text-violet-300 transition-colors flex items-center gap-1">
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tools.map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.name}
                    className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-violet-500/30 hover:bg-white/[0.05] transition-all duration-300"
                    style={{ animation: 'fadeInUp 0.4s ease-out both', animationDelay: `${i * 0.06}s` }}
                  >
                    {tool.badge && (
                      <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {tool.badge}
                      </span>
                    )}
                    <div className={`w-12 h-12 rounded-xl ${tool.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`w-6 h-6 ${tool.iconColor}`} />
                    </div>
                    <h3 className="text-white font-bold text-base mb-1.5">{tool.name}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-4">{tool.desc}</p>
                    <button
                      onClick={tool.name === 'AI CV Builder' ? onOpenCVBuilder : undefined}
                      className="flex items-center gap-2 bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white text-sm font-medium px-4 py-2 rounded-lg transition-all group-hover:gap-2.5"
                    >
                      Open Tool
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Activity + Quick Create */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-base">Recent Activity</h2>
                <button className="text-violet-400 text-xs hover:text-violet-300 transition-colors">View all</button>
              </div>
              <div className="space-y-1">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 group hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors cursor-pointer">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{item.action}</div>
                      <div className="text-gray-500 text-xs">{item.tool}</div>
                    </div>
                    <div className="text-gray-500 text-xs flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.time}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Create */}
            <div className="relative bg-gradient-to-br from-violet-600/15 to-[#0f0f24] border border-violet-500/20 rounded-2xl p-6 overflow-hidden">
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-violet-500/15 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <h2 className="text-white font-bold text-base">Quick Create</h2>
                </div>
                <p className="text-gray-400 text-xs mb-5">Jump straight into a new document.</p>
                <div className="space-y-2">
                  {[
                    { icon: FileText, label: 'New CV', action: onOpenCVBuilder },
                    { icon: PenLine, label: 'New Article', action: undefined },
                    { icon: Mail, label: 'New Cover Letter', action: undefined },
                  ].map(q => {
                    const Icon = q.icon;
                    return (
                      <button
                        key={q.label}
                        onClick={q.action}
                        className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-3 text-sm text-white transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Icon className="w-4 h-4 text-violet-400" />
                        {q.label}
                        <Plus className="w-4 h-4 text-gray-400 ml-auto" />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 pt-5 border-t border-white/10 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-gray-400 text-xs">Pro tip: Use keyboard shortcuts to create faster</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
