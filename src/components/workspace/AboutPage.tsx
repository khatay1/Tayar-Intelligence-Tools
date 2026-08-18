import { Sparkles, Target, Users, Rocket, Heart } from 'lucide-react';
import { PageShell, PageSection } from './PageShell';

export default function AboutPage() {
  const values = [
    { icon: Target, title: 'Our Mission', desc: 'Democratize access to AI tools for everyone, from students to professionals.' },
    { icon: Rocket, title: 'Innovation', desc: 'We constantly push the boundaries of what AI can do for productivity.' },
    { icon: Users, title: 'User-First', desc: 'Every feature we build starts with a real user need.' },
    { icon: Heart, title: 'Accessibility', desc: 'We make AI tools available in multiple languages and for all skill levels.' },
  ];

  return (
    <PageShell icon={Sparkles} title="About Tayar Intelligence" subtitle="One platform. Endless tools. AI-powered solutions for work, study, and creativity.">
      <PageSection>
        <p>Tayar Intelligence Tools was founded in 2026 with a simple vision: bring the power of AI to everyone. We believe AI should be accessible, useful, and beautifully designed.</p>
        <p>Our platform unifies 50+ AI tools into a single workspace — from CV builders to translators, from study assistants to document analyzers. No more switching between dozens of apps. One login, one workspace, endless possibilities.</p>
      </PageSection>

      <div className="grid sm:grid-cols-2 gap-3 my-6">
        {values.map(v => {
          const Icon = v.icon;
          return (
            <div key={v.title} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">{v.title}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{v.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <PageSection title="Our Story">
        <p>Founded by a team of engineers and designers from Stockholm, Tayar Intelligence started as a CV builder and grew into a full AI workspace. Today, we serve users across the globe with support for English, Arabic, and Swedish — with more languages on the way.</p>
      </PageSection>

      <PageSection title="The Technology">
        <p>Our platform is built on a modern, scalable architecture: React and Vite on the frontend, Supabase for authentication and database, and a unified AI engine that supports OpenAI, Anthropic Claude, and Google Gemini. Every tool uses the same backend, ensuring consistency and reliability.</p>
      </PageSection>

      <PageSection title="Contact">
        <p>Questions? Reach us at hello@tayar.ai or through our Contact page.</p>
      </PageSection>
    </PageShell>
  );
}
