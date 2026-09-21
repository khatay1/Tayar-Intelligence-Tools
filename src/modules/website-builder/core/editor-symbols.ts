import { cloneEditorValue } from './editor-transaction';
import {
  findEditorSymbol,
  type EditorElementLike,
  type EditorProjectLike,
  type EditorSymbolLike,
} from './editor-model';

const INSTANCE_LOCAL_KEYS = new Set(['id', 'containerId', 'symbolId']);

export interface EditorSymbolMetadataChanges {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  variantGroupId?: string;
  variantName?: string;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeEditorSymbolTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    const tag = cleanText(raw, 32);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

export function applyEditorSymbolMetadata(
  symbol: EditorSymbolLike,
  changes: EditorSymbolMetadataChanges,
): EditorSymbolLike {
  const next = { ...symbol };
  if ('name' in changes) {
    const name = cleanText(changes.name, 80);
    if (!name) throw new Error('Component name is required');
    next.name = name;
  }
  if ('description' in changes) {
    const description = cleanText(changes.description, 240);
    if (description) next.description = description;
    else delete next.description;
  }
  if ('category' in changes) {
    const category = cleanText(changes.category, 48);
    if (category) next.category = category;
    else delete next.category;
  }
  if ('tags' in changes) {
    const tags = normalizeEditorSymbolTags(changes.tags);
    if (tags.length) next.tags = tags;
    else delete next.tags;
  }
  if ('variantGroupId' in changes) {
    const variantGroupId = cleanText(changes.variantGroupId, 120);
    if (variantGroupId) next.variantGroupId = variantGroupId;
    else delete next.variantGroupId;
  }
  if ('variantName' in changes) {
    const variantName = cleanText(changes.variantName, 64);
    if (variantName) next.variantName = variantName;
    else delete next.variantName;
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

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
  match.symbol.updatedAt = new Date().toISOString();

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
    updatedAt: new Date().toISOString(),
  };
}
