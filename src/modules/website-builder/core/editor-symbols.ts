import { cloneEditorValue } from './editor-transaction';
import {
  findEditorSymbol,
  type EditorElementLike,
  type EditorProjectLike,
  type EditorSymbolLike,
} from './editor-model';

const INSTANCE_LOCAL_KEYS = new Set(['id', 'containerId', 'symbolId']);

export function symbolSyncPayload(element: EditorElementLike) {
  const payload = cloneEditorValue(element) as Record<string, unknown>;
  for (const key of INSTANCE_LOCAL_KEYS) delete payload[key];
  return payload;
}

export function syncEditorSymbolFromInstance<P extends EditorProjectLike>(
  project: P,
  symbolId: string,
  sourceElement: EditorElementLike,
) {
  const match = findEditorSymbol(project, symbolId);
  if (!match) throw new Error(`Symbol not found: ${symbolId}`);
  const payload = symbolSyncPayload(sourceElement);

  const templateId = match.symbol.element.id;
  match.symbol.element = {
    ...match.symbol.element,
    ...cloneEditorValue(payload),
    id: templateId,
  };

  for (const page of project.pages) {
    for (const section of page.sections) {
      for (const element of section.elements) {
        if (element.symbolId !== symbolId || element.id === sourceElement.id) continue;
        const localId = element.id;
        const localContainerId = element.containerId;
        Object.assign(element, cloneEditorValue(payload));
        element.id = localId;
        element.symbolId = symbolId;
        if (localContainerId) element.containerId = localContainerId;
        else delete element.containerId;
      }
    }
  }
}

export function createEditorSymbolTemplate(
  symbolId: string,
  name: string,
  element: EditorElementLike,
): EditorSymbolLike {
  const template = cloneEditorValue(element);
  delete template.containerId;
  delete template.symbolId;
  return {
    id: symbolId,
    name,
    element: template,
  };
}
