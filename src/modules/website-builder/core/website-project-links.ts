import { normalizeAnchorId } from './website-builder-rendering';

interface Section { id: string; type?: string; anchorId?: unknown; buttonText?: unknown; buttonUrl?: unknown;
  elements: Array<{ id: string; type?: string; href?: unknown; action?: unknown }> }
interface Page { id: string; slug?: string; sections: Section[] }
export interface WebsiteProjectLinkIssue { code: string; message: string; pageId: string; sectionId: string; elementId?: string }

/** Deterministic project-local navigation checks. External destinations are
 * not fetched and cannot become proof of application readiness. */
export function websiteProjectLinkIssues(pages: Page[], homePageId?: string): WebsiteProjectLinkIssue[] {
  const issues: WebsiteProjectLinkIssue[] = [];
  const find = (path: string) => pages.find(page => page.slug === path.replace(/\.html$/, ''));
  const hasAnchor = (page: Page, anchor: string) => ['tayar-main-content', 'top'].includes(anchor)
    || page.sections.some(section => normalizeAnchorId(String(section.anchorId || section.type || ''), String(section.type || 'section')) === anchor);
  const check = (href: unknown, page: Page, section: Section, elementId?: string) => {
    if (typeof href !== 'string') return;
    const value = href.trim();
    // Empty/# buttons are handled elsewhere; actions such as modals are not links.
    if (!value || value === '#' || /^(?:https?:|mailto:|tel:|\/\/)/i.test(value)) return;
    let target: Page | undefined = page, anchor = '', code = '';
    if (value.startsWith('#')) anchor = value.slice(1);
    else if (value.startsWith('page:')) {
      const parts = value.slice(5).split('#'); target = find(parts[0]); anchor = parts[1] ?? '';
      if (parts.length > 2 || !target) code = 'LINK_PAGE_MISSING';
    } else if (value.startsWith('/')) code = 'LINK_ESCAPES_PROJECT';
    else if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      const parts = value.replace(/^\.\//, '').split('#');
      target = parts[0] === 'index.html' ? (pages.find(page => page.id === homePageId) ?? pages[0]) : find(parts[0]); anchor = parts[1] ?? '';
      if (parts.length > 2 || !target) code = 'LINK_PAGE_MISSING';
    }
    if (!code && target && anchor && !hasAnchor(target, anchor)) code = 'LINK_ANCHOR_MISSING';
    if (code) issues.push({ code, message: `Link "${value}" has no valid destination inside this project.`, pageId: page.id, sectionId: section.id, ...(elementId ? { elementId } : {}) });
  };
  for (const page of pages) for (const section of page.sections) {
    if (section.type !== 'contact' && section.buttonText) check(section.buttonUrl, page, section);
    for (const element of section.elements) if (element.type === 'button' && (!element.action || element.action === 'link')) {
      if (section.type !== 'contact') check(element.href, page, section, element.id);
    }
  }
  return issues;
}
