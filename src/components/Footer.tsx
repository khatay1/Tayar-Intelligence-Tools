import { Sparkles, Twitter, Linkedin, Instagram, Facebook } from 'lucide-react';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  const links: Record<string, { label: string; action: () => void }[]> = {
    Product: [
      { label: 'AI Tools', action: () => {} },
      { label: 'Pricing', action: () => {} },
      { label: 'Business Solutions', action: () => {} },
      { label: 'API Docs', action: () => {} },
      { label: 'Templates', action: () => {} },
    ],
    Company: [
      { label: 'About', action: () => onNavigate?.('about') },
      { label: 'Blog', action: () => {} },
      { label: 'Careers', action: () => {} },
      { label: 'Contact', action: () => onNavigate?.('contact') },
      { label: 'Partners', action: () => {} },
    ],
    Resources: [
      { label: 'Help Center', action: () => onNavigate?.('help') },
      { label: 'Feedback', action: () => onNavigate?.('feedback') },
      { label: 'Report a Bug', action: () => onNavigate?.('bug-report') },
      { label: 'Tutorials', action: () => {} },
      { label: 'Status', action: () => {} },
    ],
    Legal: [
      { label: 'Privacy Policy', action: () => onNavigate?.('privacy') },
      { label: 'Terms of Service', action: () => onNavigate?.('terms') },
      { label: 'Cookie Policy', action: () => {} },
      { label: 'GDPR', action: () => {} },
      { label: 'Security', action: () => {} },
    ],
  };

  return (
    <footer className="bg-[#06060e] border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-6 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-base">Tayar Intelligence</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs mb-6">
              One platform. Endless tools. AI-powered solutions for work, study, business and creativity.
            </p>
            <div className="flex gap-3">
              {[Twitter, Linkedin, Instagram, Facebook].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social media link"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-violet-600 flex items-center justify-center transition-colors"
                >
                  <Icon className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-white font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item.label}>
                    <button
                      onClick={item.action}
                      className="text-gray-500 text-sm hover:text-violet-400 transition-colors text-left"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2026 Tayar Intelligence Tools. All rights reserved.
          </p>
          <div className="flex gap-6">
            <button onClick={() => onNavigate?.('privacy')} className="text-gray-500 text-sm hover:text-violet-400 transition-colors">Privacy</button>
            <button onClick={() => onNavigate?.('terms')} className="text-gray-500 text-sm hover:text-violet-400 transition-colors">Terms</button>
            <button onClick={() => onNavigate?.('contact')} className="text-gray-500 text-sm hover:text-violet-400 transition-colors">Cookies</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
