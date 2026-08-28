import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLandingCopy } from '@/lib/landing-copy';

export default function FAQ() {
  const c = useLandingCopy().faq;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="site-section bg-[#080811]/75">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="section-heading">
          <span className="eyebrow">{c.eyebrow}</span>
          <h2>{c.title}</h2>
          <p>{c.description}</p>
        </div>
        <div className="space-y-2.5">
          {c.items.map(([question, answer], index) => {
            const expanded = open === index;
            return (
              <div key={question} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
                <button type="button" onClick={() => setOpen(expanded ? null : index)} aria-expanded={expanded} aria-controls={`faq-answer-${index}`} className="flex w-full items-center justify-between gap-5 px-5 py-4 text-start sm:px-6 sm:py-5">
                  <span className="text-sm font-semibold text-white sm:text-[15px]">{question}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-violet-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && <div id={`faq-answer-${index}`} className="px-5 pb-5 text-sm leading-6 text-gray-500 sm:px-6">{answer}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
