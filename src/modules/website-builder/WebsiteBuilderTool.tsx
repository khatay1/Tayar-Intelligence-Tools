import { useEffect, useMemo, useState } from 'react';
import { createAIService } from '@/lib/ai/service';
import { generateImage } from '@/lib/ai/image-service';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Monitor,
  Smartphone,
  Save,
  RotateCcw,
  Type,
  Palette,
  Eye,
  Sparkles,
  Download,
  Copy,
  ExternalLink,
  Link,
    Globe,
  Check,
  MousePointer2,
} from 'lucide-react';

interface WebsiteBuilderToolProps {
  darkMode: boolean;
}

type SectionType =
  | 'hero'
  | 'features'
  | 'about'
  | 'services'
  | 'pricing'
  | 'testimonials'
  | 'contact'
  | 'footer';

interface WebsiteSection {
  id: string;
  type: SectionType;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  background: string;
  accent: string;
  image?: string;
}

interface WebsiteBrand {
  name: string;
  industry: string;
  style: string;
  colors: {
    primary: string;
    secondary: string;
  };
  tone: string;
}

interface WebsiteSEO {
  title: string;
  description: string;
  keywords: string[];
}

type Device = 'desktop' | 'tablet' | 'mobile';

type AIWebsiteGeneration = {
  siteName: string;
  brand?: WebsiteBrand;
  seo?: WebsiteSEO;

  sections: Array<{
    type: SectionType;
    title: string;
    description: string;
    buttonText?: string;
    buttonUrl?: string;
    background?: string;
    accent?: string;
  }>;
};

const STORAGE_KEY = 'tayar-website-builder-project';

const SECTION_LABELS: Record<SectionType, string> = {
  hero: 'Hero',
  features: 'Features',
  about: 'About',
  services: 'Services',
  pricing: 'Pricing',
  testimonials: 'Testimonials',
  contact: 'Contact',
  footer: 'Footer',
};

const defaultSections: WebsiteSection[] = [
  {
    id: 'hero-1',
    type: 'hero',
    title: 'Build Something Amazing',
    description:
      'Create a professional website for your business, portfolio, service or personal brand.',
    buttonText: 'Get Started',
    buttonUrl: '#contact',
    background: '#111827',
    accent: '#7c3aed',
  },
  {
    id: 'features-1',
    type: 'features',
    title: 'Everything You Need',
    description:
      'Showcase the key benefits that make your product or service different.',
    buttonText: 'Explore Features',
    buttonUrl: '#features',
    background: '#0f172a',
    accent: '#8b5cf6',
  },
  {
    id: 'about-1',
    type: 'about',
    title: 'About Your Business',
    description:
      'Tell visitors who you are, what you do and why they should choose you.',
    buttonText: 'Learn More',
    buttonUrl: '#about',
    background: '#111827',
    accent: '#a855f7',
  },
  {
    id: 'contact-1',
    type: 'contact',
    title: 'Letï¿½s Work Together',
    description:
      'Ready to get started? Give your customers an easy way to contact you.',
    buttonText: 'Contact Us',
    buttonUrl: 'mailto:hello@example.com',
    background: '#0f172a',
    accent: '#7c3aed',
  },
  {
    id: 'footer-1',
    type: 'footer',
    title: 'Your Company',
    description: 'All rights reserved.',
    buttonText: '',
    buttonUrl: '',
    background: '#020617',
    accent: '#7c3aed',
  },
];

function createSection(type: SectionType): WebsiteSection {
  const defaults: Record<SectionType, Omit<WebsiteSection, 'id' | 'type'>> = {
    hero: {
      title: 'New Hero Section',
      description: 'Introduce your website and your main offer.',
      buttonText: 'Get Started',
      buttonUrl: '#contact',
      background: '#111827',
      accent: '#7c3aed',
    },
    features: {
      title: 'Our Features',
      description: 'Show the main benefits of your product or service.',
      buttonText: 'Learn More',
      buttonUrl: '#features',
      background: '#0f172a',
      accent: '#8b5cf6',
    },
    about: {
      title: 'About Us',
      description: 'Tell your visitors more about your company.',
      buttonText: 'Read More',
      buttonUrl: '#about',
      background: '#111827',
      accent: '#a855f7',
    },
    services: {
      title: 'Our Services',
      description: 'Present the services you offer to your customers.',
      buttonText: 'View Services',
      buttonUrl: '#services',
      background: '#0f172a',
      accent: '#6366f1',
    },
    pricing: {
      title: 'Simple Pricing',
      description: 'Present your plans and pricing clearly.',
      buttonText: 'Choose Plan',
      buttonUrl: '#contact',
      background: '#111827',
      accent: '#8b5cf6',
    },
    testimonials: {
      title: 'What Customers Say',
      description: 'Build trust with testimonials from your customers.',
      buttonText: 'See Reviews',
      buttonUrl: '#contact',
      background: '#0f172a',
      accent: '#a855f7',
    },
    contact: {
      title: 'Contact Us',
      description: 'Make it easy for customers to get in touch.',
      buttonText: 'Send Message',
      buttonUrl: 'mailto:hello@example.com',
      background: '#111827',
      accent: '#7c3aed',
    },
    footer: {
      title: 'Your Company',
      description: 'All rights reserved.',
      buttonText: '',
      buttonUrl: '',
      background: '#020617',
      accent: '#7c3aed',
    },
  };

  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    ...defaults[type],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sectionToHtml(section: WebsiteSection): string {
  const title = escapeHtml(section.title);
  const description = escapeHtml(section.description);
  const button = section.buttonText
    ? `<a class="btn" href="${escapeHtml(section.buttonUrl || '#')}">${escapeHtml(section.buttonText)}</a>`
    : '';

  if (section.type === 'footer') {
    return `
<footer class="section footer" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
</footer>`;
  }

  if (section.type === 'features') {
    return `
<section id="features" class="section" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <span class="eyebrow">FEATURES</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><div class="icon">01</div><h3>Fast</h3><p>Built for speed and a smooth user experience.</p></article>
      <article class="card"><div class="icon">02</div><h3>Powerful</h3><p>Flexible tools that help your business grow.</p></article>
      <article class="card"><div class="icon">03</div><h3>Easy</h3><p>Simple experiences your customers understand.</p></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'services') {
    return `
<section id="services" class="section" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <span class="eyebrow">SERVICES</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><h3>Consulting</h3><p>Professional guidance tailored to your goals.</p></article>
      <article class="card"><h3>Development</h3><p>Modern digital solutions built for your business.</p></article>
      <article class="card"><h3>Support</h3><p>Reliable help when you need it most.</p></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'pricing') {
    return `
<section id="pricing" class="section" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <span class="eyebrow">PRICING</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="pricing">
      <article class="price"><h3>Starter</h3><strong>$9</strong><p>For getting started.</p><a class="btn secondary" href="${escapeHtml(section.buttonUrl || '#')}">Choose</a></article>
      <article class="price featured"><h3>Pro</h3><strong>$29</strong><p>For growing businesses.</p><a class="btn" href="${escapeHtml(section.buttonUrl || '#')}">Choose</a></article>
      <article class="price"><h3>Business</h3><strong>$79</strong><p>For advanced needs.</p><a class="btn secondary" href="${escapeHtml(section.buttonUrl || '#')}">Choose</a></article>
    </div>
  </div>
</section>`;
  }

  if (section.type === 'testimonials') {
    return `
<section class="section" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <span class="eyebrow">TESTIMONIALS</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><p>ï¿½Amazing experience and excellent results.ï¿½</p><strong>ï¿½ Alex</strong></article>
      <article class="card"><p>ï¿½Professional, simple and exactly what we needed.ï¿½</p><strong>ï¿½ Sarah</strong></article>
      <article class="card"><p>ï¿½The easiest way to present our business online.ï¿½</p><strong>ï¿½ Daniel</strong></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'contact') {
    return `
<section id="contact" class="section" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <span class="eyebrow">CONTACT</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="contact-box">
      <input placeholder="Your name" />
      <input placeholder="Your email" type="email" />
      <textarea placeholder="Your message"></textarea>
      ${button}
    </div>
  </div>
</section>`;
  }

  if (section.type === 'about') {
    return `
<section id="about" class="section" style="background:${section.background};--accent:${section.accent}">
  <div class="container split">
    <div>
      <span class="eyebrow">ABOUT</span>
      <h2>${title}</h2>
      <p class="lead">${description}</p>
      ${button}
    </div>
    <div class="visual" style="border-color:${section.accent}55">
      <span style="background:${section.accent}">ABOUT</span>
    </div>
  </div>
</section>`;
  }

  return `
<section class="section hero" style="background:${section.background};--accent:${section.accent}">
  <div class="container">
    <span class="eyebrow">YOUR BRAND</span>
    <h1>${title}</h1>
    <p class="lead">${description}</p>
    ${button}
  </div>
</section>`;
}

function buildFullHtml(sections: WebsiteSection[]): string {
  const body = sections.map(sectionToHtml).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your Website</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Inter,Arial,sans-serif;background:#020617;color:#fff;line-height:1.6}
a{text-decoration:none}
.section{padding:90px 24px;color:#fff}
.container{width:min(1100px,100%);margin:auto;text-align:center}
.hero{min-height:650px;display:flex;align-items:center;justify-content:center}
h1{font-size:clamp(44px,7vw,82px);line-height:1.05;margin:16px 0;font-weight:800}
h2{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:12px 0 18px;font-weight:800}
h3{font-size:22px;margin-bottom:8px}
.lead{max-width:720px;margin:0 auto 30px;color:#cbd5e1;font-size:18px}
.eyebrow{display:inline-block;color:var(--accent);font-weight:800;font-size:12px;letter-spacing:2px}
.btn{display:inline-block;margin-top:10px;background:var(--accent);color:#fff;padding:13px 22px;border-radius:12px;font-weight:700;box-shadow:0 10px 30px #0003}
.btn.secondary{background:#ffffff12;border:1px solid #ffffff20}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:950px;margin:40px auto}
.card,.price{padding:28px;border:1px solid #ffffff16;background:#ffffff08;border-radius:20px;text-align:left}
.card p,.price p{color:#94a3b8}
.icon{color:var(--accent);font-weight:900;margin-bottom:15px}
.pricing{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:900px;margin:40px auto}
.price strong{font-size:42px;display:block;margin:12px 0}
.price.featured{border-color:var(--accent);transform:translateY(-8px)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;text-align:left}
.split .lead{margin-left:0}
.visual{height:300px;border:2px solid;border-radius:28px;background:linear-gradient(135deg,#ffffff10,#ffffff03);display:flex;align-items:center;justify-content:center}
.visual span{padding:18px 25px;border-radius:15px;font-weight:900}
.contact-box{max-width:600px;margin:35px auto;display:grid;gap:12px}
.contact-box input,.contact-box textarea{width:100%;padding:15px;border-radius:12px;border:1px solid #ffffff18;background:#ffffff08;color:#fff;outline:none}
.contact-box textarea{min-height:130px;resize:vertical}
.footer{padding:45px 24px;text-align:center}
.footer h2{font-size:24px}
.footer p{color:#94a3b8}
@media(max-width:700px){
.section{padding:65px 18px}
.cards,.pricing,.split{grid-template-columns:1fr}
.price.featured{transform:none}
h1{font-size:45px}
}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function SectionPreview({
  section,
  selected,
  onSelect,
  device,
}: {
  section: WebsiteSection;
  selected: boolean;
  onSelect: () => void;
  device: Device;
}) {
  const compact = device === 'mobile';
  const tablet = device === 'tablet';

  return (
    <section
      id={section.type}
      onClick={onSelect}
      className={`relative group cursor-pointer border-2 transition-all ${
        selected
          ? 'border-violet-500 shadow-lg shadow-violet-500/10'
          : 'border-transparent hover:border-violet-400/40'
      }`}
      style={{ background: section.background }}
    >
      {selected && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white">
          <MousePointer2 className="h-3 w-3" />
          Editing
        </div>
      )}

      <div
        className={`mx-auto flex w-full flex-col items-center justify-center text-center ${
          compact ? 'min-h-[240px] px-5 py-10' : tablet ? 'min-h-[270px] px-8 py-14' : 'min-h-[300px] px-10 py-16'
        }`}
      >
        <span
          className="mb-3 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: `${section.accent}22`,
            color: section.accent,
          }}
        >
          {SECTION_LABELS[section.type]}
        </span>

        <h2 className={`font-bold text-white ${compact ? 'text-2xl' : tablet ? 'text-3xl' : 'text-4xl'}`}>
          {section.title}
        </h2>

        <p
          className={`mt-4 max-w-2xl text-gray-300 ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          {section.description}
        </p>

        {section.type === 'features' || section.type === 'services' ? (
          <div
            className={`mt-8 grid w-full max-w-3xl gap-3 ${
              compact ? 'grid-cols-1' : 'grid-cols-3'
            }`}
          >
            {['Fast', 'Powerful', 'Easy'].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-left"
              >
                <div
                  className="mb-2 h-2 w-10 rounded-full"
                  style={{ backgroundColor: section.accent }}
                />
                <div className="text-sm font-semibold text-white">{item}</div>
                <div className="mt-1 text-xs text-gray-400">
                  Professional solution for your customers.
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {section.type === 'pricing' && (
          <div
            className={`mt-8 grid w-full max-w-3xl gap-3 ${
              compact ? 'grid-cols-1' : 'grid-cols-3'
            }`}
          >
            {['Starter', 'Pro', 'Business'].map((plan, index) => (
              <div
                key={plan}
                className={`rounded-xl border p-5 text-left ${
                  index === 1
                    ? 'border-violet-400/50 bg-violet-500/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="text-sm font-semibold text-white">{plan}</div>
                <div className="mt-3 text-2xl font-bold text-white">
                  ${index === 0 ? '9' : index === 1 ? '29' : '79'}
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Everything you need to get started.
                </div>
              </div>
            ))}
          </div>
        )}

        {section.buttonText && (
          <button
            className="mt-7 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
            style={{ backgroundColor: section.accent }}
            onClick={(e) => e.stopPropagation()}
          >
            {section.buttonText}
          </button>
        )}
      </div>
    </section>
  );
}

export default function WebsiteBuilderTool({
  darkMode,
}: WebsiteBuilderToolProps) {
  const [sections, setSections] = useState<WebsiteSection[]>(defaultSections);

const [brand, setBrand] = useState<WebsiteBrand>({
  name: 'My Brand',
  industry: 'Business',
  style: 'Modern',
  colors: {
    primary: '#7c3aed',
    secondary: '#0f172a',
  },
  tone: 'Professional',
});

const [seo, setSeo] = useState<WebsiteSEO>({
  title: 'My Website',
  description: '',
  keywords: [],
});
  const [selectedId, setSelectedId] = useState<string | null>(defaultSections[0].id);
  const [device, setDevice] = useState<Device>('desktop');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [siteName, setSiteName] = useState('My Website');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiImproving, setAiImproving] = useState(false);
  const [history, setHistory] = useState<WebsiteSection[][]>([]);
  const [future, setFuture] = useState<WebsiteSection[][]>([]);

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? null,
    [sections, selectedId]
  );

  useEffect(() => {
    try {
      const savedProject = localStorage.getItem(STORAGE_KEY);

      if (savedProject) {
        const parsed = JSON.parse(savedProject);

        if (parsed?.sections && Array.isArray(parsed.sections) && parsed.sections.length) {
          setSections(parsed.sections);
          setSelectedId(parsed.sections[0].id);
          setSiteName(parsed.siteName || 'My Website');
        } else if (Array.isArray(parsed) && parsed.length) {
          setSections(parsed);
          setSelectedId(parsed[0].id);
        }
      }
    } catch {
      // Ignore invalid project data.
    }
  }, []);

  function remember(current: WebsiteSection[]) {
    setHistory((h) => [...h.slice(-19), current]);
    setFuture([]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setFuture((f) => [sections, ...f].slice(0, 20));
    setSections(previous);
    setHistory((h) => h.slice(0, -1));
    setSelectedId(previous[0]?.id ?? null);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    setHistory((h) => [...h, sections].slice(-20));
    setSections(next);
    setFuture((f) => f.slice(1));
    setSelectedId(next[0]?.id ?? null);
  }

  function updateSelected(
    changes: Partial<Omit<WebsiteSection, 'id' | 'type'>>
  ) {
    if (!selectedId) return;

    remember(sections);
    setSections((current) =>
      current.map((section) =>
        section.id === selectedId ? { ...section, ...changes } : section
      )
    );
    setSaved(false);
  }

  function addSection(type: SectionType) {
    remember(sections);
    const section = createSection(type);
    setSections((current) => [...current, section]);
    setSelectedId(section.id);
    setSaved(false);
  }

  function duplicateSection(id: string) {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      if (index === -1) return current;

      const original = current[index];
      const copy: WebsiteSection = {
        ...original,
        id: `${original.type}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        title: `${original.title} Copy`,
      };

      const next = [...current];
      next.splice(index + 1, 0, copy);
      return next;
    });

    setSaved(false);
  }

  function deleteSection(id: string) {
    remember(sections);
    setSections((current) => {
      if (current.length <= 1) return current;

      const index = current.findIndex((section) => section.id === id);
      const next = current.filter((section) => section.id !== id);

      if (id === selectedId) {
        setSelectedId(next[Math.max(0, index - 1)]?.id ?? next[0]?.id);
      }

      return next;
    });

    setSaved(false);
  }

  function moveSection(id: string, direction: 'up' | 'down') {
    remember(sections);
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      if (index === -1) return current;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

    setSaved(false);
  }

  async function generateWithAI() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiBusy) return;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');
      const response = await ai.completeJSON<AIWebsiteGeneration>(
        { action: 'generate', prompt },
        [],
        { temperature: 0.7, maxTokens: 5000 },
      );

      let generated = response.json;
      if (!generated && response.content) {
        const cleaned = response.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        generated = JSON.parse(cleaned) as AIWebsiteGeneration;
      }

      if (!generated || !Array.isArray(generated.sections) || generated.sections.length === 0) {
        throw new Error('AI returned an invalid website. Please try a more specific description.');
      }

      const allowedTypes = new Set<SectionType>([
        'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
      ]);

      const normalized = generated.sections
        .filter((section) => allowedTypes.has(section.type))
        .map((section, index) => ({
          id: `${section.type}-ai-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          type: section.type,
          title: section.title?.trim() || SECTION_LABELS[section.type],
          description: section.description?.trim() || '',
          buttonText: section.type === 'footer' ? '' : (section.buttonText?.trim() || 'Learn More'),
          buttonUrl: section.type === 'footer' ? '' : (section.buttonUrl?.trim() || '#contact'),
          background: /^#[0-9a-fA-F]{6}$/.test(section.background || '') ? section.background! : '#0f172a',
          accent: /^#[0-9a-fA-F]{6}$/.test(section.accent || '') ? section.accent! : '#7c3aed',
        }));

      if (normalized.length === 0) {
        throw new Error('AI did not return usable sections. Please try again.');
      }

      setSections(normalized);
      setSelectedId(normalized[0].id);
      setSiteName(generated.siteName?.trim() || 'My Website');

if (generated.brand) {
  setBrand(generated.brand);
}

if (generated.seo) {
  setSeo(generated.seo);
}
      setSaved(false);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI generation failed.');
    } finally {
      setAiBusy(false);
    }
  }

  async function improveSelectedSection() {
    if (!selectedSection || aiImproving) return;

    setAiImproving(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');

      const response = await ai.completeJSON<{
        title: string;
        description: string;
        buttonText: string;
      }>(
        {
          action: 'improve-section',
          section: selectedSection,
        },
        [],
        { temperature: 0.7, maxTokens: 1000 },
      );

      if (!response.json) {
        throw new Error('AI did not return an improvement.');
      }

      remember(sections);

      updateSelected({
        title: response.json.title || selectedSection.title,
        description: response.json.description || selectedSection.description,
        buttonText: response.json.buttonText || selectedSection.buttonText,
      });

    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : 'AI improvement failed.'
      );
    } finally {
      setAiImproving(false);
    }
  }


  async function generateImagePrompt() {
    if (!selectedSection || aiBusy) return;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');

      const response = await ai.completeJSON<{
        prompt: string;
      }>(
        {
          action: 'image-prompt',
          section: selectedSection,
          brand,
        },
        [],
        { temperature: 0.8, maxTokens: 800 },
      );

      if (!response.json?.prompt) {
        throw new Error('AI could not create image prompt.');
      }

      updateSelected({
        image: response.json.prompt,
      });

    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : 'Image prompt generation failed.'
      );
    } finally {
      setAiBusy(false);
    }
  }
  function saveProject() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        siteName,
        sections,
        updatedAt: new Date().toISOString(),
      })
    );

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function resetProject() {
    const confirmed = window.confirm(
      'Reset the website builder to the default project?'
    );

    if (!confirmed) return;

    setSections(defaultSections);
    setSelectedId(defaultSections[0].id);
    setSiteName('My Website');
    localStorage.removeItem(STORAGE_KEY);
    setSaved(false);
  }

  function getHtml() {
    return buildFullHtml(sections).replace(
      '<title>Your Website</title>',
      `<title>${escapeHtml(siteName)}</title>`
    );
  }

  function previewWebsite() {
    const blob = new Blob([getHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function downloadWebsite() {
    const blob = new Blob([getHtml()], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'website'}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyHtml() {
    try {
      await navigator.clipboard.writeText(getHtml());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Could not copy HTML. Please use Download Website instead.');
    }
  }

  return (
    <div
      className={`-m-4 flex min-h-[calc(100vh-64px)] flex-col lg:-m-8 ${
        darkMode ? 'bg-[#06060f] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 ${
          darkMode
            ? 'border-white/10 bg-[#0a0a1a]'
            : 'border-gray-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/15">
            <Globe className="h-5 w-5 text-violet-400" />
          </div>

          <div>
            <h1 className="text-sm font-bold">Website Builder</h1>
            <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Build, edit, preview and export your website
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={siteName}
            onChange={(e) => {
              setSiteName(e.target.value);
              setSaved(false);
            }}
            className={`hidden sm:block w-36 rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
              darkMode
                ? 'border-white/10 bg-white/5 text-white'
                : 'border-gray-200 bg-gray-50 text-gray-900'
            }`}
            placeholder="Website name"
          />

          <div
            className={`flex rounded-lg border p-1 ${
              darkMode
                ? 'border-white/10 bg-white/5'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <button
              onClick={() => setDevice('desktop')}
              className={`rounded-md p-2 ${
                device === 'desktop'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title="Desktop preview"
            >
              <Monitor className="h-4 w-4" />
            </button>            <button
              onClick={() => setDevice('tablet')}
              className={`rounded-md p-2 ${
                device === 'tablet'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title="Tablet preview"
            >
              <Monitor className="h-4 w-4" />
            </button>

            <button
              onClick={() => setDevice('mobile')}
              className={`rounded-md p-2 ${
                device === 'mobile'
                  ? 'bg-violet-600 text-white'
                  : darkMode
                    ? 'text-gray-400'
                    : 'text-gray-500'
              }`}
              title="Mobile preview"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={undo}
            disabled={!history.length}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold `}
            title="Undo"
          >
            <RotateCcw className="h-4 w-4" />
            Undo
          </button>

          <button
            onClick={redo}
            disabled={!future.length}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold `}
            title="Redo"
          >
            <RotateCcw className="h-4 w-4 rotate-180" />
            Redo
          </button>

          <button
            onClick={previewWebsite}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
              darkMode
                ? 'border-white/10 text-gray-300 hover:bg-white/5'
                : 'border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            Preview
          </button>

          <button
            onClick={downloadWebsite}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          <button
            onClick={saveProject}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save'}
          </button>

          <button
            onClick={resetProject}
            className={`rounded-lg border p-2 ${
              darkMode
                ? 'border-white/10 text-gray-400 hover:bg-white/5'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className={`w-full shrink-0 border-b p-4 lg:w-64 lg:border-b-0 lg:border-r ${
            darkMode
              ? 'border-white/10 bg-[#0a0a1a]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-violet-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Add Section
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {(Object.keys(SECTION_LABELS) as SectionType[]).map((type) => (
              <button
                key={type}
                onClick={() => addSection(type)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  darkMode
                    ? 'border-white/10 text-gray-300 hover:border-violet-500/40 hover:bg-violet-500/10'
                    : 'border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50'
                }`}
              >
                <Plus className="h-3.5 w-3.5 text-violet-400" />
                {SECTION_LABELS[type]}
              </button>
            ))}
          </div>

          <div
            className={`mt-6 rounded-xl border p-3 ${
              darkMode
                ? 'border-violet-500/20 bg-violet-500/5'
                : 'border-violet-100 bg-violet-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">AI Website Builder</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              Describe the website you want and AI will replace the current canvas with a complete design.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => {
                setAiPrompt(e.target.value);
                setAiError('');
              }}
              rows={4}
              placeholder="Example: Modern Italian restaurant in Stockholm with online booking, menu, testimonials and warm luxury colors..."
              className={`mt-3 w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                darkMode
                  ? 'border-white/10 bg-white/5 text-white placeholder:text-gray-600'
                  : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
              }`}
            />
            <button
              onClick={generateWithAI}
              disabled={!aiPrompt.trim() || aiBusy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiBusy ? 'Generating...' : 'Generate Website'}
            </button>
            {aiError && (
              <p className="mt-2 text-[11px] leading-relaxed text-red-400">{aiError}</p>
            )}
          </div>

          <div
            className={`mt-4 rounded-xl border p-3 ${
              darkMode
                ? 'border-white/10 bg-white/[0.03]'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold">Export</span>
            </div>

            <button
              onClick={copyHtml}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                darkMode
                  ? 'border-white/10 text-gray-300 hover:bg-white/5'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied HTML' : 'Copy HTML'}
            </button>
          </div>
        </aside>

        <main
          className={`min-h-[600px] flex-1 overflow-auto p-4 lg:p-6 ${
            darkMode ? 'bg-[#030712]' : 'bg-gray-100'
          }`}
        >
          <div
            className={`mx-auto overflow-hidden rounded-2xl shadow-2xl transition-all ${
              device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : 'w-full max-w-6xl'
            } ${darkMode ? 'bg-[#0f172a]' : 'bg-white'}`}
          >
            {sections.map((section) => (
              <SectionPreview
                key={section.id}
                section={section}
                selected={selectedId === section.id}
                onSelect={() => setSelectedId(section.id)}
                device={device}
              />
            ))}
          </div>
        </main>

        <aside
          className={`w-full shrink-0 border-t p-4 lg:w-72 lg:border-l lg:border-t-0 ${
            darkMode
              ? 'border-white/10 bg-[#0a0a1a]'
              : 'border-gray-200 bg-white'
          }`}
        >
          <div className="mb-5 flex items-center gap-2">
            <Eye className="h-4 w-4 text-violet-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Inspector
            </h2>
          </div>

          {!selectedSection ? (
            <div className="py-10 text-center text-xs text-gray-500">
              Select a section to edit it.
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Section
                </label>
                <div
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-gray-300'
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  {SECTION_LABELS[selectedSection.type]}
                </div>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Type className="h-3.5 w-3.5" />
                  Title
                </label>
                <input
                  value={selectedSection.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Description
                </label>
                <textarea
                  value={selectedSection.description}
                  onChange={(e) =>
                    updateSelected({ description: e.target.value })
                  }
                  rows={4}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                    darkMode
                      ? 'border-white/10 bg-white/5 text-white'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                  }`}
                />
              </div>

              {selectedSection.type !== 'footer' && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Button Text
                    </label>
                    <input
                      value={selectedSection.buttonText}
                      onChange={(e) =>
                        updateSelected({ buttonText: e.target.value })
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                        darkMode
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <Link className="h-3.5 w-3.5" />
                      Button Link
                    </label>
                    <input
                      value={selectedSection.buttonUrl}
                      onChange={(e) =>
                        updateSelected({ buttonUrl: e.target.value })
                      }
                      placeholder="#contact or https://..."
                      className={`w-full rounded-lg border px-3 py-2 text-xs outline-none focus:border-violet-500 ${
                        darkMode
                          ? 'border-white/10 bg-white/5 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-900'
                      }`}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                  <Palette className="h-3.5 w-3.5" />
                  Background
                </label>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSection.background}
                    onChange={(e) =>
                      updateSelected({ background: e.target.value })
                    }
                    className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    value={selectedSection.background}
                    onChange={(e) =>
                      updateSelected({ background: e.target.value })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Accent
                </label>

                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedSection.accent}
                    onChange={(e) =>
                      updateSelected({ accent: e.target.value })
                    }
                    className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                  <input
                    value={selectedSection.accent}
                    onChange={(e) =>
                      updateSelected({ accent: e.target.value })
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs uppercase outline-none focus:border-violet-500 ${
                      darkMode
                        ? 'border-white/10 bg-white/5 text-white'
                        : 'border-gray-200 bg-gray-50 text-gray-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => moveSection(selectedSection.id, 'up')}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Up
                </button>

                <button
                  onClick={() => moveSection(selectedSection.id, 'down')}
                  className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs ${
                    darkMode
                      ? 'border-white/10 text-gray-300 hover:bg-white/5'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Down
                </button>
              </div>

              <button
                onClick={() => deleteSection(selectedSection.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Section
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

















