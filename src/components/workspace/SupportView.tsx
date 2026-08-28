import { Bug, HelpCircle, LifeBuoy, Mail, MessageSquare } from 'lucide-react';
import { PageShell } from './PageShell';
import type { ViewId } from './workspace-config';
import { useLocalizer } from '@/lib/ui-localization';

interface SupportViewProps {
  onNavigate: (view: ViewId) => void;
}

const options: Array<{ id: ViewId; icon: typeof HelpCircle; title: string; description: string; action: string }> = [
  { id: 'help', icon: HelpCircle, title: 'Help Center', description: 'Browse common questions and practical product guidance.', action: 'Open Help Center' },
  { id: 'contact', icon: Mail, title: 'Contact Us', description: 'Send a direct support message from inside your account.', action: 'Contact Support' },
  { id: 'feedback', icon: MessageSquare, title: 'Feedback', description: 'Share an idea or tell us what would make Tayar better.', action: 'Send Feedback' },
  { id: 'bug-report', icon: Bug, title: 'Report a Bug', description: 'Report a reproducible problem with clear technical details.', action: 'Report a Bug' },
];

export default function SupportView({ onNavigate }: SupportViewProps) {
  const l = useLocalizer();

  return (
    <PageShell icon={LifeBuoy} title={l('Support')} subtitle={l('Get help, report a problem or send feedback from one place.')}> 
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(option => {
          const Icon = option.icon;
          return (
            <button key={option.id} onClick={() => onNavigate(option.id)} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left transition hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-violet-500/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10">
                <Icon className="h-4 w-4 text-violet-300" />
              </div>
              <h2 className="text-sm font-bold text-white">{l(option.title)}</h2>
              <p className="mt-1 min-h-[40px] text-xs leading-5 text-gray-500">{l(option.description)}</p>
              <div className="mt-4 text-xs font-semibold text-violet-300 transition group-hover:text-violet-200">{l(option.action)} →</div>
            </button>
          );
        })}
      </div>
      <div className="mt-6 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-3 text-xs leading-5 text-emerald-100/80">
        {l('For account-specific issues, use the in-app contact form so your request stays connected to your signed-in account.')}
      </div>
    </PageShell>
  );
}
