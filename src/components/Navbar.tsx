import { useState } from 'react';
import { ChevronDown, Menu, X, Sparkles } from 'lucide-react';

interface NavbarProps {
  onGetStarted?: () => void;
  onLogin?: () => void;
}

export default function Navbar({ onGetStarted, onLogin }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const tools = ['CV Builder', 'Cover Letter', 'Document AI', 'Study Assistant', 'AI Writer', 'Translator', 'PDF Tools', 'Image Tools'];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a1a]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-tight">Tayar Intelligence Tools</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <a href="#" className="text-white text-sm px-4 py-2 border-b-2 border-violet-500 font-medium">Home</a>
            <div className="relative">
              <button
                className="flex items-center gap-1 text-gray-300 text-sm px-4 py-2 hover:text-white transition-colors"
                onClick={() => setToolsOpen(!toolsOpen)}
                onBlur={() => setTimeout(() => setToolsOpen(false), 150)}
              >
                AI Tools <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {toolsOpen && (
                <div className="absolute top-full left-0 mt-1 bg-[#12122a] border border-white/10 rounded-xl p-2 w-56 shadow-2xl shadow-black/50">
                  {tools.map(t => (
                    <a key={t} href="#tools" className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      {t}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <a href="#business" className="text-gray-300 text-sm px-4 py-2 hover:text-white transition-colors">Business</a>
            <a href="#pricing" className="text-gray-300 text-sm px-4 py-2 hover:text-white transition-colors">Pricing</a>
            <a href="#" className="text-gray-300 text-sm px-4 py-2 hover:text-white transition-colors">Blog</a>
            <a href="#faq" className="text-gray-300 text-sm px-4 py-2 hover:text-white transition-colors">Contact</a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button onClick={onLogin} className="text-sm text-gray-300 hover:text-white px-4 py-2 transition-colors">Login</button>
            <button onClick={onGetStarted} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              Start Free <span className="text-violet-300">+</span>
            </button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0a0a1a] border-t border-white/5 px-4 py-4 flex flex-col gap-2">
          {['Home', 'AI Tools', 'Business', 'Pricing', 'Blog', 'Contact'].map(item => (
            <a key={item} href="#" className="text-gray-300 text-sm py-2 hover:text-white transition-colors">
              {item}
            </a>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={onLogin} className="flex-1 text-sm text-white border border-white/20 rounded-lg py-2">Login</button>
            <button onClick={onGetStarted} className="flex-1 text-sm bg-violet-600 text-white rounded-lg py-2 font-semibold">Start Free</button>
          </div>
        </div>
      )}
    </nav>
  );
}
