import React from 'react';
import { Check, Sparkles, Trash2 } from 'lucide-react';
import { CVProposal } from './cv-proposals';

interface Props {
  proposals: CVProposal[];
  onVerifyApply: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function CVAIProposalPanel({ proposals, onVerifyApply, onDismiss }: Props) {
  if (!proposals.length) return null;
  return <div className="space-y-2 border-t border-white/5 pt-4">
    <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /><h3 className="text-white text-sm font-semibold">AI proposals to review</h3></div>
    <p className="text-gray-500 text-[11px]">Verify that each suggestion is factually true before applying it to your CV.</p>
    {proposals.map(proposal => <div key={proposal.id} className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-3 space-y-2"><div className="text-[10px] uppercase tracking-wide text-violet-400">{proposal.kind}</div><div className="text-xs text-white whitespace-pre-wrap">{proposal.proposed}</div><div className="text-[10px] text-gray-500">{proposal.reason}</div><div className="flex gap-2"><button onClick={() => onVerifyApply(proposal.id)} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs py-2"><Check className="w-3.5 h-3.5" /> Verify & apply</button><button onClick={() => onDismiss(proposal.id)} className="px-3 rounded-lg border border-white/10 text-gray-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}
  </div>;
}
