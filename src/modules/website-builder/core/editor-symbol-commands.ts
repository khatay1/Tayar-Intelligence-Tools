import { createEditorCommand, type EditorCommand } from './editor-command';
import { createEditorCloneIdFactory, type EditorCloneIdFactory } from './editor-clone';
import {
  editorProjectIdentitySet,
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

function normalizedId(value: string, label: string) {
  const id = value.trim();
  if (!id) throw new Error(`${label} ID is required`);
  if (id !== value) throw new Error(`${label} ID cannot contain surrounding whitespace`);
  return id;
}

function insertIndex<T extends { id: string }>(items: T[], position: EditorInsertPosition = {}) {
  const hasBefore = position.beforeId !== undefined;
  const hasAfter = position.afterId !== undefined;
  const hasIndex = position.index !== undefined;
  if ([hasBefore, hasAfter, hasIndex].filter(Boolean).length > 1) {
    throw new Error('Position must use exactly one of beforeId, afterId, or index');
  }

  if (hasBefore) {
    const beforeId = normalizedId(position.beforeId || '', 'Target before');
    const index = items.findIndex((item) => item.id === beforeId);
    if (index < 0) throw new Error(`Target before ID not found: ${beforeId}`);
    return index;
  }
  if (hasAfter) {
    const afterId = normalizedId(position.afterId || '', 'Target after');
    const index = items.findIndex((item) => item.id === afterId);
    if (index < 0) throw new Error(`Target after ID not found: ${afterId}`);
    return index + 1;
  }
  if (hasIndex) {
    const index = Number(position.index);
    if (!Number.isFinite(index)) throw new Error('Target index is invalid');
    return Math.max(0, Math.min(items.length, Math.round(index)));
  }
  return items.length;
}

function nextUniqueGeneratedId<P extends EditorProjectLike>(
  draft: P,
  kind: 'element' | 'symbol',
  sourceId: string,
  idFactory: EditorCloneIdFactory,
) {
  const reserved = editorProjectIdentitySet(draft, kind);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = normalizedId(idFactory(kind, sourceId), `${kind} clone`);
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique ${kind} ID`);
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
    const explicitSymbolId = input.symbolId === undefined ? undefined : normalizedId(input.symbolId, 'Symbol');
    const symbolId = explicitSymbolId || nextUniqueGeneratedId(draft, 'symbol', elementId, idFactory);
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
    element.id = nextUniqueGeneratedId(draft, 'element', symbolMatch.symbol.element.id, idFactory);
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
