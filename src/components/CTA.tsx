import { ArrowRight } from 'lucide-react';

interface CTAProps {
  onGetStarted?: () => void;
}

export default function CTA({ onGetStarted }: CTAProps) {
  return (
    <section className="py-24 bg-[#07070f]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative bg-gradient-to-br from-violet-600/30 via-[#0f0f24] to-fuchsia-600/20 border border-violet-500/20 rounded-3xl p-12 sm:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(120,80,255,0.15),transparent_70%)]" />
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Ready to Boost Your Productivity?
            </h2>
            <p className="text-gray-400 text-base mb-8 max-w-xl mx-auto">
              Join thousands of users who are already creating smarter, faster and better with Tayar Intelligence Tools.
            </p>
            <button onClick={onGetStarted} className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95">
              Start Free Today <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
