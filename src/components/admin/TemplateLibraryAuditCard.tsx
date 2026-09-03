import { useLocalizer } from '@/lib/ui-localization';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Download, Pause, Play, RefreshCw, RotateCcw, ShieldCheck, Trash2, Wrench, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'tayar-admin-template-audit-v2';
const PAGE_SIZE = 12;
const REPAIR_BATCH_SIZE = 12;

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

type RepairAnalysis = {
  requested: number;
  repairable: number;
  hideJunk: number;
  unchanged: number;
  failed: number;
};

type DeletionResult = {
  requested: number;
  deletedRows: number;
  missingRows: number;
  storageDeleted: number;
  preservedSharedStorage: number;
  storageDeleteFailures: number;
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
    return { ...emptyState(), ...parsed, issues: Array.isArray(parsed.issues) ? parsed.issues : [] };
  } catch {
    return emptyState();
  }
}

function saveState(state: AuditState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function TemplateLibraryAuditCard() {
  const l = useLocalizer();
const [state, setState] = useState<AuditState>(() => loadStoredState());
  const [running, setRunning] = useState(false);
  const [analyzingRepairs, setAnalyzingRepairs] = useState(false);
  const [deletingInvalid, setDeletingInvalid] = useState(false);
  const [repairAnalysis, setRepairAnalysis] = useState<RepairAnalysis | null>(null);
  const [deletionResult, setDeletionResult] = useState<DeletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef(0);

  const progress = state.total && state.total > 0
    ? Math.min(100, Math.round((state.scanned / state.total) * 100))
    : 0;

  const uniqueIssueIds = useMemo(() => (
    [...new Set(state.issues.map(issue => issue.id).filter((id): id is string => Boolean(id)))]
  ), [state.issues]);

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
    if (running || analyzingRepairs || deletingInvalid) return;
    const runId = ++runRef.current;
    setRunning(true);
    setRepairAnalysis(null);
    setDeletionResult(null);
    setError(null);

    let current = restart ? emptyState() : loadStoredState();
    if (restart) applyState(current);

    try {
      while (runRef.current === runId) {
        const { data, error: invokeError } = await supabase.functions.invoke('template-library-audit', {
          body: { offset: current.offset, limit: PAGE_SIZE },
        });

        if (runRef.current !== runId) break;
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

  async function analyzeRepairs() {
    if (running || analyzingRepairs || deletingInvalid || !state.completed || uniqueIssueIds.length === 0) return;
    setAnalyzingRepairs(true);
    setRepairAnalysis(null);
    setDeletionResult(null);
    setError(null);

    const analysis: RepairAnalysis = {
      requested: uniqueIssueIds.length,
      repairable: 0,
      hideJunk: 0,
      unchanged: 0,
      failed: 0,
    };

    try {
      for (let index = 0; index < uniqueIssueIds.length; index += REPAIR_BATCH_SIZE) {
        const assetIds = uniqueIssueIds.slice(index, index + REPAIR_BATCH_SIZE);
        const { data, error: invokeError } = await supabase.functions.invoke('template-library-repair', {
          body: { assetIds, dryRun: true },
        });

        if (invokeError) throw invokeError;
        if (!data?.ok) throw new Error(data?.error || 'Repair analysis failed.');

        analysis.repairable += Number(data.repairable || 0);
        analysis.unchanged += Number(data.unchanged || 0);
        analysis.failed += Number(data.failed || 0);
        if (Array.isArray(data.results)) {
          analysis.hideJunk += data.results.filter((result: { action?: string }) => result?.action === 'hide-junk').length;
        }

        setRepairAnalysis({ ...analysis });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Repair analysis failed.');
    } finally {
      setAnalyzingRepairs(false);
    }
  }

  async function deleteInvalidAssets() {
    if (running || analyzingRepairs || deletingInvalid || !state.completed || uniqueIssueIds.length === 0) return;
    setDeletingInvalid(true);
    setDeletionResult(null);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('template-library-delete-invalid', {
        body: { assetIds: uniqueIssueIds },
      });

      if (invokeError) throw invokeError;
      if (!data?.ok) throw new Error(data?.error || 'Invalid template deletion failed.');

      setDeletionResult({
        requested: Number(data.requested || uniqueIssueIds.length),
        deletedRows: Number(data.deletedRows || 0),
        missingRows: Number(data.missingRows || 0),
        storageDeleted: Number(data.storageDeleted || 0),
        preservedSharedStorage: Number(data.preservedSharedStorage || 0),
        storageDeleteFailures: Array.isArray(data.storageDeleteFailures) ? data.storageDeleteFailures.length : 0,
      });

      localStorage.removeItem(STORAGE_KEY);
      setState(emptyState());
      setRepairAnalysis(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid template deletion failed.');
    } finally {
      setDeletingInvalid(false);
    }
  }

  function pauseAudit() {
    runRef.current += 1;
    setRunning(false);
  }

  function resetAudit() {
    runRef.current += 1;
    setRunning(false);
    setAnalyzingRepairs(false);
    setDeletingInvalid(false);
    setRepairAnalysis(null);
    setDeletionResult(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
    setState(emptyState());
  }

  function exportIssues() {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), repairAnalysis, ...state }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tayar-template-audit-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const busy = running || analyzingRepairs || deletingInvalid;

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />{l('Template Library Integrity Audit')}</div>
          <p className="mt-1 max-w-3xl text-xs text-gray-400">
            {l('Read-only validation of stored 24Billions templates. Progress is saved in this browser and can be paused or resumed safely.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <button onClick={() => runAudit(state.scanned === 0 || state.completed)} disabled={analyzingRepairs || deletingInvalid} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40">
              <Play className="h-4 w-4" /> {state.scanned > 0 && !state.completed ? l('Resume Audit') : state.completed ? l('Run Again') : l('Start Audit')}
            </button>
          ) : (
            <button onClick={pauseAudit} className="inline-flex items-center gap-2 rounded-xl bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/25">
              <Pause className="h-4 w-4" />{l('Pause')}</button>
          )}
          <button onClick={analyzeRepairs} disabled={busy || !state.completed || uniqueIssueIds.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40">
            <Wrench className={`h-4 w-4 ${analyzingRepairs ? 'animate-pulse' : ''}`} /> {analyzingRepairs ? l('Analyzing…') : l('Analyze Repairs')}
          </button>
          <button onClick={deleteInvalidAssets} disabled={busy || !state.completed || uniqueIssueIds.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40">
            <Trash2 className={`h-4 w-4 ${deletingInvalid ? 'animate-pulse' : ''}`} /> {deletingInvalid ? l('Deleting…') : l('Delete invalid templates')}
          </button>
          <button onClick={resetAudit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">
            <RotateCcw className="h-4 w-4" />{l('Reset')}</button>
          <button onClick={exportIssues} disabled={!state.issues.length || busy} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40">
            <Download className="h-4 w-4" />{l('Export')}</button>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
        <span>{state.scanned.toLocaleString()} / {(state.total ?? 0).toLocaleString()} {l('scanned')}</span>
        <span>{progress}%</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Valid" value={state.valid} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
        <Metric label="Invalid" value={state.invalid} icon={<XCircle className="h-4 w-4 text-red-400" />} />
        <Metric label="Missing" value={state.missing} icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} />
        <Metric label="Status" value={running ? 'Running' : analyzingRepairs ? 'Analyzing' : deletingInvalid ? 'Deleting' : state.completed ? 'Complete' : state.scanned ? 'Paused' : 'Idle'} icon={<RefreshCw className={`h-4 w-4 text-cyan-400 ${busy ? 'animate-spin' : ''}`} />} />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {error} {l('Audit progress is still saved unless deletion completed.')}
        </div>
      )}

      {deletionResult && (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-300">
            <Trash2 className="h-4 w-4" />{l('Invalid template deletion completed')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Rows deleted" value={deletionResult.deletedRows} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
            <Metric label="Storage deleted" value={deletionResult.storageDeleted} icon={<Trash2 className="h-4 w-4 text-red-400" />} />
            <Metric label="Shared preserved" value={deletionResult.preservedSharedStorage} icon={<ShieldCheck className="h-4 w-4 text-cyan-400" />} />
            <Metric label="Storage failures" value={deletionResult.storageDeleteFailures} icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} />
          </div>
          <p className="mt-3 text-[11px] text-gray-500">{l('The previous audit snapshot was cleared. Run the audit again to verify the remaining library.')}</p>
        </div>
      )}

      {repairAnalysis && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <Wrench className="h-4 w-4" />{l('Repair dry-run analysis')}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Issues checked" value={repairAnalysis.requested} icon={<ShieldCheck className="h-4 w-4 text-cyan-400" />} />
            <Metric label="Repairable" value={repairAnalysis.repairable} icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} />
            <Metric label="Junk to hide" value={repairAnalysis.hideJunk} icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} />
            <Metric label="Needs review" value={repairAnalysis.failed} icon={<XCircle className="h-4 w-4 text-red-400" />} />
          </div>
          <p className="mt-3 text-[11px] text-gray-500">{l('Analysis is read-only. No storage object or database row is changed by this button.')}</p>
        </div>
      )}

      {issueSummary.length > 0 && (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
          <div className="mb-3 text-xs font-semibold text-white">{l('Detected issues')}</div>
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

function Metric({ label, value, icon }: { label: string; value: number | string; icon: ReactNode }) {
  const l = useLocalizer();
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-center gap-2 text-[11px] text-gray-500">{icon}{l(label)}</div>
      <div className="mt-1 text-lg font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : l(String(value))}</div>
    </div>
  );
}
