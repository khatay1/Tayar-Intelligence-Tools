import type { EditorElementLike, EditorPageLike, EditorProjectLike } from './editor-model';

export type EditorQualitySeverity = 'error' | 'warning' | 'info';
export type EditorQualityCategory = 'seo' | 'accessibility' | 'links' | 'performance';

export interface EditorQualityIssue {
  id: string;
  category: EditorQualityCategory;
  severity: EditorQualitySeverity;
  message: string;
  pageId?: string;
  sectionId?: string;
  elementId?: string;
  fixableWithAI?: boolean;
}

export interface EditorSiteQualityReport {
  score: number;
  issues: EditorQualityIssue[];
  counts: Record<EditorQualitySeverity, number>;
  categoryCounts: Record<EditorQualityCategory, number>;
}

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function bool(value: unknown) { return value === true; }
function issue(id: string, category: EditorQualityCategory, severity: EditorQualitySeverity, message: string, target: Partial<EditorQualityIssue> = {}): EditorQualityIssue {
  return { id, category, severity, message, ...target };
}

function pageSeo(page: EditorPageLike) {
  const seo = (page.seo && typeof page.seo === 'object' ? page.seo : {}) as Record<string, unknown>;
  return {
    title: text(seo.title) || text(page.seoTitle) || text(page.name),
    description: text(seo.description) || text(page.metaDescription),
    canonical: text(seo.canonical) || text(page.canonical),
    ogImage: text(seo.ogImage) || text(page.ogImage),
    noIndex: bool(seo.noIndex) || bool(page.noIndex),
    schema: seo.schema ?? page.schema,
  };
}

function elementText(element: EditorElementLike) { return text(element.content) || text(element.text) || text(element.label); }
function isExternalHref(href: string) { return /^https?:\/\//i.test(href); }
function isUnsafeHref(href: string) { return /^javascript:/i.test(href); }

export function auditEditorSiteQuality(project: EditorProjectLike): EditorSiteQualityReport {
  const issues: EditorQualityIssue[] = [];
  const slugs = new Map<string, string>();

  for (const page of project.pages) {
    const slug = text(page.slug) || '/';
    const normalizedSlug = slug === '/' ? '/' : `/${slug.replace(/^\/+|\/+$/g, '')}`;
    const previous = slugs.get(normalizedSlug);
    if (previous) issues.push(issue(`duplicate-slug:${page.id}`, 'seo', 'error', 'Duplicate page slug', { pageId: page.id, fixableWithAI: true }));
    else slugs.set(normalizedSlug, page.id);

    const seo = pageSeo(page);
    if (!seo.title) issues.push(issue(`title:${page.id}`, 'seo', 'error', 'Missing SEO title', { pageId: page.id, fixableWithAI: true }));
    else if (seo.title.length > 60) issues.push(issue(`title-length:${page.id}`, 'seo', 'warning', 'SEO title is longer than 60 characters', { pageId: page.id, fixableWithAI: true }));
    if (!seo.description) issues.push(issue(`description:${page.id}`, 'seo', 'warning', 'Missing meta description', { pageId: page.id, fixableWithAI: true }));
    else if (seo.description.length > 160) issues.push(issue(`description-length:${page.id}`, 'seo', 'warning', 'Meta description is longer than 160 characters', { pageId: page.id, fixableWithAI: true }));
    if (!seo.canonical && !seo.noIndex) issues.push(issue(`canonical:${page.id}`, 'seo', 'info', 'Canonical URL is not configured', { pageId: page.id, fixableWithAI: true }));
    if (!seo.ogImage && !seo.noIndex) issues.push(issue(`og:${page.id}`, 'seo', 'info', 'Open Graph image is not configured', { pageId: page.id, fixableWithAI: true }));

    let h1Count = 0;
    for (const section of page.sections || []) {
      for (const element of section.elements || []) {
        const target = { pageId: page.id, sectionId: section.id, elementId: element.id };
        const type = text(element.type).toLowerCase();
        const tag = text(element.tag).toLowerCase();
        if (tag === 'h1' || (type === 'heading' && text(element.level).toLowerCase() === 'h1')) h1Count += 1;
        if (type === 'image') {
          const alt = text(element.alt);
          if (!alt && !bool(element.decorative)) issues.push(issue(`alt:${element.id}`, 'accessibility', 'error', 'Image is missing alternative text', { ...target, fixableWithAI: true }));
          const src = text(element.src);
          if (src && !bool(element.lazy) && !bool(element.loadingLazy)) issues.push(issue(`lazy:${element.id}`, 'performance', 'info', 'Image is not marked for lazy loading', { ...target }));
        }
        const href = text(element.href);
        if (href) {
          if (isUnsafeHref(href)) issues.push(issue(`unsafe-link:${element.id}`, 'links', 'error', 'Unsafe link URL', target));
          else if (href.startsWith('#') && href.length === 1) issues.push(issue(`empty-anchor:${element.id}`, 'links', 'warning', 'Link target is empty', { ...target, fixableWithAI: true }));
          else if (!isExternalHref(href) && href.startsWith('/')) {
            const route = href.split(/[?#]/)[0] || '/';
            if (!slugs.has(route) && !project.pages.some(candidate => candidate.id === href)) issues.push(issue(`broken-link:${element.id}`, 'links', 'error', 'Internal link does not match a page', { ...target, fixableWithAI: true }));
          }
        }
        if ((type === 'button' || type === 'link') && !elementText(element)) issues.push(issue(`link-name:${element.id}`, 'accessibility', 'error', 'Interactive element has no accessible name', { ...target, fixableWithAI: true }));
      }
    }
    if (!seo.noIndex && h1Count === 0) issues.push(issue(`h1:${page.id}`, 'seo', 'warning', 'Page has no H1 heading', { pageId: page.id, fixableWithAI: true }));
    if (h1Count > 1) issues.push(issue(`h1-many:${page.id}`, 'seo', 'info', 'Page has multiple H1 headings', { pageId: page.id, fixableWithAI: true }));
  }

  const counts = { error: 0, warning: 0, info: 0 };
  const categoryCounts = { seo: 0, accessibility: 0, links: 0, performance: 0 };
  for (const item of issues) { counts[item.severity] += 1; categoryCounts[item.category] += 1; }
  const penalty = counts.error * 12 + counts.warning * 5 + counts.info * 1;
  return { score: Math.max(0, Math.min(100, 100 - penalty)), issues, counts, categoryCounts };
}

export function buildEditorSitemapPaths(project: EditorProjectLike): string[] {
  return project.pages.filter(page => !pageSeo(page).noIndex).map(page => {
    const slug = text(page.slug);
    return !slug || slug === '/' ? '/' : `/${slug.replace(/^\/+|\/+$/g, '')}`;
  });
}

export function buildEditorRobotsPolicy(project: EditorProjectLike) {
  const blocked = project.pages.filter(page => pageSeo(page).noIndex).map(page => text(page.slug)).filter(Boolean).map(slug => `/${slug.replace(/^\/+|\/+$/g, '')}`);
  return { indexable: blocked.length !== project.pages.length, blockedPaths: blocked };
}
