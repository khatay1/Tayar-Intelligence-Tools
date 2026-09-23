import React from 'react';
import { History, Plus } from 'lucide-react';
import { ResumeVersion } from '@/lib/cv-types';

interface Props { versions: ResumeVersion[]; loading?: boolean; onSave: () => void; onRestore: (version: ResumeVersion) => void; }

export function CVVersionsPanel({ versions, loading, onSave, onRestore }: Props) {
  return <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-white text-sm font-semibold">Version History</h3><button onClick={onSave} disabled={loading} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Save Current</button></div>
    {!versions.length ? <div className="text-center py-8"><History className="w-8 h-8 text-gray-700 mx-auto mb-2" /><p className="text-gray-500 text-xs font-medium">No versions yet</p><p className="text-gray-600 text-xs mt-0.5">Save a snapshot to restore it later.</p></div> : <div className="space-y-2">{versions.map(version => <div key={version.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3 flex items-center justify-between"><div><div className="text-white text-xs font-medium">{version.version_label}</div><div className="text-gray-500 text-[10px]">{new Date(version.created_at).toLocaleString()}</div></div><button onClick={() => onRestore(version)} className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:bg-violet-600/10 px-3 py-1.5 rounded-lg">Restore</button></div>)}</div>}
  </div>;
}
