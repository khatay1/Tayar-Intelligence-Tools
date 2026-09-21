import type { EditorPageLike, EditorProjectLike } from './editor-model';

export interface EditorPageSeo {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: 'summary' | 'summary_large_image';
  noIndex: boolean;
  noFollow: boolean;
  schemaType: 'WebPage' | 'AboutPage' | 'ContactPage' | 'Article' | 'Product' | 'FAQPage';
  schemaJson?: Record<string, unknown>;
}

export interface EditorSiteSeo {
  siteName: string;
  defaultTitleSuffix: string;
  defaultDescription: string;
  defaultOgImage: string;
  robotsEnabled: boolean;
  sitemapEnabled: boolean;
}

const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const booleanValue = (value: unknown) => value === true;

export function readEditorPageSeo(page: EditorPageLike): EditorPageSeo {
  const seo = (page.seo && typeof page.seo === 'object' ? page.seo : {}) as Record<string, unknown>;
  const schemaType = stringValue(seo.schemaType || page.schemaType) as EditorPageSeo['schemaType'];
  return {
    title: stringValue(seo.title || page.seoTitle || page.name),
    description: stringValue(seo.description || page.metaDescription),
    canonical: stringValue(seo.canonical || page.canonical),
    ogTitle: stringValue(seo.ogTitle || page.ogTitle),
    ogDescription: stringValue(seo.ogDescription || page.ogDescription),
    ogImage: stringValue(seo.ogImage || page.ogImage),
    twitterCard: stringValue(seo.twitterCard || page.twitterCard) === 'summary' ? 'summary' : 'summary_large_image',
    noIndex: booleanValue(seo.noIndex ?? page.noIndex),
    noFollow: booleanValue(seo.noFollow ?? page.noFollow),
    schemaType: ['WebPage', 'AboutPage', 'ContactPage', 'Article', 'Product', 'FAQPage'].includes(schemaType) ? schemaType : 'WebPage',
    schemaJson: (seo.schemaJson && typeof seo.schemaJson === 'object' ? seo.schemaJson : page.schemaJson) as Record<string, unknown> | undefined,
  };
}

export function readEditorSiteSeo(project: EditorProjectLike): EditorSiteSeo {
  const seo = (project.seo && typeof project.seo === 'object' ? project.seo : {}) as Record<string, unknown>;
  return {
    siteName: stringValue(seo.siteName),
    defaultTitleSuffix: stringValue(seo.defaultTitleSuffix),
    defaultDescription: stringValue(seo.defaultDescription),
    defaultOgImage: stringValue(seo.defaultOgImage),
    robotsEnabled: seo.robotsEnabled !== false,
    sitemapEnabled: seo.sitemapEnabled !== false,
  };
}

export function normalizeEditorPageSeo(input: Partial<EditorPageSeo>): EditorPageSeo {
  const schemaType = input.schemaType || 'WebPage';
  return {
    title: stringValue(input.title).slice(0, 200),
    description: stringValue(input.description).slice(0, 500),
    canonical: stringValue(input.canonical).slice(0, 2048),
    ogTitle: stringValue(input.ogTitle).slice(0, 200),
    ogDescription: stringValue(input.ogDescription).slice(0, 500),
    ogImage: stringValue(input.ogImage).slice(0, 2048),
    twitterCard: input.twitterCard === 'summary' ? 'summary' : 'summary_large_image',
    noIndex: Boolean(input.noIndex),
    noFollow: Boolean(input.noFollow),
    schemaType: ['WebPage', 'AboutPage', 'ContactPage', 'Article', 'Product', 'FAQPage'].includes(schemaType) ? schemaType : 'WebPage',
    schemaJson: input.schemaJson && typeof input.schemaJson === 'object' ? input.schemaJson : undefined,
  };
}

export function buildEditorPageStructuredData(page: EditorPageLike, site: EditorSiteSeo): Record<string, unknown> {
  const seo = readEditorPageSeo(page);
  const custom = seo.schemaJson || {};
  return {
    '@context': 'https://schema.org',
    '@type': seo.schemaType,
    name: seo.title || page.name || 'Page',
    ...(seo.description || site.defaultDescription ? { description: seo.description || site.defaultDescription } : {}),
    ...(seo.canonical ? { url: seo.canonical } : {}),
    ...(site.siteName ? { isPartOf: { '@type': 'WebSite', name: site.siteName } } : {}),
    ...custom,
  };
}

export function buildEditorPageMeta(page: EditorPageLike, project: EditorProjectLike) {
  const pageSeo = readEditorPageSeo(page);
  const siteSeo = readEditorSiteSeo(project);
  const title = pageSeo.title ? `${pageSeo.title}${siteSeo.defaultTitleSuffix}` : siteSeo.siteName;
  const description = pageSeo.description || siteSeo.defaultDescription;
  const ogTitle = pageSeo.ogTitle || title;
  const ogDescription = pageSeo.ogDescription || description;
  const ogImage = pageSeo.ogImage || siteSeo.defaultOgImage;
  return {
    title, description, canonical: pageSeo.canonical,
    robots: `${pageSeo.noIndex ? 'noindex' : 'index'},${pageSeo.noFollow ? 'nofollow' : 'follow'}`,
    openGraph: { title: ogTitle, description: ogDescription, image: ogImage },
    twitter: { card: pageSeo.twitterCard, title: ogTitle, description: ogDescription, image: ogImage },
    structuredData: buildEditorPageStructuredData(page, siteSeo),
  };
}
