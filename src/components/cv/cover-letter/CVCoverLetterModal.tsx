import React from 'react';
import { Copy, Mail, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props { open: boolean; body: string; onClose: () => void; }

export function CVCoverLetterModal({ open, body, onClose }: Props) {
  if (!open || !body) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(body); toast.success('Copied to clipboard'); }
    catch { toast.error('Could not copy to clipboard'); }
  };
  return <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby="cv-cover-letter-title" className="bg-[#0a0a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5"><div className="flex items-center gap-2"><Mail className="w-5 h-5 text-fuchsia-400" /><h3 id="cv-cover-letter-title" className="text-white font-bold text-base">Cover Letter</h3></div><div className="flex items-center gap-2"><button onClick={copy} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/5"><Copy className="w-3.5 h-3.5" /> Copy</button><button aria-label="Close cover letter" onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4" /></button></div></div>
      <div className="flex-1 overflow-y-auto p-5"><div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{body}</div></div>
    </div>
  </div>;
}
