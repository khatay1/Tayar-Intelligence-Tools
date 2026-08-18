// Dynamic SEO meta tag management

interface SEOConfig {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: Record<string, unknown>;
}

const BASE_URL = 'https://tayar.ai';
const DEFAULT_IMAGE = `${BASE_URL}/site.jfif`;

export function updateSEO(config: SEOConfig) {
  const { title, description, image, url, type = 'website', structuredData } = config;

  document.title = title;
  setMeta('name', 'title', title);
  if (description) {
    setMeta('name', 'description', description);
    setMeta('property', 'og:description', description);
    setMeta('name', 'twitter:description', description);
  }

  setMeta('property', 'og:title', title);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:url', url || window.location.href);
  setMeta('property', 'og:image', image || DEFAULT_IMAGE);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:card', type === 'article' ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:image', image || DEFAULT_IMAGE);

  if (structuredData) {
    let script = document.querySelector('#dynamic-structured-data') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'dynamic-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
  }
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

export const PAGE_SEO: Record<string, SEOConfig> = {
  home: {
    title: 'Tayar Intelligence Tools — AI-Powered Workspace for CVs, Writing, Study & More',
    description: 'One platform. Endless AI tools. Build ATS-friendly CVs, write cover letters, translate 100+ languages, analyze documents, and more. Supports OpenAI, Claude & Gemini.',
  },
  login: {
    title: 'Sign In — Tayar Intelligence Tools',
    description: 'Sign in to your Tayar Intelligence workspace to access all AI tools.',
  },
  register: {
    title: 'Create Account — Tayar Intelligence Tools',
    description: 'Create a free account and start building with AI-powered tools.',
  },
  workspace: {
    title: 'Workspace — Tayar Intelligence Tools',
    description: 'Your AI workspace with CV builder, cover letter writer, translator, and more.',
  },
};
