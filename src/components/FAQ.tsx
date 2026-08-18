import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: 'What is Tayar Intelligence Tools?',
    a: 'Tayar Intelligence Tools is an all-in-one AI platform that provides 50+ tools for work, study, business and creativity. From CV builders to AI writers, we have everything you need to boost your productivity.',
  },
  {
    q: 'Is there a free plan available?',
    a: 'Yes! Our Free plan gives you access to 5 basic AI tools and 10 documents per month. No credit card required to get started.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Absolutely. You can cancel your subscription at any time from your account settings. No hidden fees or cancellation charges.',
  },
  {
    q: 'Do you offer team or business plans?',
    a: 'Yes, our Business plan at $49/month includes team collaboration, API access, custom branding and a dedicated analytics dashboard. Contact our sales team for custom enterprise solutions.',
  },
  {
    q: 'How accurate is the AI?',
    a: 'We use state-of-the-art AI models to ensure high accuracy across all our tools. However, we always recommend reviewing AI-generated content before final use.',
  },
  {
    q: 'Is my data secure?',
    a: 'Security is our top priority. All your data is encrypted and we never share your information with third parties. Your documents remain private and under your control.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-[#06060e]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400 text-base">Everything you need to know</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-[#0f0f24] border border-white/5 rounded-xl overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-6 py-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-white font-semibold text-sm">{faq.q}</span>
                {open === i ? (
                  <Minus className="w-4 h-4 text-violet-400 flex-shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
