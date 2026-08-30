import {
  findEditorElement,
  findEditorPage,
  findEditorSection,
  type EditorProjectLike,
} from './editor-model';

export interface EditorSelection {
  pageId?: string;
  sectionId?: string;
  elementId?: string;
  containerId?: string;
  formFieldId?: string;
}

export interface EditorResolvedSelection extends EditorSelection {
  pageId: string;
  sectionId: string;
}

export function sanitizeEditorSelection<P extends EditorProjectLike>(
  project: P,
  selection: EditorSelection = {},
): EditorResolvedSelection | undefined {
  if (!project.pages.length) return undefined;

  const preferredPage = selection.pageId ? findEditorPage(project, selection.pageId)?.page : undefined;
  const homePage = project.homePageId ? findEditorPage(project, project.homePageId)?.page : undefined;
  const page = preferredPage || homePage || project.pages[0];
  if (!page.sections.length) return undefined;

  const preferredSection = selection.sectionId
    ? findEditorSection(project, page.id, selection.sectionId)?.section
    : undefined;
  const section = preferredSection || page.sections[0];

  const result: EditorResolvedSelection = {
    pageId: page.id,
    sectionId: section.id,
  };

  if (selection.elementId && findEditorElement(project, page.id, section.id, selection.elementId)) {
    result.elementId = selection.elementId;
  }

  if (
    selection.containerId &&
    section.containers?.some((container) => container.id === selection.containerId)
  ) {
    result.containerId = selection.containerId;
  }

  if (
    selection.formFieldId &&
    section.formFields?.some((field) => field.id === selection.formFieldId)
  ) {
    result.formFieldId = selection.formFieldId;
  }

  return result;
}

export function selectionTargetsSameNode(left: EditorSelection, right: EditorSelection) {
  return left.pageId === right.pageId &&
    left.sectionId === right.sectionId &&
    left.elementId === right.elementId &&
    left.containerId === right.containerId &&
    left.formFieldId === right.formFieldId;
}
