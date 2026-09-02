import { useLocalizer } from '@/lib/ui-localization';
import { useState, useEffect, useCallback } from 'react';
import { LifeBuoy, Loader2, Bug, Lightbulb, MessageSquare, X, Send, Clock, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  type: string;
  status: string;
  priority: string;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminSupport() {
  const l = useLocalizer();
  const { success, error: showError } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'bug' | 'feature'>('all');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [response, setResponse] = useState('');
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load admin support tickets:', error);
      setTickets([]);
      setLoadError(error.message || 'Failed to load support tickets.');
    } else {
      setTickets((data || []) as Ticket[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = tickets.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'open' || filter === 'closed') return t.status === filter;
    return t.type === filter;
  });

  async function respond() {
    if (!selected || !response.trim()) return;
    setResponding(true);
    const { error } = await supabase
      .from('support_tickets')
      .update({ admin_response: response, status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', selected.id);
    if (error) showError('Failed to send response');
    else {
      success('Response sent and ticket closed');
      setSelected(null);
      setResponse('');
      void load();
    }
    setResponding(false);
  }

  async function changeStatus(ticket: Ticket, status: string) {
    const { error } = await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticket.id);
    if (error) showError('Failed to update ticket');
    else { success('Ticket updated'); void load(); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-violet-500 animate-spin" /></div>;
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-semibold mb-2">{l('Support data unavailable')}</h2>
        <p className="text-sm text-gray-400 mb-4">{loadError}</p>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          <RefreshCw className="w-4 h-4" /> {l('Retry')}
        </button>
      </div>
    );
  }

  const typeIcons: Record<string, typeof Bug> = {
    ticket: MessageSquare, bug: Bug, feature: Lightbulb,
  };
  const typeColors: Record<string, string> = {
    ticket: 'text-blue-400 bg-blue-500/10',
    bug: 'text-red-400 bg-red-500/10',
    feature: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Open Tickets', value: tickets.filter(t => t.status === 'open').length, filter: 'open' as const, icon: MessageSquare, color: 'blue' },
          { label: 'Closed', value: tickets.filter(t => t.status === 'closed').length, filter: 'closed' as const, icon: CheckCircle, color: 'emerald' },
          { label: 'Bug Reports', value: tickets.filter(t => t.type === 'bug').length, filter: 'bug' as const, icon: Bug, color: 'red' },
          { label: 'Feature Requests', value: tickets.filter(t => t.type === 'feature').length, filter: 'feature' as const, icon: Lightbulb, color: 'amber' },
        ].map(s => {
          const colors: Record<string, string> = {
            blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            red: 'bg-red-500/10 text-red-400 border-red-500/20',
            amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          };
          const Icon = s.icon;
          return (
            <button key={l(s.label)} onClick={() => setFilter(s.filter)} className={`rounded-xl border p-3 text-left hover:scale-[1.02] transition-transform ${colors[s.color]} ${filter === s.filter ? 'ring-2 ring-white/20' : ''}`}>
              <Icon className="w-5 h-5 mb-1" />
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400">{l(s.label)}</div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1.5 rounded-full ${filter === 'all' ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-400 border border-white/10'}`}>{l('All')}</button>
      </div>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <LifeBuoy className="w-10 h-10 text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{l('No tickets found')}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map(t => {
              const Icon = typeIcons[t.type] || MessageSquare;
              return (
                <div key={t.id} className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => { setSelected(t); setResponse(t.admin_response || ''); }}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[t.type] || typeColors.ticket}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{t.subject}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          t.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'
                        }`}>{t.status}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          t.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                          t.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>{t.priority}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-1">{t.body}</p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(t.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket detail modal */}
      {selected && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#12122a] border border-white/10 rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ animation: 'fadeInUp 0.2s ease-out' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">{selected.subject}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 capitalize">{selected.type}</span>
                <span className={`px-2 py-0.5 rounded-full ${selected.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'}`}>{selected.status}</span>
                <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-400 capitalize">{selected.priority}</span>
                <span className="text-gray-600 ml-auto">{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.body}</p>
              </div>
              {selected.admin_response && (
                <div className="bg-violet-500/5 rounded-xl p-4 border border-violet-500/10">
                  <div className="text-xs text-violet-400 font-medium mb-1">{l('Admin Response')}</div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{selected.admin_response}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">{l('Response')}</label>
                <textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  placeholder={l("Type your response...")}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-violet-500/40 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => changeStatus(selected, selected.status === 'open' ? 'closed' : 'open')} className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors">
                  {selected.status === 'open' ? 'Close Ticket' : 'Reopen'}
                </button>
                <button onClick={respond} disabled={responding || !response.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  {responding ? 'Sending...' : 'Send & Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
