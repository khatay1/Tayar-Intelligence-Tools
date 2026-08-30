import { createEditorCommand, type EditorCommand } from './editor-command';
import { createEditorCloneIdFactory, type EditorCloneIdFactory } from './editor-clone';
import {
  findEditorElement,
  findEditorSection,
  findEditorSymbol,
  type EditorProjectLike,
} from './editor-model';
import { cloneEditorValue } from './editor-transaction';
import { createEditorSymbolTemplate } from './editor-symbols';
import type { EditorCommandAdapterOptions, EditorInsertPosition } from './editor-command-adapters';

function commandOptions<P>(
  label: string,
  mutate: EditorCommand<P>['mutate'],
  options: EditorCommandAdapterOptions = {},
): EditorCommand<P> {
  return createEditorCommand({
    id: options.id,
    label,
    source: options.source,
    coalesceKey: options.coalesceKey,
    coalesceWindowMs: options.coalesceWindowMs,
    mutate,
  });
}

function insertIndex<T extends { id: string }>(items: T[], position: EditorInsertPosition = {}) {
  if (position.beforeId) {
    const index = items.findIndex((item) => item.id === position.beforeId);
    if (index < 0) throw new Error(`Target before ID not found: ${position.beforeId}`);
    return index;
  }
  if (position.afterId) {
    const index = items.findIndex((item) => item.id === position.afterId);
    if (index < 0) throw new Error(`Target after ID not found: ${position.afterId}`);
    return index + 1;
  }
  if (position.index !== undefined) {
    const index = Number(position.index);
    if (!Number.isFinite(index)) throw new Error('Target index is invalid');
    return Math.max(0, Math.min(items.length, Math.round(index)));
  }
  return items.length;
}

export function commandCreateSymbol<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  input: { symbolId?: string; name?: string } = {},
  options: EditorCommandAdapterOptions & { idFactory?: EditorCloneIdFactory } = {},
) {
  return commandOptions<P>('Create reusable component', (draft) => {
    const match = findEditorElement(draft, pageId, sectionId, elementId);
    if (!match) throw new Error(`Element not found: ${elementId}`);
    if (match.element.symbolId) throw new Error('Element is already linked to a reusable component');

    const idFactory = options.idFactory || createEditorCloneIdFactory('symbol');
    const symbolId = input.symbolId?.trim() || idFactory('symbol', elementId);
    if (findEditorSymbol(draft, symbolId)) throw new Error(`Symbol already exists: ${symbolId}`);

    const symbols = draft.symbols || (draft.symbols = []);
    symbols.push(createEditorSymbolTemplate(symbolId, input.name?.trim() || 'Reusable component', match.element));
    match.element.symbolId = symbolId;
  }, options);
}

export function commandInsertSymbol<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  symbolId: string,
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions & { idFactory?: EditorCloneIdFactory } = {},
) {
  return commandOptions<P>('Insert reusable component', (draft) => {
    const sectionMatch = findEditorSection(draft, pageId, sectionId);
    if (!sectionMatch) throw new Error(`Section not found: ${sectionId}`);
    const symbolMatch = findEditorSymbol(draft, symbolId);
    if (!symbolMatch) throw new Error(`Symbol not found: ${symbolId}`);

    const idFactory = options.idFactory || createEditorCloneIdFactory('symbol-instance');
    const element = cloneEditorValue(symbolMatch.symbol.element);
    element.id = idFactory('element', symbolMatch.symbol.element.id);
    element.symbolId = symbolId;
    delete element.containerId;
    sectionMatch.section.elements.splice(insertIndex(sectionMatch.section.elements, position), 0, element);
  }, options);
}

export function commandDetachSymbol<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Detach reusable component', (draft) => {
    const match = findEditorElement(draft, pageId, sectionId, elementId);
    if (!match) throw new Error(`Element not found: ${elementId}`);
    if (!match.element.symbolId) throw new Error('Element is not linked to a reusable component');
    delete match.element.symbolId;
  }, options);
}
