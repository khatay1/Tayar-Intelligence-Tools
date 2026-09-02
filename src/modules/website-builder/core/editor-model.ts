export interface EditorElementLike {
  id: string;
  type?: string;
  containerId?: string;
  symbolId?: string;
  style?: Record<string, unknown>;
  responsive?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EditorContainerLike {
  id: string;
  [key: string]: unknown;
}

export interface EditorFormFieldLike {
  id: string;
  [key: string]: unknown;
}

export interface EditorSectionLike {
  id: string;
  type?: string;
  elements: EditorElementLike[];
  containers?: EditorContainerLike[];
  formFields?: EditorFormFieldLike[];
  [key: string]: unknown;
}

export interface EditorPageLike {
  id: string;
  name?: string;
  slug?: string;
  sections: EditorSectionLike[];
  [key: string]: unknown;
}

export interface EditorSymbolLike {
  id: string;
  name?: string;
  element: EditorElementLike;
  [key: string]: unknown;
}

export interface EditorProjectLike {
  pages: EditorPageLike[];
  homePageId?: string;
  theme?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  headerConfig?: Record<string, unknown>;
  symbols?: EditorSymbolLike[];
  [key: string]: unknown;
}

export interface EditorProjectLimits {
  maxPages?: number;
  maxSectionsPerPage?: number;
  maxElementsPerSection?: number;
  maxContainersPerSection?: number;
  maxFormFieldsPerSection?: number;
  maxSymbols?: number;
}

export const DEFAULT_EDITOR_PROJECT_LIMITS: Required<EditorProjectLimits> = {
  maxPages: 50,
  maxSectionsPerPage: 80,
  maxElementsPerSection: 60,
  maxContainersPerSection: 30,
  maxFormFieldsPerSection: 20,
  maxSymbols: 100,
};

export function resolveEditorProjectLimits(
  limits: EditorProjectLimits = {},
): Required<EditorProjectLimits> {
  const bounded = (value: number | undefined, fallback: number, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(max, Math.round(parsed)));
  };

  return {
    maxPages: bounded(limits.maxPages, DEFAULT_EDITOR_PROJECT_LIMITS.maxPages, 500),
    maxSectionsPerPage: bounded(
      limits.maxSectionsPerPage,
      DEFAULT_EDITOR_PROJECT_LIMITS.maxSectionsPerPage,
      500,
    ),
    maxElementsPerSection: bounded(
      limits.maxElementsPerSection,
      DEFAULT_EDITOR_PROJECT_LIMITS.maxElementsPerSection,
      500,
    ),
    maxContainersPerSection: bounded(
      limits.maxContainersPerSection,
      DEFAULT_EDITOR_PROJECT_LIMITS.maxContainersPerSection,
      200,
    ),
    maxFormFieldsPerSection: bounded(
      limits.maxFormFieldsPerSection,
      DEFAULT_EDITOR_PROJECT_LIMITS.maxFormFieldsPerSection,
      100,
    ),
    maxSymbols: bounded(limits.maxSymbols, DEFAULT_EDITOR_PROJECT_LIMITS.maxSymbols, 500),
  };
}

export function findEditorPage<P extends EditorProjectLike>(project: P, pageId: string) {
  const index = project.pages.findIndex((page) => page.id === pageId);
  return index >= 0 ? { page: project.pages[index], index } : undefined;
}

export function findEditorSection<P extends EditorProjectLike>(
  project: P,
  pageId: string,
  sectionId: string,
) {
  const pageMatch = findEditorPage(project, pageId);
  if (!pageMatch) return undefined;
  const index = pageMatch.page.sections.findIndex((section) => section.id === sectionId);
  return index >= 0
    ? { page: pageMatch.page, pageIndex: pageMatch.index, section: pageMatch.page.sections[index], index }
    : undefined;
}

export function findEditorElement<P extends EditorProjectLike>(
  project: P,
  pageId: string,
  sectionId: string,
  elementId: string,
) {
  const sectionMatch = findEditorSection(project, pageId, sectionId);
  if (!sectionMatch) return undefined;
  const index = sectionMatch.section.elements.findIndex((element) => element.id === elementId);
  return index >= 0
    ? {
        ...sectionMatch,
        element: sectionMatch.section.elements[index],
        elementIndex: index,
      }
    : undefined;
}

export function findEditorElementById<P extends EditorProjectLike>(project: P, elementId: string) {
  for (let pageIndex = 0; pageIndex < project.pages.length; pageIndex += 1) {
    const page = project.pages[pageIndex];
    for (let sectionIndex = 0; sectionIndex < page.sections.length; sectionIndex += 1) {
      const section = page.sections[sectionIndex];
      const elementIndex = section.elements.findIndex((element) => element.id === elementId);
      if (elementIndex >= 0) {
        return {
          page,
          pageIndex,
          section,
          sectionIndex,
          element: section.elements[elementIndex],
          elementIndex,
        };
      }
    }
  }
  return undefined;
}

export function findEditorSectionById<P extends EditorProjectLike>(project: P, sectionId: string) {
  for (let pageIndex = 0; pageIndex < project.pages.length; pageIndex += 1) {
    const page = project.pages[pageIndex];
    const sectionIndex = page.sections.findIndex((section) => section.id === sectionId);
    if (sectionIndex >= 0) {
      return { page, pageIndex, section: page.sections[sectionIndex], sectionIndex };
    }
  }
  return undefined;
}

export function findEditorSymbol<P extends EditorProjectLike>(project: P, symbolId: string) {
  const symbols = project.symbols || [];
  const index = symbols.findIndex((symbol) => symbol.id === symbolId);
  return index >= 0 ? { symbol: symbols[index], index } : undefined;
}

export type EditorIdentityKind =
  | 'page'
  | 'section'
  | 'element'
  | 'container'
  | 'form-field'
  | 'symbol';

export function editorProjectIdentitySet<P extends EditorProjectLike>(
  project: P,
  kind: EditorIdentityKind,
) {
  const ids = new Set<string>();

  for (const page of project.pages) {
    if (kind === 'page') ids.add(page.id);
    for (const section of page.sections || []) {
      if (kind === 'section') ids.add(section.id);
      for (const element of section.elements || []) {
        if (kind === 'element') ids.add(element.id);
      }
      for (const container of section.containers || []) {
        if (kind === 'container') ids.add(container.id);
      }
      for (const field of section.formFields || []) {
        if (kind === 'form-field') ids.add(field.id);
      }
    }
  }

  if (kind === 'symbol') {
    for (const symbol of project.symbols || []) ids.add(symbol.id);
  }

  return ids;
}

export function editorProjectHasIdentity<P extends EditorProjectLike>(
  project: P,
  kind: EditorIdentityKind,
  id: string,
) {
  return editorProjectIdentitySet(project, kind).has(id);
}

export function editorIdSet(values: Array<{ id: string }>) {
  return new Set(values.map((value) => value.id));
}
