import AstronautLogo from '@/components/ui/AstronautLogo';
import { useLandingCopy } from '@/lib/landing-copy';

interface FooterProps { onNavigate?: (page: string) => void; }

export default function Footer({ onNavigate }: FooterProps) {
  const c = useLandingCopy().footer;
  const groups = [
    { title: c.product, links: [{ label: c.tools, href: '#tools' }, { label: c.business, href: '#business' }, { label: c.pricing, href: '#pricing' }, { label: c.faq, href: '#faq' }] },
    { title: c.company, links: [{ label: c.about, page: 'about' }, { label: c.help, href: '#faq' }] },
    { title: c.legal, links: [{ label: c.privacy, page: 'privacy' }, { label: c.terms, page: 'terms' }] },
  ];
  return (
    <footer className="border-t border-white/[0.06] bg-[#05050c] py-12 sm:py-14">
      <div className="site-container">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="max-w-md">
            <a href="#top" className="inline-flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10"><AstronautLogo size={30} /></div><span className="font-bold text-white">Tayar Intelligence</span></a>
            <p className="mt-4 text-sm leading-6 text-gray-500">{c.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {groups.map(group => (
              <div key={group.title}>
                <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-300">{group.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {group.links.map(link => (
                    <li key={link.label}>
                      {'page' in link ? <button type="button" onClick={() => onNavigate?.(link.page!)} className="text-start text-sm text-gray-500 transition-colors hover:text-violet-300">{link.label}</button> : <a href={link.href} className="text-sm text-gray-500 transition-colors hover:text-violet-300">{link.label}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <p>{c.copyright}</p>
          <p>React · Supabase · Vite</p>
        </div>
      </div>
    </footer>
  );
}
