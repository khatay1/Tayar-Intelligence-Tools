import type { EditorProjectLike } from './editor-model';
import type { EditorSelection } from './editor-selection';

export interface EditorInsertPlacement {
  pageId: string;
  sectionId?: string;
  containerId?: string;
  reason: 'selected-container' | 'selected-section' | 'selected-element-section' | 'active-page-last-section' | 'home-page-last-section' | 'new-section-required';
}

export function planEditorInsertPlacement<P extends EditorProjectLike>(
  project: P,
  selection: EditorSelection = {},
): EditorInsertPlacement | undefined {
  const selectedPage = selection.pageId ? project.pages.find((page) => page.id === selection.pageId) : undefined;
  const page = selectedPage || project.pages.find((candidate) => candidate.id === project.homePageId) || project.pages[0];
  if (!page) return undefined;

  if (selection.sectionId) {
    const section = page.sections.find((candidate) => candidate.id === selection.sectionId);
    if (section) {
      if (selection.containerId && section.containers?.some((container) => container.id === selection.containerId)) {
        return { pageId: page.id, sectionId: section.id, containerId: selection.containerId, reason: 'selected-container' };
      }
      if (selection.elementId && section.elements.some((element) => element.id === selection.elementId)) {
        const element = section.elements.find((candidate) => candidate.id === selection.elementId);
        return {
          pageId: page.id,
          sectionId: section.id,
          containerId: typeof element?.containerId === 'string' ? element.containerId : undefined,
          reason: 'selected-element-section',
        };
      }
      return { pageId: page.id, sectionId: section.id, reason: 'selected-section' };
    }
  }

  const lastSection = page.sections[page.sections.length - 1];
  if (lastSection) {
    return {
      pageId: page.id,
      sectionId: lastSection.id,
      reason: selectedPage ? 'active-page-last-section' : 'home-page-last-section',
    };
  }

  return { pageId: page.id, reason: 'new-section-required' };
}
