import { createSection } from './defaults';
import type { EditorNativeOperation } from './editor-native-operation';
import type { EditorPageLike, EditorSectionLike } from './editor-model';
import type { EditorSelection } from './editor-selection';
import type { EditorTemplateLibraryItem } from './editor-template-library';
import type { SectionType } from './types';

const SECTION_TYPES = new Set<SectionType>([
  'hero', 'features', 'about', 'services', 'pricing', 'testimonials', 'contact', 'footer',
]);

function nativeId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function safeSectionType(value: string): SectionType {
  return SECTION_TYPES.has(value as SectionType) ? value as SectionType : 'features';
}

function buildSections(template: EditorTemplateLibraryItem): EditorSectionLike[] {
  const types = template.sectionTypes?.length ? template.sectionTypes : ['features'];
  return types.map((type) => createSection(safeSectionType(type)) as unknown as EditorSectionLike);
}

function slugName(slug: string, fallback: string) {
  if (slug === '/') return fallback;
  return slug
    .replace(/^\/+|\/+$/g, '')
    .split(/[-/]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || fallback;
}

function createPage(template: EditorTemplateLibraryItem, slug: string, index: number): EditorPageLike {
  const normalizedSlug = slug === '/' ? '/' : `/${slug.replace(/^\/+|\/+$/g, '')}`;
  return {
    id: nativeId('page'),
    name: slugName(normalizedSlug, index === 0 ? template.name : `Page ${index + 1}`),
    slug: normalizedSlug,
    sections: buildSections(template),
  };
}

export interface EditorTemplateInsertPlan {
  operations: EditorNativeOperation[];
  selection?: EditorSelection;
  createdPageIds: string[];
  createdSectionIds: string[];
}

/**
 * Produces one native operation batch so template insertion uses the same
 * validation/history/undo transaction path as manual editor mutations.
 */
export function planEditorTemplateInsert(
  template: EditorTemplateLibraryItem,
  activePageId?: string,
): EditorTemplateInsertPlan {
  if (template.kind === 'section') {
    if (!activePageId) return { operations: [], createdPageIds: [], createdSectionIds: [] };
    const sections = buildSections(template);
    return {
      operations: sections.map(section => ({
        action: 'add_section' as const,
        source: 'manual' as const,
        pageId: activePageId,
        section,
      })),
      selection: sections[0] ? { pageId: activePageId, sectionId: sections[0].id } : { pageId: activePageId },
      createdPageIds: [],
      createdSectionIds: sections.map(section => section.id),
    };
  }

  const slugs = template.kind === 'site'
    ? (template.pageSlugs?.length ? template.pageSlugs : ['/', '/about', '/contact'])
    : [template.pageSlugs?.[0] || `/${template.id}`];
  const pages = slugs.map((slug, index) => createPage(template, slug, index));

  return {
    operations: pages.map(page => ({
      action: 'add_page' as const,
      source: 'manual' as const,
      page,
    })),
    selection: pages[0] ? { pageId: pages[0].id } : undefined,
    createdPageIds: pages.map(page => page.id),
    createdSectionIds: pages.flatMap(page => page.sections.map(section => section.id)),
  };
}
