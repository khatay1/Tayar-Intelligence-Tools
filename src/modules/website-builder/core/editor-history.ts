import { cloneEditorValue, type EditorChangeSource } from './editor-transaction';

export interface EditorHistoryEntry<T> {
  id: string;
  label: string;
  source: EditorChangeSource;
  createdAt: number;
  snapshot: T;
}

export interface EditorHistoryState<T> {
  past: EditorHistoryEntry<T>[];
  future: EditorHistoryEntry<T>[];
}

export interface PushHistoryOptions<T> {
  id: string;
  label: string;
  source: EditorChangeSource;
  createdAt: number;
  maxEntries?: number;
  coalesceKey?: string;
  coalesceWindowMs?: number;
  clone?: (value: T) => T;
}

export interface HistoryNavigationResult<T> {
  changed: boolean;
  value: T;
  history: EditorHistoryState<T>;
  entry?: EditorHistoryEntry<T>;
}

export function createEditorHistory<T>(): EditorHistoryState<T> {
  return { past: [], future: [] };
}

function boundedLimit(value: number | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.round(parsed)));
}

function historyEntry<T>(
  snapshot: T,
  options: PushHistoryOptions<T>,
): EditorHistoryEntry<T> {
  const clone = options.clone || cloneEditorValue;
  return {
    id: options.id,
    label: options.label.trim() || 'Editor change',
    source: options.source,
    createdAt: options.createdAt,
    snapshot: clone(snapshot),
  };
}

export function pushEditorHistory<T>(
  history: EditorHistoryState<T>,
  snapshotBeforeChange: T,
  options: PushHistoryOptions<T>,
): EditorHistoryState<T> {
  const maxEntries = boundedLimit(options.maxEntries);
  const clone = options.clone || cloneEditorValue;
  const nextEntry = historyEntry(snapshotBeforeChange, options);
  const nextPast = history.past.slice();

  const last = nextPast[nextPast.length - 1];
  const coalesceWindow = Math.max(0, options.coalesceWindowMs || 0);
  const shouldCoalesce = Boolean(
    options.coalesceKey &&
      last &&
      last.source === options.source &&
      last.label === options.coalesceKey &&
      options.createdAt - last.createdAt <= coalesceWindow,
  );

  if (shouldCoalesce) {
    nextPast[nextPast.length - 1] = {
      ...last,
      id: options.id,
      createdAt: options.createdAt,
    };
  } else {
    nextPast.push(nextEntry);
  }

  return {
    past: nextPast.slice(-maxEntries).map((entry) => ({
      ...entry,
      snapshot: clone(entry.snapshot),
    })),
    future: [],
  };
}

export function undoEditorHistory<T>(
  current: T,
  history: EditorHistoryState<T>,
  now = Date.now(),
  clone: (value: T) => T = cloneEditorValue,
): HistoryNavigationResult<T> {
  if (!history.past.length) {
    return { changed: false, value: clone(current), history };
  }

  const target = history.past[history.past.length - 1];
  const currentEntry: EditorHistoryEntry<T> = {
    id: `redo-${target.id}`,
    label: target.label,
    source: target.source,
    createdAt: now,
    snapshot: clone(current),
  };

  return {
    changed: true,
    value: clone(target.snapshot),
    entry: target,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, currentEntry],
    },
  };
}

export function redoEditorHistory<T>(
  current: T,
  history: EditorHistoryState<T>,
  now = Date.now(),
  clone: (value: T) => T = cloneEditorValue,
): HistoryNavigationResult<T> {
  if (!history.future.length) {
    return { changed: false, value: clone(current), history };
  }

  const target = history.future[history.future.length - 1];
  const currentEntry: EditorHistoryEntry<T> = {
    id: `undo-${target.id}`,
    label: target.label,
    source: target.source,
    createdAt: now,
    snapshot: clone(current),
  };

  return {
    changed: true,
    value: clone(target.snapshot),
    entry: target,
    history: {
      past: [...history.past, currentEntry],
      future: history.future.slice(0, -1),
    },
  };
}

export function clearEditorHistory<T>(): EditorHistoryState<T> {
  return createEditorHistory<T>();
}
