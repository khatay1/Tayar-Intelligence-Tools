import type { EditorProjectLike } from './editor-model';
import type { EditorSelection } from './editor-selection';

export interface EditorNavigationElementNode {
  id: string;
  label: string;
  type: string;
  selected: boolean;
  symbolLinked: boolean;
}

export interface EditorNavigationContainerNode {
  id: string;
  label: string;
  selected: boolean;
}

export interface EditorNavigationFormFieldNode {
  id: string;
  label: string;
  type: string;
  selected: boolean;
}

export interface EditorNavigationSectionNode {
  id: string;
  label: string;
  type: string;
  selected: boolean;
  containers: EditorNavigationContainerNode[];
  elements: EditorNavigationElementNode[];
  formFields: EditorNavigationFormFieldNode[];
}

export interface EditorNavigationPageNode {
  id: string;
  label: string;
  slug: string;
  selected: boolean;
  home: boolean;
  sections: EditorNavigationSectionNode[];
}

function text(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : fallback;
}

export function buildEditorNavigationModel<P extends EditorProjectLike>(
  project: P,
  selection: EditorSelection = {},
): EditorNavigationPageNode[] {
  return project.pages.map((page, pageIndex) => ({
    id: page.id,
    label: text(page.name, `Page ${pageIndex + 1}`),
    slug: text(page.slug, '/'),
    selected: page.id === selection.pageId,
    home: page.id === project.homePageId,
    sections: page.sections.map((section, sectionIndex) => ({
      id: section.id,
      label: text(
        section.title,
        `${text(section.type, 'Section')} ${sectionIndex + 1}`,
      ),
      type: text(section.type, 'section'),
      selected:
        section.id === selection.sectionId &&
        page.id === selection.pageId,
      containers: (section.containers || []).map(
        (container, containerIndex) => ({
          id: container.id,
          label: text(
            container.name,
            `Container ${containerIndex + 1}`,
          ),
          selected:
            container.id === selection.containerId &&
            section.id === selection.sectionId &&
            page.id === selection.pageId,
        }),
      ),
      elements: section.elements.map((element, elementIndex) => ({
        id: element.id,
        label: text(
          element.name,
          text(
            element.content,
            `${text(element.type, 'Element')} ${elementIndex + 1}`,
          ),
        ).slice(0, 80),
        type: text(element.type, 'element'),
        selected:
          element.id === selection.elementId &&
          section.id === selection.sectionId &&
          page.id === selection.pageId,
        symbolLinked: Boolean(element.symbolId),
      })),
      formFields: (section.formFields || []).map(
        (formField, formFieldIndex) => ({
          id: formField.id,
          label: text(
            formField.label,
            text(
              formField.name,
              `Field ${formFieldIndex + 1}`,
            ),
          ),
          type: text(formField.type, 'field'),
          selected:
            formField.id === selection.formFieldId &&
            section.id === selection.sectionId &&
            page.id === selection.pageId,
        }),
      ),
    })),
  }));
}

export type EditorInspectorTarget =
  | {
      kind: 'element';
      pageId: string;
      sectionId: string;
      elementId: string;
    }
  | {
      kind: 'container';
      pageId: string;
      sectionId: string;
      containerId: string;
    }
  | {
      kind: 'form-field';
      pageId: string;
      sectionId: string;
      formFieldId: string;
    }
  | {
      kind: 'section';
      pageId: string;
      sectionId: string;
    }
  | {
      kind: 'page';
      pageId: string;
    }
  | {
      kind: 'project';
    };

export function resolveEditorInspectorTarget(
  selection: EditorSelection,
): EditorInspectorTarget {
  if (
    selection.pageId &&
    selection.sectionId &&
    selection.elementId
  ) {
    return {
      kind: 'element',
      pageId: selection.pageId,
      sectionId: selection.sectionId,
      elementId: selection.elementId,
    };
  }

  if (
    selection.pageId &&
    selection.sectionId &&
    selection.containerId
  ) {
    return {
      kind: 'container',
      pageId: selection.pageId,
      sectionId: selection.sectionId,
      containerId: selection.containerId,
    };
  }

  if (
    selection.pageId &&
    selection.sectionId &&
    selection.formFieldId
  ) {
    return {
      kind: 'form-field',
      pageId: selection.pageId,
      sectionId: selection.sectionId,
      formFieldId: selection.formFieldId,
    };
  }

  if (selection.pageId && selection.sectionId) {
    return {
      kind: 'section',
      pageId: selection.pageId,
      sectionId: selection.sectionId,
    };
  }

  if (selection.pageId) {
    return {
      kind: 'page',
      pageId: selection.pageId,
    };
  }

  return {
    kind: 'project',
  };
}
