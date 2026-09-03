import { useLocalizer } from '@/lib/ui-localization';
import { Heart, Layers3, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { PageSection, PageShell } from './PageShell';

export default function AboutPage() {
  const l = useLocalizer();
  const values = [
    { icon: Layers3, title: 'One connected workspace', desc: 'Projects, files, website releases, collaboration and settings are designed to stay connected.' },
    { icon: Rocket, title: 'Ship finished work', desc: 'The product is built around moving from draft to delivery, not just generating a one-off output.' },
    { icon: ShieldCheck, title: 'Control by default', desc: 'Recovery, roles, audits, version history and row-level access controls are part of the workflow.' },
    { icon: Heart, title: 'Accessible workflows', desc: 'English, Arabic and Swedish are supported, including right-to-left interface behavior for Arabic.' },
  ];

  return (
    <PageShell icon={Sparkles} title={l('About Tayar Intelligence')} subtitle={l('A focused workspace for building, creating, collaborating and shipping finished work.')}>
      <PageSection>
        <p>{l('Tayar Intelligence brings practical productivity tools into one workspace. The current product includes Website Builder V1, team workspaces, document and writing tools, translation, study workflows, project management and account-level preferences.')}</p>
        <p>{l('The goal is simple: reduce tool switching while keeping the important parts of a project — content, versions, permissions and delivery — connected.')}</p>
      </PageSection>

      <div className="my-7 grid gap-3 sm:grid-cols-2">
        {values.map(({ icon: Icon, title, desc }) => (
          <article key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-violet-400/15 bg-violet-500/10"><Icon className="h-4 w-4 text-violet-300" /></div>
            <h3 className="mt-3 text-sm font-bold text-white">{l(title)}</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">{l(desc)}</p>
          </article>
        ))}
      </div>

      <PageSection title={l('Website Builder V1')}>
        <p>{l('Website Builder V1 is active and supports responsive pages, forms, publishing, release history and rollback, multilingual pages, analytics, conversion tracking, lead management, team collaboration and client handoff workflows.')}</p>
      </PageSection>

      <PageSection title={l('What comes next')}>
        <p>{l('The next major product phase is AI-assisted website generation. It is intentionally separate from V1 so the core builder can remain useful and production-ready without depending on AI generation.')}</p>
      </PageSection>
    </PageShell>
  );
}
