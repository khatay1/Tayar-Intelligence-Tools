import type { EditorNativeOperation } from './editor-native-operation';
import type { EditorProjectLike } from './editor-model';
import { findEditorElement, findEditorPage, findEditorSection } from './editor-model';
import type { EditorSelection } from './editor-selection';

function setNestedClone(source: Record<string, unknown> | undefined, path: string[], value: unknown) {
  const root: Record<string, unknown> = { ...(source || {}) };
  let cursor = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const existing = cursor[key];
    const next = existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
    cursor[key] = next;
    cursor = next;
  }
  cursor[path[path.length - 1]] = value;
  return root;
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

  if (selection.elementId && selection.sectionId) {
    const match = findEditorElement(project, selection.pageId, selection.sectionId, selection.elementId);
    if (!match) return undefined;
    const changes = parts.length === 1
      ? { [parts[0]]: value }
      : { [parts[0]]: setNestedClone(match.element[parts[0]] as Record<string, unknown> | undefined, parts.slice(1), value) };
    return { action: 'update_element', pageId: selection.pageId, sectionId: selection.sectionId, elementId: selection.elementId, changes };
  }

  if (selection.sectionId) {
    const match = findEditorSection(project, selection.pageId, selection.sectionId);
    if (!match) return undefined;
    const changes = parts.length === 1
      ? { [parts[0]]: value }
      : { [parts[0]]: setNestedClone(match.section[parts[0]] as Record<string, unknown> | undefined, parts.slice(1), value) };
    return { action: 'update_section', pageId: selection.pageId, sectionId: selection.sectionId, changes };
  }

  const page = findEditorPage(project, selection.pageId)?.page;
  if (!page) return undefined;
  return { action: 'update_page', pageId: selection.pageId, changes: { [parts[0]]: value } };
}
