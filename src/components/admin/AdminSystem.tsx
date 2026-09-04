import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Bell, Mail, Database, Key, Flag, FileText,
  Loader2, Save, RefreshCw, AlertTriangle,
  ShieldBan, Activity, CheckCircle, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

type SystemTab = 'settings' | 'logs' | 'blocks' | 'readiness' | 'notifications' | 'email' | 'backups' | 'apikeys' | 'flags';

const TABS: { id: SystemTab; label: string; icon: typeof Settings }[] = [
  { id: 'settings', label: 'System Settings', icon: Settings },
  { id: 'logs', label: 'System Logs', icon: FileText },
  { id: 'blocks', label: 'Account Blocks', icon: ShieldBan },
  { id: 'readiness', label: 'Readiness', icon: Activity },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'email', label: 'Email Templates', icon: Mail },
  { id: 'backups', label: 'Backups', icon: Database },
  { id: 'apikeys', label: 'API Keys', icon: Key },
  { id: 'flags', label: 'Feature Flags', icon: Flag },
];

function AdminTabError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  const l = useLocalizer();

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
      <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-400" />
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{message}</p>
      <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
        <RefreshCw className="h-4 w-4" />{l('Retry')}</button>
    </div>
  );
}

export default function AdminSystem() {
  const l = useLocalizer();
  const [tab, setTab] = useState<SystemTab>('settings');

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <Icon className="w-4 h-4" />
              {l(t.label)}
            </button>
          );
        })}
      </div>

      {tab === 'settings' && <SettingsTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'blocks' && <BlocksTab />}
      {tab === 'readiness' && <ReadinessTab />}
      {tab === 'notifications' && <NotificationsTab />}
      {tab === 'email' && <EmailTab />}
      {tab === 'backups' && <BackupsTab />}
      {tab === 'apikeys' && <ApiKeysTab />}
      {tab === 'flags' && <FlagsTab />}
    </div>
  );
}

const SYSTEM_SETTING_KEYS = ['signup_enabled'] as const;

function SettingsTab() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', [...SYSTEM_SETTING_KEYS]);

    if (error) {
      console.error('Failed to load admin settings:', error);
      showError(error.message || 'Failed to load settings');
      setLoading(false);
      return;
    }

    const map: Record<string, string> = {};
    for (const s of (data || []) as { key: string; value: unknown }[]) {
      if (typeof s.value === 'string') map[s.key] = s.value.replace(/^"|"$/g, '');
      else if (typeof s.value === 'number' || typeof s.value === 'boolean') map[s.key] = String(s.value);
      else if (s.value != null) map[s.key] = JSON.stringify(s.value);
    }
    setSettings(map);
    setLoading(false);
  }, [showError]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    const entries = SYSTEM_SETTING_KEYS.map((key) => ({
      key,
      value: settings[key] === 'true',
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('admin_settings').upsert(entries, { onConflict: 'key' });

    setSaving(false);
    if (error) {
      showError(error.message || l('Failed to save settings'));
      return;
    }
    success(l('Settings saved'));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="min-w-0">
            <h3 className="text-white font-semibold">{l('Platform Settings')}</h3>
            <p className="text-gray-500 text-sm">{l('Only runtime-enforced platform settings are editable here.')}</p>
          </div>
          <button onClick={save} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? l('Saving...') : l('Save')}
          </button>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/10 p-4">
          <label className="text-xs text-gray-400 mb-2 block font-medium">{l('Signup Enabled')}</label>
          <button
            onClick={() => setSettings(prev => ({ ...prev, signup_enabled: prev.signup_enabled === 'true' ? 'false' : 'true' }))}
            className="flex min-h-11 items-center gap-3"
          >
            <div className={`w-11 h-6 rounded-full transition-colors ${settings.signup_enabled === 'true' ? 'bg-emerald-500' : 'bg-gray-700'}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.signup_enabled === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-gray-300">{settings.signup_enabled === 'true' ? l('Enabled') : l('Disabled')}</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-4 text-sm text-gray-300">
        <div className="font-medium text-blue-200">{l('Authoritative controls')}</div>
        <p className="mt-1 text-xs leading-5 text-gray-400">{l('Tool access and quotas are managed in Tools. AI provider and model controls are managed in AI Management. Legacy settings that do not enforce runtime behavior are intentionally hidden here.')}</p>
      </div>
    </div>
  );
}

function LogsTab() {
  const l = useLocalizer();
  const [logs, setLogs] = useState<{ id: string; level: string; category: string; message: string; metadata?: Record<string, unknown> | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase.from('system_logs').select('id, level, category, message, metadata, created_at').order('created_at', { ascending: false }).limit(100);
    if (queryError) {
      setLogs([]);
      setError(queryError.message || 'Failed to load system logs.');
    } else {
      setLogs((data || []) as typeof logs);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = levelFilter === 'all' ? logs : logs.filter(l => l.level === levelFilter);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (error) return <AdminTabError title={l('System logs unavailable')} message={error} onRetry={() => void load()} />;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">{l('System Logs')}</h3>
        <div className="flex items-center gap-2">
          {['all', 'info', 'warning', 'error'].map(l => (
            <button key={l} onClick={() => setLevelFilter(l)} className={`text-xs px-2.5 py-1 rounded-full capitalize ${levelFilter === l ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 border border-white/10'}`}>{l}</button>
          ))}
          <button onClick={load} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm">{l('No logs found')}</div>
      ) : (
        <div className="space-y-1.5 max-h-[500px] overflow-y-auto font-mono text-xs">
          {filtered.map(log => (
            <div key={log.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                log.level === 'error' ? 'bg-red-500/10 text-red-400' :
                log.level === 'warning' ? 'bg-amber-500/10 text-amber-400' :
                'bg-blue-500/10 text-blue-400'
              }`}>{log.level}</span>
              <span className="text-gray-500">[{log.category}]</span>
              <div className="flex-1 min-w-0">
                <div className="text-gray-300">{log.message}</div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div className="text-[10px] text-gray-600 mt-1 break-all">
                    {Object.entries(log.metadata).map(([key, value]) => `${key}=${String(value)}`).join(' · ')}
                  </div>
                )}
              </div>
              <span className="text-gray-600 flex-shrink-0">{new Date(log.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlocksTab() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [rows, setRows] = useState<{ email: string; reason: string; blocked_by_email: string; blocked_at: string; expires_at: string | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase.rpc('admin_list_account_blocks');
    if (queryError) {
      setRows([]);
      setError(queryError.message || 'Could not load account blocks.');
    } else {
      setRows((data || []) as typeof rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function unblock(email: string) {
    const { error: actionError } = await supabase.rpc('admin_unblock_email', { p_email: email });
    if (actionError) {
      showError(actionError.message || 'Failed to remove block');
      return;
    }
    success('Email unblocked');
    void load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (error) return <AdminTabError title={l('Account blocks unavailable')} message={error} onRetry={() => void load()} />;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <div>
          <h3 className="text-white font-semibold">{l('Account Block List')}</h3>
          <p className="text-xs text-gray-500 mt-1">{l('Blocks survive account deletion and prevent re-registration while active.')}</p>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">{l('No blocked emails')}</div>
      ) : (
        <div className="divide-y divide-white/5">
          {rows.map(row => (
            <div key={row.email} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white break-all">{row.email}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${row.active ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-gray-500/10 text-gray-400 border-white/10'}`}>
                    {row.active ? l('Blocked') : l('Expired')}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{row.reason || l('No reason provided')}</div>
                <div className="text-[10px] text-gray-600 mt-1">
                  {l('By')}: {row.blocked_by_email || 'admin'} · {new Date(row.blocked_at).toLocaleString()}
                  {row.expires_at ? ` · ${l('Expires')}: ${new Date(row.expires_at).toLocaleString()}` : ` · ${l('Permanent')}`}
                </div>
              </div>
              {row.active && (
                <button onClick={() => void unblock(row.email)} className="px-3 py-2 rounded-xl text-sm text-amber-200 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10">
                  {l('Unblock')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReadinessStatus {
  connected?: boolean;
  mode?: string;
  account?: { chargesEnabled?: boolean; payoutsEnabled?: boolean };
  plans?: {
    pro?: { valid?: boolean; priceId?: string | null };
    business?: { valid?: boolean; priceId?: string | null };
  };
  webhook?: { endpointConfigured?: boolean; receivesRequiredEvents?: boolean; status?: string | null };
  checkoutReady?: boolean;
  portalReady?: boolean;
}

function ReadinessTab() {
  const l = useLocalizer();
  const [status, setStatus] = useState<ReadinessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke('billing-admin-status', { body: {} });
    if (invokeError) {
      setStatus(null);
      setError(invokeError.message || 'Could not load production readiness.');
    } else {
      setStatus((data || null) as ReadinessStatus | null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (error) return <AdminTabError title={l('Production readiness unavailable')} message={error} onRetry={() => void load()} />;

  const checks = [
    { label: 'Stripe connection', ok: status?.connected === true, detail: status?.mode || 'unconfigured' },
    { label: 'Stripe charges', ok: status?.account?.chargesEnabled === true, detail: status?.account?.chargesEnabled ? 'enabled' : 'needs attention' },
    { label: 'Stripe payouts', ok: status?.account?.payoutsEnabled === true, detail: status?.account?.payoutsEnabled ? 'enabled' : 'needs attention' },
    { label: 'Pro price', ok: status?.plans?.pro?.valid === true, detail: status?.plans?.pro?.priceId || 'missing' },
    { label: 'Business price', ok: status?.plans?.business?.valid === true, detail: status?.plans?.business?.priceId || 'missing' },
    { label: 'Stripe webhook', ok: status?.webhook?.endpointConfigured === true && status?.webhook?.receivesRequiredEvents === true, detail: status?.webhook?.status || 'not verified' },
    { label: 'Checkout', ok: status?.checkoutReady === true, detail: status?.checkoutReady ? 'ready' : 'needs setup' },
    { label: 'Billing portal', ok: status?.portalReady === true, detail: status?.portalReady ? 'ready' : 'needs setup' },
  ];

  const readyCount = checks.filter(item => item.ok).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold">{l('Production Readiness')}</h3>
          <p className="text-xs text-gray-500 mt-1">{l('Live service checks before launch. Secrets remain server-side.')}</p>
        </div>
        <div className={`text-sm font-semibold px-3 py-1.5 rounded-full border ${readyCount === checks.length ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'}`}>
          {readyCount}/{checks.length} {l('ready')}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {checks.map(item => (
          <div key={l(item.label)} className="rounded-xl border border-white/10 bg-[#0b0b18] p-4 flex items-start gap-3">
            {item.ok ? <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" /> : <XCircle className="w-5 h-5 text-amber-400 mt-0.5" />}
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">{l(item.label)}</div>
              <div className="text-xs text-gray-500 mt-1 break-all">{l(item.detail)}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={() => void load()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 border border-white/10 bg-white/[0.03] hover:bg-white/5">
          <RefreshCw className="w-4 h-4" /> {l('Refresh')}
        </button>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; type: string; read: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) {
      setNotifications([]);
      setLoadError(error.message || 'Failed to load notifications.');
    } else {
      setNotifications((data || []) as typeof notifications);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markAllRead() {
    const { error } = await supabase.from('admin_notifications').update({ read: true }).eq('read', false);
    if (error) {
      showError(error.message || 'Failed to mark notifications as read');
      return;
    }
    success('All notifications marked as read');
    void load();
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (loadError) return <AdminTabError title={l('Notifications unavailable')} message={loadError} onRetry={() => void load()} />;

  const typeColors: Record<string, string> = {
    info: 'text-blue-400 bg-blue-500/10', warning: 'text-amber-400 bg-amber-500/10',
    error: 'text-red-400 bg-red-500/10', success: 'text-emerald-400 bg-emerald-500/10',
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">{l('Admin Notifications')}</h3>
        <button onClick={markAllRead} className="text-xs text-violet-400 hover:text-violet-300">{l('Mark all read')}</button>
      </div>
      {notifications.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm">{l('No notifications')}</div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border ${n.read ? 'bg-white/[0.02] border-white/5' : 'bg-violet-500/5 border-violet-500/10'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColors[n.type] || typeColors.info}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{n.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{n.message}</div>
                <div className="text-xs text-gray-600 mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmailTab() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [templates, setTemplates] = useState<{ id: string; key: string; subject: string; body: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('email_templates').select('id, key, subject, body').order('key');
    if (error) {
      setTemplates([]);
      setLoadError(error.message || 'Failed to load email templates.');
    } else {
      setTemplates((data || []) as typeof templates);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveTemplate(t: { id: string; subject: string; body: string }) {
    const { error } = await supabase.from('email_templates').update({ subject: t.subject, body: t.body, updated_at: new Date().toISOString() }).eq('id', t.id);
    if (error) showError('Failed to save template');
    else { success('Template saved'); setEditing(null); void load(); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (loadError) return <AdminTabError title={l('Email templates unavailable')} message={loadError} onRetry={() => void load()} />;

  return (
    <div className="space-y-3">
      {templates.map(t => {
        const isEditing = editing === t.id;
        return (
          <div key={t.id} className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <Mail className="w-4.5 h-4.5 text-violet-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white capitalize">{t.key.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500">Template key: {t.key}</div>
                </div>
              </div>
              {isEditing ? (
                <button onClick={() => saveTemplate(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors">
                  <Save className="w-3.5 h-3.5" />{l('Save')}</button>
              ) : (
                <button onClick={() => setEditing(t.id)} className="text-xs text-violet-400 hover:text-violet-300">{l('Edit')}</button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  defaultValue={t.subject}
                  onChange={e => { t.subject = e.target.value; }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
                  placeholder={l('Email subject')}
                />
                <textarea
                  defaultValue={t.body}
                  onChange={e => { t.body = e.target.value; }}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40 resize-none font-mono"
                  placeholder="Email body (use {{name}}, {{reset_link}}, etc. for variables)"
                />
              </div>
            ) : (
              <div>
                <div className="text-sm text-gray-300 mb-1">Subject: {t.subject}</div>
                <div className="text-xs text-gray-500 whitespace-pre-wrap line-clamp-3">{t.body}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BackupsTab() {
  const l = useLocalizer();

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">{l('Database Backups')}</h3>
          <p className="mt-1 text-sm text-gray-400">
            {l('Backups are managed by the database hosting provider. No in-app backup API is configured, so this panel will not pretend to create or download backups.')}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            {l('Use the Supabase project backup controls for real backup and restore operations.')}
          </p>
        </div>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const l = useLocalizer();
  const [keys, setKeys] = useState<{ id: string; service: string; label: string; status: string; last_used: string | null; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('api_keys').select('id, service, label, status, last_used, created_at').order('service');
    if (error) {
      setKeys([]);
      setLoadError(error.message || 'Failed to load API key metadata.');
    } else {
      setKeys((data || []) as typeof keys);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (loadError) return <AdminTabError title={l('API key metadata unavailable')} message={loadError} onRetry={() => void load()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{l('API key inventory only')}</div>
          <p className="mt-1 text-xs leading-5 text-gray-400">{l('These rows are metadata and do not enable or disable the production secrets used by Edge Functions. Rotate or remove live secrets in Supabase project secrets.')}</p>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm">{l('API Keys')}</h3>
            <p className="text-gray-500 text-xs">{l('Read-only service metadata')}</p>
          </div>
          <span className="text-[10px] text-gray-500 text-right">{l('Metadata only — secrets stay server-side')}</span>
        </div>
        <div className="space-y-2">
          {keys.map(k => (
            <div key={k.id} className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 sm:flex-row sm:items-center">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${k.status === 'active' ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                <Key className={`w-4.5 h-4.5 ${k.status === 'active' ? 'text-emerald-400' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{k.label}</div>
                <div className="text-xs text-gray-500 capitalize">{k.service} · Added {new Date(k.created_at).toLocaleDateString()}</div>
              </div>
              {k.last_used && <span className="text-xs text-gray-600">Last used: {new Date(k.last_used).toLocaleDateString()}</span>}
              <span className={`inline-flex w-fit items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${k.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
                <Key className="w-3 h-3" /> {k.status} metadata
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlagsTab() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [flags, setFlags] = useState<{ id: string; key: string; label: string; enabled: boolean; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('feature_flags').select('id, key, label, enabled, description').order('key');
    if (error) {
      setFlags([]);
      setLoadError(error.message || 'Failed to load feature flags.');
    } else {
      setFlags((data || []) as typeof flags);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(flag: { id: string; key: string; label: string; enabled: boolean }) {
    const newVal = !flag.enabled;
    setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: newVal } : f));
    const { error } = await supabase.from('feature_flags').update({ enabled: newVal, updated_at: new Date().toISOString() }).eq('id', flag.id);
    if (error) {
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !newVal } : f));
      showError('Failed to toggle flag');
    } else {
      success(`${flag.label} ${newVal ? 'enabled' : 'disabled'}`);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>;
  if (loadError) return <AdminTabError title={l('Feature flags unavailable')} message={loadError} onRetry={() => void load()} />;

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-sm">{l('Feature Flags')}</h3>
          <p className="text-gray-500 text-xs">{l('Toggle features on/off without deploying')}</p>
        </div>
        <span className="text-[10px] text-gray-500">{l('Existing flags only')}</span>
      </div>
      <div className="space-y-2">
        {flags.map(f => (
          <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${f.enabled ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
              <Flag className={`w-4.5 h-4.5 ${f.enabled ? 'text-emerald-400' : 'text-gray-500'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{l(f.label)}</div>
              <div className="text-xs text-gray-500">{f.description}</div>
              <div className="text-[10px] text-gray-600 font-mono mt-0.5">{f.key}</div>
            </div>
            <button onClick={() => toggle(f)} className="transition-transform hover:scale-110">
              <div className={`w-11 h-6 rounded-full transition-colors ${f.enabled ? 'bg-emerald-500' : 'bg-gray-700'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
