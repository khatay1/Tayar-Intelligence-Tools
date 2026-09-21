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
import {
  applyEditorSymbolMetadata,
  createEditorSymbolTemplate,
  type EditorSymbolMetadataChanges,
} from './editor-symbols';
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

function normalizedName(value: string | undefined, fallback: string) {
  const name = typeof value === 'string' ? value.trim().slice(0, 80) : '';
  return name || fallback;
}

function assertUniqueSymbolName<P extends EditorProjectLike>(draft: P, name: string, exceptId?: string) {
  const key = name.toLocaleLowerCase();
  const duplicate = (draft.symbols || []).some((symbol) => symbol.id !== exceptId && (symbol.name || '').trim().toLocaleLowerCase() === key);
  if (duplicate) throw new Error(`A component named “${name}” already exists`);
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
    const name = normalizedName(input.name, 'Reusable component');
    assertUniqueSymbolName(draft, name);

    const symbols = draft.symbols || (draft.symbols = []);
    symbols.push(createEditorSymbolTemplate(symbolId, name, match.element));
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
    element.layoutColumn = sectionMatch.section.layout === 'stack' ? undefined : 1;
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

export function commandUpdateSymbol<P extends EditorProjectLike>(
  symbolId: string,
  changes: EditorSymbolMetadataChanges,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update reusable component', (draft) => {
    const match = findEditorSymbol(draft, symbolId);
    if (!match) throw new Error(`Symbol not found: ${symbolId}`);
    if (typeof changes.name === 'string') {
      const name = normalizedName(changes.name, match.symbol.name || 'Reusable component');
      assertUniqueSymbolName(draft, name, symbolId);
    }
    (draft.symbols || [])[match.index] = applyEditorSymbolMetadata(match.symbol, changes);
  }, options);
}

export function commandDuplicateSymbol<P extends EditorProjectLike>(
  symbolId: string,
  input: {
    symbolId?: string;
    name?: string;
    asVariant?: boolean;
    variantName?: string;
  } = {},
  options: EditorCommandAdapterOptions & { idFactory?: EditorCloneIdFactory } = {},
) {
  return commandOptions<P>(input.asVariant ? 'Create component variant' : 'Duplicate reusable component', (draft) => {
    const match = findEditorSymbol(draft, symbolId);
    if (!match) throw new Error(`Symbol not found: ${symbolId}`);
    const idFactory = options.idFactory || createEditorCloneIdFactory(input.asVariant ? 'symbol-variant' : 'symbol-copy');
    const explicitSymbolId = input.symbolId === undefined ? undefined : normalizedId(input.symbolId, 'Symbol');
    const nextId = explicitSymbolId || nextUniqueGeneratedId(draft, 'symbol', symbolId, idFactory);
    if (findEditorSymbol(draft, nextId)) throw new Error(`Symbol already exists: ${nextId}`);

    const sourceName = match.symbol.name || 'Reusable component';
    const variantName = normalizedName(input.variantName, 'Variant');
    const name = normalizedName(input.name, input.asVariant ? `${sourceName} · ${variantName}` : `${sourceName} Copy`);
    assertUniqueSymbolName(draft, name);

    const next = cloneEditorValue(match.symbol);
    next.id = nextId;
    next.name = name;
    next.element = cloneEditorValue(match.symbol.element);
    next.updatedAt = new Date().toISOString();

    if (input.asVariant) {
      const groupId = match.symbol.variantGroupId || match.symbol.id;
      if (!match.symbol.variantGroupId) {
        (draft.symbols || [])[match.index] = applyEditorSymbolMetadata(match.symbol, {
          variantGroupId: groupId,
          variantName: match.symbol.variantName || 'Default',
        });
      }
      next.variantGroupId = groupId;
      next.variantName = variantName;
    } else {
      delete next.variantGroupId;
      delete next.variantName;
    }

    (draft.symbols || (draft.symbols = [])).push(next);
  }, options);
}

export function commandDeleteSymbol<P extends EditorProjectLike>(
  symbolId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Delete reusable component', (draft) => {
    const match = findEditorSymbol(draft, symbolId);
    if (!match) throw new Error(`Symbol not found: ${symbolId}`);
    const groupId = match.symbol.variantGroupId;

    for (const page of draft.pages) {
      for (const section of page.sections) {
        for (const element of section.elements) {
          if (element.symbolId === symbolId) delete element.symbolId;
        }
      }
    }

    const symbols = draft.symbols || [];
    symbols.splice(match.index, 1);
    if (groupId) {
      const siblings = symbols.filter((symbol) => symbol.variantGroupId === groupId);
      if (siblings.length === 1) {
        const sibling = siblings[0];
        const siblingIndex = symbols.findIndex((symbol) => symbol.id === sibling.id);
        symbols[siblingIndex] = applyEditorSymbolMetadata(sibling, { variantGroupId: '', variantName: '' });
      }
    }
  }, options);
}
