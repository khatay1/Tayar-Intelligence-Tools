import { cloneEditorValue } from './editor-transaction';
import type { EditorElementLike, EditorPageLike, EditorSectionLike } from './editor-model';

export type EditorCloneKind = 'page' | 'section' | 'element' | 'container' | 'form-field' | 'symbol';
export type EditorCloneIdFactory = (kind: EditorCloneKind, sourceId: string) => string;

export function createEditorCloneIdFactory(prefix = 'clone'): EditorCloneIdFactory {
  let sequence = 0;
  return (kind, sourceId) => {
    sequence += 1;
    const safe = sourceId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || kind;
    return `${prefix}-${kind}-${safe}-${Date.now().toString(36)}-${sequence.toString(36)}`;
  };
}

export function cloneEditorElementIndependent(
  element: EditorElementLike,
  idFactory: EditorCloneIdFactory,
  containerIdMap: Map<string, string> = new Map(),
): EditorElementLike {
  const clone = cloneEditorValue(element);
  clone.id = idFactory('element', element.id);
  if (clone.containerId && containerIdMap.has(clone.containerId)) {
    clone.containerId = containerIdMap.get(clone.containerId);
  }
  delete clone.symbolId;
  return clone;
}

export function cloneEditorSectionIndependent(
  section: EditorSectionLike,
  idFactory: EditorCloneIdFactory,
): EditorSectionLike {
  const clone = cloneEditorValue(section);
  clone.id = idFactory('section', section.id);

  const containerIdMap = new Map<string, string>();
  clone.containers = (section.containers || []).map((container) => {
    const next = cloneEditorValue(container);
    next.id = idFactory('container', container.id);
    containerIdMap.set(container.id, next.id);
    return next;
  });

  clone.elements = section.elements.map((element) =>
    cloneEditorElementIndependent(element, idFactory, containerIdMap),
  );

  clone.formFields = (section.formFields || []).map((field) => {
    const next = cloneEditorValue(field);
    next.id = idFactory('form-field', field.id);
    return next;
  });

  return clone;
}

export function cloneEditorPageIndependent(
  page: EditorPageLike,
  idFactory: EditorCloneIdFactory,
): EditorPageLike {
  const clone = cloneEditorValue(page);
  clone.id = idFactory('page', page.id);
  clone.sections = page.sections.map((section) => cloneEditorSectionIndependent(section, idFactory));
  return clone;
}
