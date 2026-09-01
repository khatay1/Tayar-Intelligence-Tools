import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Pause, Play, RefreshCw, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'tayar-admin-template-audit-v2';
const PAGE_SIZE = 12;

type AuditIssue = {
  id?: string;
  title?: string;
  filename?: string;
  storagePath?: string;
  issue?: string;
  reason?: string;
  detected?: string;
};

type AuditState = {
  offset: number;
  total: number | null;
  scanned: number;
  valid: number;
  invalid: number;
  missing: number;
  issues: AuditIssue[];
  completed: boolean;
  updatedAt: string | null;
};

const emptyState = (): AuditState => ({
  offset: 0,
  total: null,
  scanned: 0,
  valid: 0,
  invalid: 0,
  missing: 0,
  issues: [],
  completed: false,
  updatedAt: null,
});

function loadStoredState(): AuditState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<AuditState> | null;
    if (!parsed) return emptyState();
    return {
      ...emptyState(),
      ...parsed,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return emptyState();
  }
}

function saveState(state: AuditState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function TemplateLibraryAuditCard() {
  const [state, setState] = useState<AuditState>(() => loadStoredState());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(0);

  const progress = state.total && state.total > 0
    ? Math.min(100, Math.round((state.scanned / state.total) * 100))
    : 0;

  const issueSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const issue of state.issues) {
      const key = issue.reason || issue.issue || 'Unknown issue';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [state.issues]);

  const applyState = (next: AuditState) => {
    setState(next);
    saveState(next);
  };

  async function runAudit(restart = false) {
    if (running) return;
    const runId = ++runRef.current;
    setRunning(true);
    setError(null);

    let current = restart ? emptyState() : loadStoredState();
    if (restart) applyState(current);

    try {
      while (runRef.current === runId) {
        const { data, error: invokeError } = await supabase.functions.invoke('template-library-audit', {
          body: { offset: current.offset, limit: PAGE_SIZE },
        });

        if (invokeError) throw invokeError;
        if (!data?.ok) throw new Error(data?.error || 'Template audit failed.');

        const batchScanned = Number(data.scanned || 0);
        const nextOffset = data.nextOffset == null ? null : Number(data.nextOffset);
        const batchIssues = Array.isArray(data.issues) ? data.issues as AuditIssue[] : [];

        current = {
          offset: nextOffset ?? Number(data.total || current.total || 0),
          total: Number(data.total || 0),
          scanned: current.scanned + batchScanned,
          valid: current.valid + Number(data.valid || 0),
          invalid: current.invalid + Number(data.invalid || 0),
          missing: current.missing + Number(data.missing || 0),
          issues: [...current.issues, ...batchIssues],
          completed: nextOffset === null,
          updatedAt: new Date().toISOString(),
        };

        applyState(current);
        if (nextOffset === null || batchScanned === 0) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template audit failed.');
    } finally {
      if (runRef.current === runId) setRunning(false);
    }
  }

  function pauseAudit() {
    runRef.current += 1;
    setRunning(false);
  }

  function resetAudit() {
    runRef.current += 1;
    setRunning(false);
    setError(null);
    const next = emptyState();
    localStorage.removeItem(STORAGE_KEY);
    setState(next);
  }

  function exportIssues() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tayar-template-audit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            Template Library Integrity Audit
          </div>
          <p className="mt-1 max-w-3xl text-xs text-gray-400">
            Read-only validation of stored 24Billions templates. Progress is saved in this browser and can be paused or resumed safely.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <button onClick={() => runAudit(state.scanned === 0)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500">
              <Play className="h-4 w-4" /> {state.scanned > 0 && !state.completed ? 'Resume Audit' : state.completed ? 'Run Again' : 'Start Audit'}
            </button>
          ) : (
            <button onClick={pauseAudit} className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25">
              <Pause className="h-4 w-4" /> Pause
            </button>
          )}
          <button onClick={resetAudit} disabled={running} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button onClick={exportIssues} disabled={!state.issues.length} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{state.scanned.toLocaleString()} / {(state.total ?? 0).toLocaleString()} scanned</span>
        <span>{progress}%</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Valid" value={state.valid} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
        <Metric label="Invalid" value={state.invalid} icon={<XCircle className="h-4 w-4 text-red-400" />} />
        <Metric label="Missing" value={state.missing} icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} />
        <Metric label="Status" value={running ? 'Running' : state.completed ? 'Complete' : state.scanned ? 'Paused' : 'Idle'} icon={<RefreshCw className={`h-4 w-4 text-cyan-400 ${running ? 'animate-spin' : ''}`} />} />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {error} Progress is still saved; use Resume Audit after the problem is resolved.
        </div>
      )}

      {issueSummary.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
          <div className="mb-3 text-xs font-semibold text-white">Detected issues</div>
          <div className="space-y-2">
            {issueSummary.slice(0, 8).map(([reason, count]) => (
              <div key={reason} className="flex items-start justify-between gap-4 text-xs">
                <span className="text-gray-400">{reason}</span>
                <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-red-300">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center gap-2 text-[11px] text-gray-500">{icon}{label}</div>
      <div className="mt-1 text-lg font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}
