import React, { useState } from 'react';
import { History, Loader2, Plus } from 'lucide-react';
import { ResumeVersion } from '@/lib/cv-types';

interface Props {
  versions: ResumeVersion[];
  loading?: boolean;
  onSave: () => void | Promise<unknown>;
  onRestore: (version: ResumeVersion) => void | Promise<unknown>;
}

function formatVersionDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
}

export function CVVersionsPanel({ versions, loading = false, onSave, onRestore }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => void | Promise<unknown>) => {
    if (busy || loading) return;
    setBusy(key);
    try { await action(); } finally { setBusy(null); }
  };

  const disabled = loading || busy !== null;
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><h3 className="text-white text-sm font-semibold">Version History</h3><button type="button" onClick={() => void run('save', onSave)} disabled={disabled} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50">{busy === 'save' ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : <Plus aria-hidden="true" className="w-3.5 h-3.5" />} Save Current</button></div>
    {loading && !versions.length ? <div className="text-center py-8" role="status"><Loader2 aria-hidden="true" className="w-6 h-6 text-gray-600 mx-auto mb-2 animate-spin" /><p className="text-gray-500 text-xs">Loading versions…</p></div> : !versions.length ? <div className="text-center py-8"><History aria-hidden="true" className="w-8 h-8 text-gray-700 mx-auto mb-2" /><p className="text-gray-500 text-xs font-medium">No versions yet</p><p className="text-gray-600 text-xs mt-0.5">Save a snapshot to restore it later.</p></div> : <div className="space-y-2">{versions.map(version => {
      const restoreKey = `restore:${version.id}`;
      return <div key={version.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-white text-xs font-medium truncate">{version.version_label || 'Version'}</div><div className="text-gray-500 text-[10px]">{formatVersionDate(version.created_at)}</div></div><button type="button" onClick={() => void run(restoreKey, () => onRestore(version))} disabled={disabled} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:bg-violet-600/10 disabled:opacity-50 px-3 py-1.5 rounded-lg">{busy === restoreKey && <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin" />} Restore</button></div>;
    })}</div>}
  </div>;
}
