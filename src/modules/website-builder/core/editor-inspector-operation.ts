import type { EditorNativeOperation } from './editor-native-operation';
import type {
  EditorFormFieldLike,
  EditorProjectLike,
  EditorSectionLike,
} from './editor-model';
import {
  findEditorElement,
  findEditorPage,
  findEditorSection,
} from './editor-model';
import type { EditorSelection } from './editor-selection';

function setNestedClone(
  source: Record<string, unknown> | undefined,
  path: string[],
  value: unknown,
) {
  const root: Record<string, unknown> = { ...(source || {}) };
  let cursor = root;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    const existing = cursor[key];

    const next =
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};

    cursor[key] = next;
    cursor = next;
  }

  cursor[path[path.length - 1]] = value;
  return root;
}

function buildChanges(
  target: Record<string, unknown>,
  parts: string[],
  value: unknown,
) {
  if (parts.length === 1) {
    return { [parts[0]]: value };
  }

  return {
    [parts[0]]: setNestedClone(
      target[parts[0]] as Record<string, unknown> | undefined,
      parts.slice(1),
      value,
    ),
  };
}

function findContainer(
  section: EditorSectionLike,
  containerId: string,
) {
  return section.containers?.find(
    (container) => container.id === containerId,
  );
}

function findFormField(
  section: EditorSectionLike,
  formFieldId: string,
): EditorFormFieldLike | undefined {
  return section.formFields?.find(
    (formField) => formField.id === formFieldId,
  );
}

function normalizeInspectorValue(
  key: string,
  value: unknown,
) {
  if (key === 'options' && typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 50);
  }

  return value;
}

export function buildEditorInspectorOperation<P extends EditorProjectLike>(
  project: P,
  selection: EditorSelection,
  key: string,
  value: unknown,
): EditorNativeOperation | undefined {
  if (!selection.pageId) return undefined;

  const parts = key.split('.').filter(Boolean);
  if (!parts.length) return undefined;

  const normalizedValue =
    normalizeInspectorValue(key, value);

  if (selection.elementId && selection.sectionId) {
    const match =
      findEditorElement(
        project,
        selection.pageId,
        selection.sectionId,
        selection.elementId,
      );

    if (!match) return undefined;

    return {
      action: 'update_element',
      pageId: selection.pageId,
      sectionId: selection.sectionId,
      elementId: selection.elementId,
      changes: buildChanges(
        match.element as Record<string, unknown>,
        parts,
        normalizedValue,
      ),
    };
  }

  if (selection.sectionId) {
    const sectionMatch =
      findEditorSection(
        project,
        selection.pageId,
        selection.sectionId,
      );

    if (!sectionMatch) return undefined;

    if (selection.containerId) {
      const container =
        findContainer(
          sectionMatch.section,
          selection.containerId,
        );

      if (!container) return undefined;

      return {
        action: 'update_container',
        pageId: selection.pageId,
        sectionId: selection.sectionId,
        containerId: selection.containerId,
        changes: buildChanges(
          container as Record<string, unknown>,
          parts,
          normalizedValue,
        ),
      };
    }

    if (selection.formFieldId) {
      const formField =
        findFormField(
          sectionMatch.section,
          selection.formFieldId,
        );

      if (!formField) return undefined;

      return {
        action: 'update_form_field',
        pageId: selection.pageId,
        sectionId: selection.sectionId,
        formFieldId: selection.formFieldId,
        changes: buildChanges(
          formField as Record<string, unknown>,
          parts,
          normalizedValue,
        ),
      };
    }

    return {
      action: 'update_section',
      pageId: selection.pageId,
      sectionId: selection.sectionId,
      changes: buildChanges(
        sectionMatch.section as Record<string, unknown>,
        parts,
        normalizedValue,
      ),
    };
  }

  const page =
    findEditorPage(
      project,
      selection.pageId,
    )?.page;

  if (!page) return undefined;

  return {
    action: 'update_page',
    pageId: selection.pageId,
    changes: buildChanges(
      page as Record<string, unknown>,
      parts,
      normalizedValue,
    ),
  };
}
