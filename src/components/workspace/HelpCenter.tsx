import { useLocalizer } from '@/lib/ui-localization';
import { useState } from 'react';
import { LifeBuoy, ChevronDown, Send, Loader2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

const FAQS = [
  { q: 'How do I get started?', a: 'Open My Workspace or Dashboard, choose an available tool, and follow the inputs shown for that tool. Website Builder V1 is available for creating and publishing responsive websites.' },
  { q: 'Which interface languages are supported?', a: 'The product interface supports English, Arabic, and Swedish. Arabic automatically uses right-to-left layout where appropriate.' },
  { q: 'How does Website Builder billing work?', a: 'Free supports 1 website project with up to 3 pages. Pro supports up to 10 website projects and 25 pages per website. Business supports up to 50 website projects and 100 pages per website.' },
  { q: 'Is my data protected?', a: 'The application uses authenticated access and database row-level security for account-scoped data. Always keep your account credentials private and review sensitive AI output before sharing it.' },
  { q: 'How do I manage my subscription?', a: 'Open Subscription from the workspace menu. New upgrades use Stripe Checkout, and existing paid subscriptions can be managed through the Stripe billing portal.' },
  { q: 'How do I report a bug?', a: 'Open Support and choose Report a Bug. Include the affected tool, severity, steps to reproduce, expected behavior, and actual behavior.' },
  { q: 'How do I delete my account?', a: 'Open Settings, go to Security, and use the account deletion controls. Account deletion is permanent and should only be used when you are sure.' },
];

export default function HelpCenter() {
  const l = useLocalizer();
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [search, setSearch] = useState('');
  const { loading, update } = useToast();
  const [contactMsg, setContactMsg] = useState('');
  const [sending, setSending] = useState(false);

  const filtered = FAQS.filter(f =>
    l(f.q).toLowerCase().includes(search.toLowerCase()) ||
    l(f.a).toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!contactMsg) return;
    setSending(true);
    const toastId = loading('Sending support request...');
    const { error } = await supabase.from('support_tickets').insert({ subject: 'Help Center request', body: contactMsg, type: 'support', priority: 'medium' });
    if (error) {
      update(toastId, l('Failed to send support request. Please try again.'), 'error');
      setSending(false);
      return;
    }
    update(toastId, l('Support request sent'), 'success');
    setContactMsg('');
    setSending(false);
  }

  return (
    <PageShell icon={LifeBuoy} title={l('Help Center')} subtitle={l('Find answers to common questions and get support.')}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={l('Search help articles...')}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:outline-none mb-6"
      />

      <div className="space-y-2 mb-8">
        {filtered.map((faq, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-white text-sm font-medium">{l(faq.q)}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed">{l(faq.a)}</div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">{l('No results found. Try a different search.')}</div>
        )}
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-white text-sm font-semibold mb-2">{l('Still need help?')}</h3>
        <p className="text-gray-500 text-xs mb-3">{l("Send us a message and we'll get back to you within 24 hours.")}</p>
        <textarea value={contactMsg} onChange={e => setContactMsg(e.target.value)} placeholder={l('Describe your issue...')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none min-h-[100px] resize-y mb-3" />
        <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {l('Send Support Request')}
        </button>
      </div>
    </PageShell>
  );
}
