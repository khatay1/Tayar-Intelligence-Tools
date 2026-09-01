import type { Language } from '@/context/PreferencesContext';
import { createSection, normalizeSection } from './defaults';
import type { WebsiteSection } from './types';

export interface NormalizedWebsiteProjectPage {
  id: string;
  name: string;
  slug: string;
  sections: WebsiteSection[];
  showInNavigation: boolean;
  seoTitle: string;
  seoDescription: string;
  socialImage: string;
  canonicalUrl: string;
  language: Language;
  translationKey: string;
  noIndex: boolean;
}

interface PersistedProjectPageInput {
  id?: string;
  name?: string;
  slug?: string;
  sections?: WebsiteSection[];
  showInNavigation?: boolean;
  seoTitle?: string;
  seoDescription?: string;
  socialImage?: string;
  canonicalUrl?: string;
  language?: Language;
  translationKey?: string;
  noIndex?: boolean;
}

interface PersistedProjectEnvelope {
  pages?: PersistedProjectPageInput[];
  sections?: WebsiteSection[];
  language?: Language;
  activePageId?: string;
  homePageId?: string;
  [key: string]: unknown;
}

interface NormalizedProjectLoadBase {
  pages: NormalizedWebsiteProjectPage[];
  sections: WebsiteSection[];
  activePageId: string;
  homePageId: string;
}

export type NormalizedWebsiteProjectLoad =
  | ({ kind: 'legacy-array'; parsed: null } & NormalizedProjectLoadBase)
  | ({ kind: 'pages'; parsed: PersistedProjectEnvelope } & NormalizedProjectLoadBase)
  | ({ kind: 'sections'; parsed: PersistedProjectEnvelope } & NormalizedProjectLoadBase)
  | { kind: 'invalid'; parsed: null; pages: []; sections: []; activePageId: ''; homePageId: '' };

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

function normalizePageLanguage(value: unknown, fallback: Language = 'en'): Language {
  return value === 'ar' || value === 'sv' || value === 'en' ? value : fallback;
}

function createLegacyHomePage(sections: WebsiteSection[]): NormalizedWebsiteProjectPage {
  return {
    id: 'page-home',
    name: 'Home',
    slug: 'home',
    sections,
    showInNavigation: true,
    seoTitle: '',
    seoDescription: '',
    socialImage: '',
    canonicalUrl: '',
    language: 'en',
    translationKey: 'home',
    noIndex: false,
  };
}

export function normalizeWebsiteProjectLoad(input: unknown): NormalizedWebsiteProjectLoad {
  if (Array.isArray(input) && input.length) {
    const sections = input.map(normalizeSection);
    const page = createLegacyHomePage(sections);
    return {
      kind: 'legacy-array',
      parsed: null,
      pages: [page],
      sections,
      activePageId: page.id,
      homePageId: page.id,
    };
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      kind: 'invalid',
      parsed: null,
      pages: [],
      sections: [],
      activePageId: '',
      homePageId: '',
    };
  }

  const parsed = input as PersistedProjectEnvelope;

  if (Array.isArray(parsed.pages) && parsed.pages.length) {
    const projectLanguage = normalizePageLanguage(parsed.language, 'en');
    const pages: NormalizedWebsiteProjectPage[] = parsed.pages.map((page, index) => ({
      id: page.id || `page-${index}-${Date.now()}`,
      name: page.name || `Page ${index + 1}`,
      slug: normalizeSlug(page.slug || page.name || `page-${index + 1}`),
      sections: Array.isArray(page.sections) && page.sections.length
        ? page.sections.map(normalizeSection)
        : [createSection('hero')],
      showInNavigation: page.showInNavigation !== false,
      seoTitle: typeof page.seoTitle === 'string' ? page.seoTitle : '',
      seoDescription: typeof page.seoDescription === 'string' ? page.seoDescription : '',
      socialImage: typeof page.socialImage === 'string' ? page.socialImage : '',
      canonicalUrl: typeof page.canonicalUrl === 'string' ? page.canonicalUrl : '',
      language: normalizePageLanguage(page.language, projectLanguage),
      translationKey: typeof page.translationKey === 'string' ? page.translationKey.slice(0, 120) : '',
      noIndex: page.noIndex === true,
    }));

    const activePage = pages.find((page) => page.id === parsed.activePageId) || pages[0];
    const homePageId =
      typeof parsed.homePageId === 'string' && pages.some((page) => page.id === parsed.homePageId)
        ? parsed.homePageId
        : pages[0].id;

    return {
      kind: 'pages',
      parsed,
      pages,
      sections: activePage.sections,
      activePageId: activePage.id,
      homePageId,
    };
  }

  if (Array.isArray(parsed.sections) && parsed.sections.length) {
    const sections = parsed.sections.map(normalizeSection);
    const page = createLegacyHomePage(sections);
    return {
      kind: 'sections',
      parsed,
      pages: [page],
      sections,
      activePageId: page.id,
      homePageId: page.id,
    };
  }

  return {
    kind: 'invalid',
    parsed: null,
    pages: [],
    sections: [],
    activePageId: '',
    homePageId: '',
  };
}
