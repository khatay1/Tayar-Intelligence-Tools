import { ArrowRight, FileText, Mail, BookOpen, GraduationCap, PenLine, Languages, FileOutput, ImageIcon } from 'lucide-react';

const tools = [
  {
    icon: FileText,
    name: 'CV Builder',
    desc: 'Create ATS-friendly resumes that get you noticed.',
    color: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Mail,
    name: 'Cover Letter',
    desc: 'Generate personalized cover letters in seconds.',
    color: 'from-violet-500 to-violet-700',
    bg: 'bg-violet-500/10',
  },
  {
    icon: BookOpen,
    name: 'Document AI',
    desc: 'Analyze, summarize and extract info from documents.',
    color: 'from-cyan-500 to-cyan-700',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: GraduationCap,
    name: 'Study Assistant',
    desc: 'Get answers, explain concepts and improve your skills.',
    color: 'from-emerald-500 to-green-700',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: PenLine,
    name: 'AI Writer',
    desc: 'Write blogs, articles, emails and more with AI.',
    color: 'from-orange-400 to-red-600',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Languages,
    name: 'Translator',
    desc: 'Translate text into 100+ languages instantly.',
    color: 'from-sky-400 to-blue-600',
    bg: 'bg-sky-500/10',
  },
  {
    icon: FileOutput,
    name: 'PDF Tools',
    desc: 'Convert, edit, merge and analyze your PDFs.',
    color: 'from-rose-500 to-pink-700',
    bg: 'bg-rose-500/10',
  },
  {
    icon: ImageIcon,
    name: 'Image Tools',
    desc: 'AI image generator and editing tools coming soon.',
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-500/10',
    badge: 'Coming Soon',
  },
];

export default function AITools() {
  return (
    <section id="tools" className="py-24 bg-[#07070f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Explore AI Tools <span className="text-violet-400">✦</span>
          </h2>
          <p className="text-gray-400 text-base">Powerful AI tools to boost your productivity</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tools.map(tool => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.name}
                className="group relative bg-[#0f0f24] border border-white/5 rounded-2xl p-6 hover:border-violet-500/30 hover:bg-[#12123a] transition-all duration-300 cursor-pointer"
              >
                {tool.badge && (
                  <span className="absolute top-3 right-3 bg-cyan-500/20 text-cyan-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-cyan-500/20">
                    {tool.badge}
                  </span>
                )}
                <div className={`w-12 h-12 rounded-xl ${tool.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${tool.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="text-white font-bold text-base mb-2">{tool.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{tool.desc}</p>
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
