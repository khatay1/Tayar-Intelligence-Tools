import { ArrowRight } from 'lucide-react';

const avatars = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
];

interface HeroProps {
  onGetStarted?: () => void;
}

export default function Hero({ onGetStarted }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      {/* Starfield / Galaxy BG */}
      <div className="absolute inset-0 bg-[#06060f]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_-20%,rgba(120,80,255,0.35),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_100%_80%,rgba(80,40,180,0.2),transparent_50%)]" />
        {/* Stars */}
        {[...Array(80)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + 'px',
              height: Math.random() * 2 + 1 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
              opacity: Math.random() * 0.7 + 0.1,
            }}
          />
        ))}
        {/* Planet */}
        <div className="absolute top-24 right-[-80px] w-72 h-72 rounded-full bg-gradient-to-br from-[#1a0a3a] to-[#0d0720] border border-violet-900/30 opacity-60" />
        <div className="absolute bottom-0 left-[-60px] w-48 h-48 rounded-full bg-gradient-to-br from-[#1a0a3a] to-[#0d0720] border border-violet-900/30 opacity-40" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight text-white mb-4">
              One Platform.
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Endless Tools.
              </span>
            </h1>
            <p className="text-gray-400 text-lg mb-10 max-w-md leading-relaxed">
              AI-powered tools for work, study, business and creativity.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <button onClick={onGetStarted} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95">
                Start Free <ArrowRight className="w-4 h-4" />
              </button>
              <button className="text-white font-semibold px-6 py-3 rounded-xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all">
                Explore Tools
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {avatars.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-9 h-9 rounded-full border-2 border-[#06060f] object-cover" />
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 fill-amber-400" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                  ))}
                </div>
                <p className="text-gray-400 text-xs">Trusted by 1,000+ users worldwide</p>
              </div>
            </div>
          </div>

          {/* Right — Dashboard Mockup */}
          <div className="hidden lg:block">
            <div className="relative bg-[#0f0f24] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
              {/* Top bar */}
              <div className="bg-[#13132b] border-b border-white/5 px-5 py-3 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <img src="/site.jfif" alt="Logo" className="w-5 h-5 rounded object-cover" />
                  <span className="text-white text-xs font-semibold">Tayar Intelligence</span>
                </div>
              </div>

              <div className="flex">
                {/* Sidebar */}
                <div className="w-40 bg-[#0c0c20] border-r border-white/5 p-3 flex flex-col gap-1 text-xs">
                  {[
                    { label: 'Dashboard', active: true },
                    { label: 'AI Tools' },
                    { label: 'Documents' },
                    { label: 'Templates' },
                    { label: 'History' },
                    { label: 'Favorites' },
                    { label: 'Pricing' },
                    { label: 'Settings' },
                  ].map(item => (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${item.active ? 'bg-violet-600/20 text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-violet-400' : 'bg-gray-600'}`} />
                      {item.label}
                    </div>
                  ))}
                  <div className="mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 px-2 py-2">
                      <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-bold">K</div>
                      <div>
                        <div className="text-white text-xs font-medium">Khaled T.</div>
                        <div className="text-violet-400 text-[10px]">Pro Plan</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-white text-sm font-semibold">Welcome back, Khaled!</h3>
                      <p className="text-gray-500 text-xs">What would you like to create today?</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-gray-400 text-xs">Usage</div>
                      <div className="bg-violet-600/20 text-violet-400 text-xs font-bold px-2 py-0.5 rounded">80%</div>
                    </div>
                  </div>

                  <button className="w-full bg-violet-600/20 border border-violet-500/20 text-violet-400 text-xs rounded-lg py-1.5 mb-4 text-left px-3 hover:bg-violet-600/30 transition-colors">
                    Upgrade to Pro
                  </button>

                  <div className="bg-[#13132b] rounded-lg px-3 py-2 text-xs text-gray-500 mb-4">
                    Search any tool...
                  </div>

                  <p className="text-gray-400 text-xs font-medium mb-3">Popular Tools</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'CV Builder', desc: 'Create professional CVs', color: 'from-blue-500 to-blue-700' },
                      { name: 'AI Writer', desc: 'Write anything with AI', color: 'from-violet-500 to-violet-700' },
                      { name: 'Document AI', desc: 'Summarize and analyze', color: 'from-cyan-500 to-cyan-700' },
                      { name: 'PDF Tools', desc: 'Edit, convert and more', color: 'from-orange-500 to-red-600' },
                      { name: 'Translator', desc: 'Translate 100+ languages', color: 'from-green-500 to-emerald-700' },
                      { name: 'Study Assistant', desc: 'Learn faster with AI', color: 'from-amber-500 to-yellow-600' },
                    ].map(tool => (
                      <div key={tool.name} className="bg-[#0c0c20] rounded-lg p-2.5 hover:bg-[#14142e] transition-colors cursor-pointer">
                        <div className={`w-6 h-6 rounded bg-gradient-to-br ${tool.color} mb-1.5`} />
                        <div className="text-white text-xs font-medium">{tool.name}</div>
                        <div className="text-gray-500 text-[10px]">{tool.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
