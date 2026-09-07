import { assertToolAccess } from '@/lib/tool-access';
import { supabase } from '@/lib/supabase';

export type MobileSectionType = 'hero' | 'features' | 'about' | 'services' | 'pricing' | 'testimonials' | 'contact' | 'footer';

export type MobileWebsiteElement = {
  id: string;
  type: string;
  content: string;
  href?: string;
  style: Record<string, unknown>;
  [key: string]: unknown;
};

export type MobileWebsiteSection = {
  id: string;
  type: MobileSectionType;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  background: string;
  accent: string;
  layout: 'stack' | 'two-column' | 'three-column';
  layoutGap: number;
  layoutAlign: 'start' | 'center' | 'end' | 'stretch';
  containers: unknown[];
  elements: MobileWebsiteElement[];
  formFields?: Array<Record<string, unknown>>;
  formSuccessMessage?: string;
  formSuccessAction?: 'message' | 'redirect';
  formRedirectUrl?: string;
  [key: string]: unknown;
};

export type MobileWebsitePage = {
  id: string;
  name: string;
  slug: string;
  sections: MobileWebsiteSection[];
  showInNavigation: boolean;
  seoTitle: string;
  seoDescription: string;
  socialImage: string;
  canonicalUrl: string;
  language: string;
  translationKey: string;
  noIndex: boolean;
  [key: string]: unknown;
};

export type MobileWebsiteContent = Record<string, unknown> & {
  version: number;
  siteName: string;
  language: string;
  pages: MobileWebsitePage[];
  activePageId: string;
  homePageId: string;
  brand: {
    name: string;
    industry: string;
    style: string;
    colors: { primary: string; secondary: string };
    tone: string;
    [key: string]: unknown;
  };
  seo: { title: string; description: string; keywords: string[]; [key: string]: unknown };
  updatedAt: string;
  publishedUrl?: string;
};

export type MobileWebsiteProjectRow = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  content: MobileWebsiteContent;
  status: string;
  updated_at: string;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeText(value: unknown, fallback = '', max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function makeElements(section: Pick<MobileWebsiteSection, 'title' | 'description' | 'buttonText' | 'buttonUrl' | 'accent'>): MobileWebsiteElement[] {
  const elements: MobileWebsiteElement[] = [
    { id: uid('heading'), type: 'heading', content: section.title, style: { color: '#ffffff', fontSize: 42, fontWeight: 800, textAlign: 'center' } },
    { id: uid('text'), type: 'text', content: section.description, style: { color: '#cbd5e1', fontSize: 16, fontWeight: 400, textAlign: 'center' } },
  ];
  if (section.buttonText) {
    elements.push({ id: uid('button'), type: 'button', content: section.buttonText, href: section.buttonUrl, style: { color: '#ffffff', backgroundColor: section.accent, fontSize: 14, fontWeight: 700, textAlign: 'center', padding: 12, borderRadius: 12 } });
  }
  return elements;
}

function syncSectionCopyElements(section: MobileWebsiteSection): MobileWebsiteElement[] {
  const source = Array.isArray(section.elements) ? section.elements : [];
  const result = source.map((element) => ({ ...element }));

  const updateFirst = (type: 'heading' | 'text' | 'button', content: string, href?: string) => {
    const index = result.findIndex((element) => element?.type === type);
    if (index < 0) return false;
    result[index] = {
      ...result[index],
      content,
      ...(type === 'button' ? { href: href || '' } : {}),
    };
    return true;
  };

  const hasHeading = updateFirst('heading', section.title);
  const hasText = updateFirst('text', section.description);
  const hasButton = updateFirst('button', section.buttonText, section.buttonUrl);

  if (!hasHeading) {
    result.unshift({ id: uid('heading'), type: 'heading', content: section.title, style: { color: '#ffffff', fontSize: 42, fontWeight: 800, textAlign: 'center' } });
  }
  if (!hasText) {
    const headingIndex = result.findIndex((element) => element.type === 'heading');
    result.splice(Math.max(0, headingIndex + 1), 0, { id: uid('text'), type: 'text', content: section.description, style: { color: '#cbd5e1', fontSize: 16, fontWeight: 400, textAlign: 'center' } });
  }
  if (!hasButton && section.buttonText) {
    result.push({ id: uid('button'), type: 'button', content: section.buttonText, href: section.buttonUrl, style: { color: '#ffffff', backgroundColor: section.accent, fontSize: 14, fontWeight: 700, textAlign: 'center', padding: 12, borderRadius: 12 } });
  }

  return result;
}

const sectionDefaults: Record<MobileSectionType, { title: string; description: string; buttonText: string; buttonUrl: string; background: string; accent: string }> = {
  hero: { title: 'Build Something Amazing', description: 'Create a professional website for your business, portfolio, service or personal brand.', buttonText: 'Get Started', buttonUrl: '#contact', background: '#111827', accent: '#7c3aed' },
  features: { title: 'Everything You Need', description: 'Showcase the key benefits that make your product or service different.', buttonText: 'Explore Features', buttonUrl: '#features', background: '#0f172a', accent: '#8b5cf6' },
  about: { title: 'About Your Business', description: 'Tell visitors who you are, what you do and why they should choose you.', buttonText: 'Learn More', buttonUrl: '#about', background: '#111827', accent: '#a855f7' },
  services: { title: 'Our Services', description: 'Present the services you offer to your customers.', buttonText: 'View Services', buttonUrl: '#services', background: '#0f172a', accent: '#6366f1' },
  pricing: { title: 'Simple Pricing', description: 'Present your plans and pricing clearly.', buttonText: 'Choose Plan', buttonUrl: '#contact', background: '#111827', accent: '#8b5cf6' },
  testimonials: { title: 'What Customers Say', description: 'Build trust with testimonials from your customers.', buttonText: 'See Reviews', buttonUrl: '#contact', background: '#0f172a', accent: '#a855f7' },
  contact: { title: 'Let’s Work Together', description: 'Ready to get started? Give your customers an easy way to contact you.', buttonText: 'Contact Us', buttonUrl: 'mailto:hello@example.com', background: '#0f172a', accent: '#7c3aed' },
  footer: { title: 'Your Company', description: 'All rights reserved.', buttonText: '', buttonUrl: '', background: '#020617', accent: '#7c3aed' },
};

export function createMobileWebsiteSection(type: MobileSectionType, overrides: Partial<MobileWebsiteSection> = {}): MobileWebsiteSection {
  const base = sectionDefaults[type];
  const section: MobileWebsiteSection = {
    id: uid(type),
    type,
    ...base,
    layout: 'stack',
    layoutGap: 20,
    layoutAlign: 'center',
    containers: [],
    elements: [],
    formRedirectUrl: '',
    ...overrides,
  };
  section.elements = makeElements(section);
  if (type === 'contact') {
    section.formFields = [
      { id: uid('field-name'), name: 'name', label: 'Name', type: 'text', placeholder: 'Your name', required: true },
      { id: uid('field-email'), name: 'email', label: 'Email', type: 'email', placeholder: 'Your email', required: true },
      { id: uid('field-message'), name: 'message', label: 'Message', type: 'textarea', placeholder: 'Your message', required: true },
    ];
    section.formSuccessMessage = 'Thanks! Your message has been sent.';
    section.formSuccessAction = 'message';
  }
  return section;
}

export function createMobileWebsiteContent(siteName: string): MobileWebsiteContent {
  const name = safeText(siteName, 'My Website', 100) || 'My Website';
  const homeId = uid('page-home');
  const now = new Date().toISOString();
  const sections = (['hero', 'features', 'about', 'contact', 'footer'] as MobileSectionType[]).map((type) => createMobileWebsiteSection(type));
  return {
    version: 5,
    siteName: name,
    language: 'en',
    pages: [{
      id: homeId,
      name: 'Home',
      slug: 'home',
      sections,
      showInNavigation: true,
      seoTitle: name,
      seoDescription: '',
      socialImage: '',
      canonicalUrl: '',
      language: 'en',
      translationKey: 'home',
      noIndex: false,
    }],
    activePageId: homeId,
    homePageId: homeId,
    brand: { name, industry: 'Business', style: 'Modern', colors: { primary: '#7c3aed', secondary: '#0f172a' }, tone: 'Professional' },
    seo: { title: name, description: '', keywords: [] },
    theme: { primaryColor: '#7c3aed', secondaryColor: '#0f172a', backgroundColor: '#020617', textColor: '#ffffff', mutedTextColor: '#cbd5e1', fontFamily: 'Inter', contentWidth: 1180, sectionSpacing: 88, buttonRadius: 12 },
    headerConfig: { enabled: true, sticky: true, brandText: name, logoUrl: '', brandSize: 20, backgroundColor: '#020617', textColor: '#ffffff', activeColor: '#a78bfa', hoverColor: '#c4b5fd', borderColor: '#ffffff18', navGap: 24, navSize: 14, showCta: true, ctaLabel: 'Get Started', ctaHref: '#contact', ctaBackgroundColor: '#7c3aed', ctaTextColor: '#ffffff', mobileMenu: true, languageSwitcher: false },
    footerConfig: { enabled: true, text: `© ${new Date().getFullYear()} ${name}`, showNavigation: true, facebookUrl: '', instagramUrl: '', linkedinUrl: '', xUrl: '' },
    deliveryConfig: {},
    productionConfig: {},
    siteEnhancements: {},
    symbols: [],
    history: [],
    faviconUrl: '',
    siteUrl: '',
    publishedUrl: '',
    publishedAt: '',
    lastPublishedFingerprint: '',
    lastPublishedVersionId: '',
    previewUrl: '',
    previewToken: '',
    previewCreatedAt: '',
    updatedAt: now,
  };
}

function normalizePage(raw: unknown, index: number): MobileWebsitePage | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const sections = Array.isArray(source.sections)
    ? source.sections.filter((value): value is MobileWebsiteSection => Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).id === 'string'))
    : [];
  return {
    ...source,
    id: safeText(source.id, `page-${index + 1}`, 120),
    name: safeText(source.name, `Page ${index + 1}`, 120),
    slug: safeText(source.slug, `page-${index + 1}`, 120),
    sections,
    showInNavigation: source.showInNavigation !== false,
    seoTitle: safeText(source.seoTitle, '', 180),
    seoDescription: safeText(source.seoDescription, '', 500),
    socialImage: safeText(source.socialImage, '', 2000),
    canonicalUrl: safeText(source.canonicalUrl, '', 2000),
    language: safeText(source.language, 'en', 12),
    translationKey: safeText(source.translationKey, '', 120),
    noIndex: source.noIndex === true,
  } as MobileWebsitePage;
}

export function normalizeMobileWebsiteContent(raw: unknown, fallbackTitle = 'Website'): MobileWebsiteContent {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createMobileWebsiteContent(fallbackTitle);
  const source = raw as Record<string, unknown>;
  const pages = Array.isArray(source.pages) ? source.pages.map(normalizePage).filter(Boolean) as MobileWebsitePage[] : [];
  if (!pages.length) return createMobileWebsiteContent(safeText(source.siteName, fallbackTitle, 100));
  const brandSource = source.brand && typeof source.brand === 'object' && !Array.isArray(source.brand) ? source.brand as Record<string, unknown> : {};
  const colorsSource = brandSource.colors && typeof brandSource.colors === 'object' && !Array.isArray(brandSource.colors) ? brandSource.colors as Record<string, unknown> : {};
  const seoSource = source.seo && typeof source.seo === 'object' && !Array.isArray(source.seo) ? source.seo as Record<string, unknown> : {};
  const siteName = safeText(source.siteName, fallbackTitle, 100) || fallbackTitle;
  const activePageId = pages.some((page) => page.id === source.activePageId) ? String(source.activePageId) : pages[0].id;
  const homePageId = pages.some((page) => page.id === source.homePageId) ? String(source.homePageId) : pages[0].id;
  return {
    ...source,
    version: Number(source.version) || 5,
    siteName,
    language: safeText(source.language, 'en', 12),
    pages,
    activePageId,
    homePageId,
    brand: {
      ...brandSource,
      name: safeText(brandSource.name, siteName, 120),
      industry: safeText(brandSource.industry, 'Business', 120),
      style: safeText(brandSource.style, 'Modern', 120),
      colors: { ...colorsSource, primary: safeText(colorsSource.primary, '#7c3aed', 30), secondary: safeText(colorsSource.secondary, '#0f172a', 30) },
      tone: safeText(brandSource.tone, 'Professional', 120),
    },
    seo: {
      ...seoSource,
      title: safeText(seoSource.title, siteName, 180),
      description: safeText(seoSource.description, '', 500),
      keywords: Array.isArray(seoSource.keywords) ? seoSource.keywords.map((value) => safeText(value, '', 80)).filter(Boolean).slice(0, 30) : [],
    },
    updatedAt: safeText(source.updatedAt, new Date().toISOString(), 64),
    publishedUrl: safeText(source.publishedUrl, '', 2000),
  };
}

export async function listMobileWebsiteProjects() {
  await assertToolAccess('website-builder');
  const { data, error } = await supabase
    .from('projects')
    .select('id,user_id,workspace_id,title,content,status,updated_at')
    .eq('type', 'website-builder')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id || ''),
    workspace_id: row.workspace_id ? String(row.workspace_id) : null,
    title: safeText(row.title, 'Website', 120),
    content: normalizeMobileWebsiteContent(row.content, safeText(row.title, 'Website', 120)),
    status: safeText(row.status, 'draft', 30),
    updated_at: safeText(row.updated_at, '', 64),
  } satisfies MobileWebsiteProjectRow));
}

export async function createMobileWebsiteProject(userId: string, title: string) {
  await assertToolAccess('website-builder');
  const safeTitle = safeText(title, 'New Website', 120) || 'New Website';
  const content = createMobileWebsiteContent(safeTitle);
  const { data, error } = await supabase.from('projects').insert({ user_id: userId, title: safeTitle, type: 'website-builder', content, status: 'draft' }).select('id,user_id,workspace_id,title,content,status,updated_at').single();
  if (error) throw error;
  return {
    ...data,
    content: normalizeMobileWebsiteContent(data.content, safeTitle),
  } as MobileWebsiteProjectRow;
}

export async function saveMobileWebsiteProject(project: MobileWebsiteProjectRow) {
  const content = { ...project.content, updatedAt: new Date().toISOString() };
  const { error } = await supabase.from('projects').update({ title: project.title.trim().slice(0, 120) || 'Website', content, updated_at: new Date().toISOString() }).eq('id', project.id);
  if (error) throw error;
  return content;
}

export async function archiveMobileWebsiteProject(projectId: string) {
  const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', projectId);
  if (error) throw error;
}

export function replaceSectionCopy(content: MobileWebsiteContent, pageId: string, sectionId: string, values: { title: string; description: string; buttonText: string; buttonUrl: string }) {
  const pages = content.pages.map((page) => page.id !== pageId ? page : {
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== sectionId) return section;
      const next: MobileWebsiteSection = {
        ...section,
        title: values.title.slice(0, 180),
        description: values.description.slice(0, 2000),
        buttonText: values.buttonText.slice(0, 100),
        buttonUrl: values.buttonUrl.slice(0, 1000),
      };
      next.elements = syncSectionCopyElements(next);
      return next;
    }),
  });
  return { ...content, pages, updatedAt: new Date().toISOString() };
}

export function appendSection(content: MobileWebsiteContent, pageId: string, type: MobileSectionType) {
  return {
    ...content,
    pages: content.pages.map((page) => page.id === pageId ? { ...page, sections: [...page.sections, createMobileWebsiteSection(type, { accent: content.brand.colors.primary })] } : page),
    updatedAt: new Date().toISOString(),
  };
}

export function removeSection(content: MobileWebsiteContent, pageId: string, sectionId: string) {
  return {
    ...content,
    pages: content.pages.map((page) => page.id === pageId ? { ...page, sections: page.sections.filter((section) => section.id !== sectionId) } : page),
    updatedAt: new Date().toISOString(),
  };
}

export async function generateMobileWebsiteCopy(brief: string, current: MobileWebsiteContent) {
  await assertToolAccess('website-builder');
  const prompt = safeText(brief, '', 6000);
  if (!prompt) throw new Error('Describe the website you want first.');
  const { data, error } = await supabase.functions.invoke('ai-engine', {
    body: {
      tool: 'website-builder',
      jsonMode: true,
      maxTokens: 5000,
      temperature: 0.55,
      messages: [
        { role: 'system', content: 'You are Tayar mobile website strategist. Return JSON only. Create concise, conversion-focused website copy. Never include scripts, HTML, CSS, secrets, medical/legal/financial guarantees, or invented testimonials. Schema: {"siteName":"","industry":"","tone":"","primaryColor":"#RRGGBB","seo":{"title":"","description":""},"sections":[{"type":"hero|features|about|services|pricing|testimonials|contact|footer","title":"","description":"","buttonText":"","buttonUrl":""}]}. Include 4-7 sections, with hero first and footer last.' },
        { role: 'user', content: `Current site: ${current.siteName}\nBrief: ${prompt}` },
      ],
    },
  });
  if (error) throw error;
  const payload = data as Record<string, unknown> | null;
  let generated: Record<string, unknown> | null = payload?.json && typeof payload.json === 'object' && !Array.isArray(payload.json) ? payload.json as Record<string, unknown> : null;
  if (!generated && typeof payload?.content === 'string') {
    try { generated = JSON.parse(payload.content) as Record<string, unknown>; } catch { /* handled below */ }
  }
  if (!generated) throw new Error('AI returned an invalid website draft.');
  const primaryColor = /^#[0-9a-f]{6}$/i.test(String(generated.primaryColor || '')) ? String(generated.primaryColor) : current.brand.colors.primary;
  const rawSections = Array.isArray(generated.sections) ? generated.sections : [];
  const allowed = new Set<MobileSectionType>(['hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer']);
  const sections = rawSections.slice(0, 8).map((value) => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const type = allowed.has(String(source.type) as MobileSectionType) ? String(source.type) as MobileSectionType : 'features';
    return createMobileWebsiteSection(type, {
      title: safeText(source.title, sectionDefaults[type].title, 180),
      description: safeText(source.description, sectionDefaults[type].description, 2000),
      buttonText: safeText(source.buttonText, sectionDefaults[type].buttonText, 100),
      buttonUrl: safeText(source.buttonUrl, sectionDefaults[type].buttonUrl, 1000),
      accent: primaryColor,
    });
  });
  if (!sections.length) throw new Error('AI did not return usable website sections.');
  const activePageId = current.activePageId || current.pages[0].id;
  const siteName = safeText(generated.siteName, current.siteName, 100) || current.siteName;
  const seoGenerated = generated.seo && typeof generated.seo === 'object' && !Array.isArray(generated.seo) ? generated.seo as Record<string, unknown> : {};
  return {
    ...current,
    siteName,
    brand: { ...current.brand, name: siteName, industry: safeText(generated.industry, current.brand.industry, 120), tone: safeText(generated.tone, current.brand.tone, 120), colors: { ...current.brand.colors, primary: primaryColor } },
    seo: { ...current.seo, title: safeText(seoGenerated.title, siteName, 180), description: safeText(seoGenerated.description, current.seo.description, 500) },
    pages: current.pages.map((page) => page.id === activePageId ? { ...page, seoTitle: safeText(seoGenerated.title, siteName, 180), seoDescription: safeText(seoGenerated.description, '', 500), sections } : page),
    headerConfig: { ...(current.headerConfig as Record<string, unknown> || {}), brandText: siteName, ctaBackgroundColor: primaryColor },
    updatedAt: new Date().toISOString(),
  } as MobileWebsiteContent;
}
