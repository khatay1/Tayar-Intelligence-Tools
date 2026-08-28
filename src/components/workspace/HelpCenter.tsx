import { useState } from 'react';
import { LifeBuoy, ChevronDown, Send, Loader2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';

const FAQS = [
  { q: 'How do I get started with AI tools?', a: 'Sign up for a free account, then navigate to the Dashboard. Click any tool card to start using it. Most tools have a simple input form — fill it out and click generate.' },
  { q: 'Which AI models do you support?', a: 'We support OpenAI (GPT-4o, GPT-4o Mini), Anthropic Claude (Sonnet 4, 3.5 Sonnet, 3.5 Haiku), and Google Gemini (2.0 Flash, 1.5 Pro, 1.5 Flash). You can select your preferred model in AI Settings.' },
  { q: 'Is my data secure?', a: 'Yes. All data is encrypted in transit and at rest. We use Supabase with Row Level Security — each user can only access their own data. Your password is hashed and never stored in plain text.' },
  { q: 'Can I change the language?', a: 'Yes. We support English, Arabic, and Swedish. Go to Settings > Preferences to change the language. The interface will update immediately, including RTL support for Arabic.' },
  { q: 'How do I switch between dark and light mode?', a: 'Click the moon/sun icon in the top bar, or go to Settings > Preferences and select your preferred theme.' },
  { q: 'What is the difference between Free and Premium?', a: 'Free tier gives you access to most tools with usage limits. Premium unlocks all 50+ tools, higher usage limits, priority AI processing, and advanced features.' },
  { q: 'How do I delete my account?', a: 'Go to Settings > Security > Danger Zone. Account deletion is permanent and cannot be undone.' },
  { q: 'Can I use AI-generated content commercially?', a: 'Yes, content you generate using the platform belongs to you. However, always review AI-generated content for accuracy before use.' },
];

export default function HelpCenter() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [search, setSearch] = useState('');
  const { loading, update } = useToast();
  const [contactMsg, setContactMsg] = useState('');
  const [sending, setSending] = useState(false);

  const filtered = FAQS.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSend() {
    if (!contactMsg) return;
    setSending(true);
    const toastId = loading('Sending support request...');
    await supabase.from('notifications').insert({ title: 'Support Request', message: contactMsg, type: 'support' });
    update(toastId, 'Support request sent', 'success');
    setContactMsg('');
    setSending(false);
  }

  return (
    <PageShell icon={LifeBuoy} title="Help Center" subtitle="Find answers to common questions and get support.">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search help articles..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:outline-none mb-6"
      />

      <div className="space-y-2 mb-8">
        {filtered.map((faq, i) => (
          <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <span className="text-white text-sm font-medium">{faq.q}</span>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed">{faq.a}</div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">No results found. Try a different search.</div>
        )}
      </div>

      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
        <h3 className="text-white text-sm font-semibold mb-2">Still need help?</h3>
        <p className="text-gray-500 text-xs mb-3">Send us a message and we'll get back to you within 24 hours.</p>
        <textarea value={contactMsg} onChange={e => setContactMsg(e.target.value)} placeholder="Describe your issue..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none min-h-[100px] resize-y mb-3" />
        <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Support Request
        </button>
      </div>
    </PageShell>
  );
}
