import { ArrowRight, Globe, Bot, TrendingUp } from 'lucide-react';

const solutions = [
  {
    icon: Globe,
    name: 'Website Development',
    desc: 'Modern, fast and responsive websites that represent your brand.',
    color: 'from-blue-500 to-cyan-600',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Bot,
    name: 'AI Automation',
    desc: 'Automate workflows and save time with AI.',
    color: 'from-violet-500 to-fuchsia-600',
    bg: 'bg-violet-500/10',
  },
  {
    icon: TrendingUp,
    name: 'Digital Growth',
    desc: 'SEO, content and digital strategies to grow your business.',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-500/10',
  },
];

export default function BusinessSolutions() {
  return (
    <section id="business" className="py-24 bg-[#06060e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            AI Solutions for Businesses
          </h2>
          <p className="text-gray-400 text-base">Grow your business with smart AI solutions</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {solutions.map(s => {
            const Icon = s.icon;
            return (
              <div
                key={s.name}
                className="group bg-[#0f0f24] border border-white/5 rounded-2xl p-8 hover:border-violet-500/30 hover:bg-[#12123a] transition-all duration-300 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <Icon className="w-4.5 h-4.5 text-white" />
                  </div>
                </div>
                <h3 className="text-white font-bold text-xl mb-3">{s.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{s.desc}</p>
                <a href="#" className="flex items-center gap-1 text-violet-400 text-sm font-medium hover:text-violet-300 transition-colors group-hover:gap-2">
                  Learn more <ArrowRight className="w-3.5 h-3.5 transition-all" />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
