interface SEOConfig {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  structuredData?: Record<string, unknown>;
  robots?: string;
}

const BASE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://tayar.ai';
const DEFAULT_IMAGE = `${BASE_URL}/site.jfif`;

export function updateSEO(config: SEOConfig) {
  const { title, description, image, url, type = 'website', structuredData, robots = 'index, follow' } = config;
  document.title = title;
  setMeta('name', 'title', title);
  if (description) {
    setMeta('name', 'description', description);
    setMeta('property', 'og:description', description);
    setMeta('name', 'twitter:description', description);
  }
  setMeta('name', 'robots', robots);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:url', url || window.location.href);
  setMeta('property', 'og:image', image || DEFAULT_IMAGE);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:image', image || DEFAULT_IMAGE);

  const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (canonical) canonical.href = url || window.location.href.split('#')[0];

  let script = document.querySelector('#dynamic-structured-data') as HTMLScriptElement | null;
  if (structuredData) {
    if (!script) {
      script = document.createElement('script');
      script.id = 'dynamic-structured-data';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(structuredData);
  } else if (script) {
    script.remove();
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
    title: 'Tayar Intelligence — Build, Create & Ship from One Workspace',
    description: 'Build websites, create documents, translate, study and collaborate from one workspace. Website Builder V1 supports publishing, releases, analytics, leads and team roles.',
    url: BASE_URL,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Tayar Intelligence',
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web',
      url: BASE_URL,
      description: 'A web workspace for website building, documents, writing, translation, study workflows and team collaboration.',
    },
  },
  login: { title: 'Sign In — Tayar Intelligence', description: 'Sign in to your Tayar Intelligence workspace.', robots: 'noindex, nofollow' },
  register: { title: 'Create Account — Tayar Intelligence', description: 'Create a free Tayar Intelligence account and start with the workspace.', robots: 'noindex, nofollow' },
  forgot: { title: 'Reset Password — Tayar Intelligence', description: 'Recover access to your Tayar Intelligence account.', robots: 'noindex, nofollow' },
  verify: { title: 'Verify Email — Tayar Intelligence', description: 'Verify your email address for Tayar Intelligence.', robots: 'noindex, nofollow' },
  reset: { title: 'Set New Password — Tayar Intelligence', description: 'Choose a new password for your Tayar Intelligence account.', robots: 'noindex, nofollow' },
  workspace: { title: 'Workspace — Tayar Intelligence', description: 'Your Tayar Intelligence workspace for projects, tools and collaboration.', robots: 'noindex, nofollow' },
  about: { title: 'About — Tayar Intelligence', description: 'Learn what Tayar Intelligence is building and how the workspace is designed.' },
  privacy: { title: 'Privacy Policy — Tayar Intelligence', description: 'Read the Tayar Intelligence privacy policy.' },
  terms: { title: 'Terms of Service — Tayar Intelligence', description: 'Read the Tayar Intelligence terms of service.' },
};
