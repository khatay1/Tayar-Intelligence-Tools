import { Check, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    desc: 'Perfect for trying out our tools',
    features: [
      'Access to 5 basic AI tools',
      '10 documents per month',
      'Basic templates',
      'Community support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'per month',
    desc: 'For professionals and students',
    features: [
      'Access to all 50+ AI tools',
      'Unlimited documents',
      'Premium templates',
      'Priority support',
      'Advanced AI models',
      'Export to PDF & Word',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$49',
    period: 'per month',
    desc: 'For teams and businesses',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'API access',
      'Custom branding',
      'Dedicated support',
      'Analytics dashboard',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-[#06060e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Simple, Transparent Pricing
          </h2>
          <p className="text-gray-400 text-base">Choose the plan that works for you</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-violet-600/20 to-[#0f0f24] border-2 border-violet-500/50 scale-105 shadow-2xl shadow-violet-500/20'
                  : 'bg-[#0f0f24] border border-white/5 hover:border-white/10'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-violet-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" /> Most Popular
                </div>
              )}
              <h3 className="text-white font-bold text-xl mb-1">{plan.name}</h3>
              <p className="text-gray-500 text-sm mb-4">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                <span className="text-gray-400 text-sm ml-1">/ {plan.period}</span>
              </div>
              <button
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  plan.highlighted
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                }`}
              >
                {plan.cta}
              </button>
              <ul className="mt-6 space-y-3">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
