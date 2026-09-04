import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { usePreferences } from '@/context/PreferencesContext';
import { supabase } from '@/lib/supabase';

type AuditSurface = 'all' | 'admin_settings' | 'tool_access_rules' | 'tool_plan_limits';
type AuditMetadata = {
  action?: string;
  surface?: string;
  target?: string;
  actor_user_id?: string;
  actor_email?: string;
  actor_role?: string;
  before?: unknown;
  after?: unknown;
};

type AuditRow = {
  id: string;
  message: string;
  metadata: AuditMetadata | null;
  created_at: string;
};

type AuditCopyLabels = {
  insert: string;
  update: string;
  delete: string;
  access: string;
  limits: string;
  settings: string;
};

const COPY = {
  en: {
    eyebrow: 'ADMIN V2', title: 'Audit History', description: 'Read-only history of important Admin configuration changes. Entries are written automatically by the database.',
    readonly: 'Append-only', refresh: 'Refresh', search: 'Search target or actor...', all: 'All', settings: 'Settings', access: 'Tool access', limits: 'Tool quotas',
    empty: 'No Admin audit events yet.', actor: 'Actor', before: 'Before', after: 'After', database: 'Database / service role', loadError: 'Could not load Admin audit history.',
    insert: 'Created', update: 'Updated', delete: 'Deleted', note: 'Admin users can read these events, but the Admin UI has no update or delete path for them.',
  },
  ar: {
    eyebrow: 'ADMIN V2', title: 'سجل تغييرات الإدارة', description: 'سجل للقراءة فقط للتغييرات المهمة في إعدادات الإدارة. قاعدة البيانات تكتب السجل تلقائيًا.',
    readonly: 'إضافة فقط', refresh: 'تحديث', search: 'ابحث عن الهدف أو المسؤول...', all: 'الكل', settings: 'الإعدادات', access: 'صلاحيات الأدوات', limits: 'حصص الأدوات',
    empty: 'لا توجد أحداث إدارية مسجلة بعد.', actor: 'المسؤول', before: 'قبل', after: 'بعد', database: 'قاعدة البيانات / Service role', loadError: 'تعذر تحميل سجل تغييرات الإدارة.',
    insert: 'إنشاء', update: 'تعديل', delete: 'حذف', note: 'يمكن للإدمن قراءة هذه الأحداث، لكن واجهة الإدارة لا تملك مسار تعديل أو حذف لها.',
  },
  sv: {
    eyebrow: 'ADMIN V2', title: 'Ändringshistorik', description: 'Skrivskyddad historik över viktiga ändringar i Admin-konfigurationen. Händelser skrivs automatiskt av databasen.',
    readonly: 'Endast tillägg', refresh: 'Uppdatera', search: 'Sök mål eller administratör...', all: 'Alla', settings: 'Inställningar', access: 'Verktygsåtkomst', limits: 'Verktygskvoter',
    empty: 'Inga Admin-händelser har loggats ännu.', actor: 'Aktör', before: 'Före', after: 'Efter', database: 'Databas / service role', loadError: 'Det gick inte att läsa Admin-historiken.',
    insert: 'Skapad', update: 'Uppdaterad', delete: 'Raderad', note: 'Admin-användare kan läsa händelserna, men Admin-gränssnittet har ingen väg för att ändra eller radera dem.',
  },
} as const;

function actionLabel(action: string | undefined, copy: AuditCopyLabels): string {
  if (action === 'insert') return copy.insert;
  if (action === 'delete') return copy.delete;
  return copy.update;
}

function surfaceLabel(surface: string | undefined, copy: AuditCopyLabels): string {
  if (surface === 'tool_access_rules') return copy.access;
  if (surface === 'tool_plan_limits') return copy.limits;
  return copy.settings;
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return '—';
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function AdminAuditHistoryV2() {
  const { prefs } = usePreferences();
  const c = COPY[prefs.language];
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<AuditSurface>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('system_logs')
      .select('id, message, metadata, created_at')
      .eq('category', 'admin_audit')
      .order('created_at', { ascending: false })
      .limit(100);

    if (queryError) {
      setRows([]);
      setError(queryError.message || c.loadError);
    } else {
      setRows((data || []) as AuditRow[]);
    }
    setLoading(false);
  }, [c.loadError]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter(row => {
      const metadata = row.metadata || {};
      if (surface !== 'all' && metadata.surface !== surface) return false;
      if (!needle) return true;
      return [row.message, metadata.target, metadata.actor_email, metadata.actor_user_id, metadata.actor_role]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle));
    });
  }, [rows, search, surface]);

  const filters: { id: AuditSurface; label: string }[] = [
    { id: 'all', label: c.all },
    { id: 'admin_settings', label: c.settings },
    { id: 'tool_access_rules', label: c.access },
    { id: 'tool_plan_limits', label: c.limits },
  ];

  return (
    <section className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.035] p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">{c.eyebrow}</div>
          <div className="mt-1 flex items-center gap-2"><History className="h-5 w-5 text-violet-300" /><h2 className="text-xl font-bold text-white">{c.title}</h2></div>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">{c.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 text-xs font-semibold text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />{c.readonly}</span>
          <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-gray-300 hover:bg-white/[0.06]"><RefreshCw className="h-4 w-4" />{c.refresh}</button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-xs leading-5 text-gray-400">{c.note}</div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filters.map(filter => (
            <button key={filter.id} onClick={() => setSurface(filter.id)} className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${surface === filter.id ? 'border-violet-500/30 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.025] text-gray-400 hover:text-white'}`}>{filter.label}</button>
          ))}
        </div>
        <div className="relative min-w-0 lg:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={c.search} className="min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-violet-500/40 focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] py-10 text-center text-sm text-gray-500">{c.empty}</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(row => {
            const metadata = row.metadata || {};
            const action = metadata.action || 'update';
            const actor = metadata.actor_email || metadata.actor_user_id || metadata.actor_role || c.database;
            const actionClass = action === 'delete' ? 'bg-red-500/10 text-red-300' : action === 'insert' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-blue-500/10 text-blue-300';
            return (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${actionClass}`}>{actionLabel(action, c)}</span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-gray-400">{surfaceLabel(metadata.surface, c)}</span>
                      <span className="break-all text-sm font-semibold text-white">{metadata.target || row.message}</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{c.actor}: <span className="text-gray-300">{actor}</span></div>
                  </div>
                  <time className="shrink-0 text-xs text-gray-600">{new Date(row.created_at).toLocaleString()}</time>
                </div>

                <details className="mt-3 rounded-xl border border-white/5 bg-black/10">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-400 hover:text-white">{c.before} → {c.after}</summary>
                  <div className="grid gap-2 border-t border-white/5 p-3 lg:grid-cols-2">
                    <div className="min-w-0"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">{c.before}</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-2 text-[11px] leading-5 text-gray-400">{stringify(metadata.before)}</pre></div>
                    <div className="min-w-0"><div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-600">{c.after}</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-2 text-[11px] leading-5 text-gray-300">{stringify(metadata.after)}</pre></div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
