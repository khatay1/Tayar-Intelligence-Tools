import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Users, Cpu, Wrench, CreditCard, LifeBuoy,
  FileText, Settings, LogOut, Menu, X, Bell, ChevronRight,
  Shield, Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import AstronautLogo from '@/components/ui/AstronautLogo';

export type AdminView =
  | 'dashboard' | 'users' | 'ai' | 'tools' | 'subscriptions'
  | 'support' | 'content' | 'system';

interface AdminLayoutProps {
  activeView: AdminView;
  onViewChange: (view: AdminView) => void;
  onExitToWorkspace: () => void;
  children: React.ReactNode;
}

const NAV_GROUPS: { label: string; items: { id: AdminView; label: string; icon: typeof Users }[] }[] = [
  { label: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Management',
    items: [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'ai', label: 'AI Management', icon: Cpu },
      { id: 'tools', label: 'Tools', icon: Wrench },
      { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
      { id: 'support', label: 'Support', icon: LifeBuoy },
    ],
  },
  {
    label: 'Platform',
    items: [
      { id: 'content', label: 'Content', icon: FileText },
      { id: 'system', label: 'System', icon: Settings },
    ],
  },
];

export default function AdminLayout({ activeView, onViewChange, onExitToWorkspace, children }: AdminLayoutProps) {
  const l = useLocalizer();
  const { profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void supabase
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .then(({ count, error }) => {
        if (!active) return;
        if (error) {
          console.error('Failed to load admin notification count:', error);
          setUnreadCount(0);
          setNotificationError(true);
          return;
        }
        setUnreadCount(count || 0);
        setNotificationError(false);
      });
    return () => { active = false; };
  }, [activeView]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
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

  const initials = (profile?.full_name || 'A').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#06060f] text-white flex">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-fuchsia-600/6 rounded-full blur-[120px]" />
      </div>

      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-[100dvh] w-[min(16rem,88vw)] lg:w-64 bg-[#0a0a1a]/95 lg:bg-[#0a0a1a]/80 backdrop-blur-xl border-r border-white/5 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/5">
          <button onClick={onExitToWorkspace} className="flex min-w-0 items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="relative shrink-0">
              <AstronautLogo size={32} />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-violet-600 border-2 border-[#0a0a1a] flex items-center justify-center">
                <Shield className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="min-w-0 text-left">
              <div className="font-bold text-sm text-white truncate">{l('Tayar Admin')}</div>
              <div className="text-[10px] text-violet-400 font-medium truncate">{l('Control Panel')}</div>
            </div>
          </button>
          <button className="lg:hidden shrink-0 text-gray-400" onClick={() => setSidebarOpen(false)} aria-label={l('Close menu')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto overscroll-contain">
          {NAV_GROUPS.map(group => (
            <div key={l(group.label)}>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 px-3 mb-2">{l(group.label)}</div>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onViewChange(item.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${active ? 'bg-violet-600/15 text-violet-300 font-medium border border-violet-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                    >
                      <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${active ? 'text-violet-400' : ''}`} />
                      <span className="flex-1 text-left">{l(item.label)}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/5 pt-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-white">{profile?.full_name || 'Admin'}</div>
              <div className="text-xs text-violet-400">{l('Administrator')}</div>
            </div>
            <button onClick={onExitToWorkspace} className="text-gray-400 hover:text-white transition-colors flex-shrink-0" title={l('Back to Workspace')}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0 max-w-full relative z-10">
        <header className="sticky top-0 z-30 bg-[#0a0a1a]/70 backdrop-blur-xl border-b border-white/5 min-h-16 flex items-center px-3 sm:px-6 gap-2 sm:gap-4 pt-[env(safe-area-inset-top)]">
          <button className="lg:hidden shrink-0 p-2 -ml-2 text-gray-400 hover:text-white" onClick={() => setSidebarOpen(true)} aria-label={l('Open menu')}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-base sm:text-lg font-bold text-white capitalize">
              {l(NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeView)?.label || 'Admin')}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">{l('Admin Verified')}</span>
            </div>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <Bell className="w-5 h-5" />
                {notificationError ? (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center" title={l('Notifications unavailable')}>!</span>
                ) : unreadCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">{unreadCount}</span>
                ) : null}
              </button>
              {notifOpen && <AdminNotifications />}
            </div>
            <button onClick={onExitToWorkspace} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors p-2 sm:px-3 sm:py-1.5 rounded-lg hover:bg-white/5">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{l('Exit Admin')}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto p-3 sm:p-6 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNotifications() {
  const l = useLocalizer();
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; type: string; read: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('id, title, message, type, read, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        setNotifications([]);
        setLoadError(error.message || 'Notifications unavailable');
      } else {
        setNotifications((data || []) as typeof notifications);
        setLoadError(null);
      }
      setLoading(false);
    })();
  }, []);

  const typeColors: Record<string, string> = {
    info: 'text-blue-400 bg-blue-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    error: 'text-red-400 bg-red-500/10',
    success: 'text-emerald-400 bg-emerald-500/10',
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] bg-[#12122a] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-white">{l('Notifications')}</span>
        <span className="shrink-0 text-xs text-gray-500">{notifications.filter(n => !n.read).length} {l('unread')}</span>
      </div>
      <div className="max-h-[min(20rem,60dvh)] overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">{l('Loading...')}</div>
        ) : loadError ? (
          <div className="p-6 break-words text-center text-amber-400 text-sm">{loadError}</div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">{l('No notifications')}</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`px-4 py-3 border-b border-white/5 ${!n.read ? 'bg-white/[0.02]' : ''}`}>
              <div className="flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[n.type] || typeColors.info}`}>
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="break-words text-sm font-medium text-white">{n.title}</div>
                  <div className="break-words text-xs text-gray-400 mt-0.5">{n.message}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
