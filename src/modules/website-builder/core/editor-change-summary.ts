import { createEditorProjectIndex } from './editor-index';
import type { EditorProjectLike } from './editor-model';

export interface EditorEntityChangeCount {
  added: number;
  removed: number;
  changed: number;
}

export interface EditorChangeSummary {
  pages: EditorEntityChangeCount;
  sections: EditorEntityChangeCount;
  elements: EditorEntityChangeCount;
  symbols: EditorEntityChangeCount;
  totalChanges: number;
  labels: string[];
}

function stable(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeMap<T>(
  before: Map<string, T>,
  after: Map<string, T>,
  value: (item: T) => unknown,
): EditorEntityChangeCount {
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const [id, item] of after) {
    if (!before.has(id)) added += 1;
    else if (stable(value(before.get(id)!)) !== stable(value(item))) changed += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) removed += 1;
  return { added, removed, changed };
}

function label(kind: string, count: EditorEntityChangeCount) {
  const parts: string[] = [];
  if (count.added) parts.push(`${count.added} added`);
  if (count.removed) parts.push(`${count.removed} removed`);
  if (count.changed) parts.push(`${count.changed} updated`);
  return parts.length ? `${kind}: ${parts.join(', ')}` : undefined;
}

export function summarizeEditorProjectChanges<P extends EditorProjectLike>(
  before: P,
  after: P,
): EditorChangeSummary {
  const beforeIndex = createEditorProjectIndex(before);
  const afterIndex = createEditorProjectIndex(after);

  const pages = summarizeMap(beforeIndex.pages, afterIndex.pages, (entry) => entry.page);
  const sections = summarizeMap(beforeIndex.sections, afterIndex.sections, (entry) => entry.section);
  const elements = summarizeMap(beforeIndex.elements, afterIndex.elements, (entry) => entry.element);
  const symbols = summarizeMap(beforeIndex.symbols, afterIndex.symbols, (entry) => entry.symbol);
  const all = [pages, sections, elements, symbols];
  const totalChanges = all.reduce(
    (sum, current) => sum + current.added + current.removed + current.changed,
    0,
  );
  const labels = [
    label('Pages', pages),
    label('Sections', sections),
    label('Elements', elements),
    label('Components', symbols),
  ].filter((value): value is string => Boolean(value));

  return { pages, sections, elements, symbols, totalChanges, labels };
}
