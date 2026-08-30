import type { EditorHistoryEntry, EditorHistoryState } from './editor-history';

export interface EditorHistoryViewEntry {
  id: string;
  label: string;
  source: EditorHistoryEntry<unknown>['source'];
  createdAt: number;
  direction: 'undo' | 'redo';
}

export interface EditorHistoryView {
  undo: EditorHistoryViewEntry[];
  redo: EditorHistoryViewEntry[];
  latest?: EditorHistoryViewEntry;
  total: number;
}

function metadata<T>(entry: EditorHistoryEntry<T>, direction: 'undo' | 'redo'): EditorHistoryViewEntry {
  return {
    id: entry.id,
    label: entry.label,
    source: entry.source,
    createdAt: entry.createdAt,
    direction,
  };
}

export function buildEditorHistoryView<T>(history: EditorHistoryState<T>, maxEntries = 30): EditorHistoryView {
  const limit = Math.max(1, Math.min(100, Math.round(Number(maxEntries) || 30)));
  const undo = history.past.slice(-limit).reverse().map((entry) => metadata(entry, 'undo'));
  const redo = history.future.slice(-limit).reverse().map((entry) => metadata(entry, 'redo'));
  return {
    undo,
    redo,
    latest: undo[0],
    total: history.past.length + history.future.length,
  };
}
