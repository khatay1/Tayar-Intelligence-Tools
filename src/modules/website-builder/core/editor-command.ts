import {
  applyEditorTransaction,
  cloneEditorValue,
  type EditorChangeSource,
  type EditorTransactionResult,
  type EditorValidationResult,
} from './editor-transaction';
import {
  pushEditorHistory,
  type EditorHistoryState,
} from './editor-history';

export interface EditorCommand<T> {
  id: string;
  label: string;
  source?: EditorChangeSource;
  coalesceKey?: string;
  coalesceWindowMs?: number;
  mutate: (draft: T) => void | T;
}

export interface RunEditorCommandOptions<T> {
  history: EditorHistoryState<T>;
  maxHistoryEntries?: number;
  validate?: (candidate: T, previous: T) => EditorValidationResult;
  now?: () => number;
  clone?: (value: T) => T;
}

export interface EditorCommandResult<T> {
  project: T;
  history: EditorHistoryState<T>;
  transaction: EditorTransactionResult<T>;
}

export function runEditorCommand<T>(
  current: T,
  command: EditorCommand<T>,
  options: RunEditorCommandOptions<T>,
): EditorCommandResult<T> {
  const now = options.now || Date.now;
  const clone = options.clone || cloneEditorValue;
  const source = command.source || 'manual';

  const transaction = applyEditorTransaction(current, command.mutate, {
    label: command.label,
    source,
    validate: options.validate,
    now,
    idFactory: () => command.id,
    clone,
  });

  if (!transaction.ok || !transaction.changed) {
    return {
      project: clone(current),
      history: options.history,
      transaction,
    };
  }

  const history = pushEditorHistory(options.history, transaction.before, {
    id: transaction.meta.id,
    label: command.coalesceKey || transaction.meta.label,
    source,
    createdAt: transaction.meta.finishedAt,
    maxEntries: options.maxHistoryEntries,
    coalesceKey: command.coalesceKey,
    coalesceWindowMs: command.coalesceWindowMs,
    clone,
  });

  return {
    project: clone(transaction.after),
    history,
    transaction,
  };
}

export function createEditorCommand<T>(
  input: Omit<EditorCommand<T>, 'id'> & { id?: string },
): EditorCommand<T> {
  return {
    ...input,
    id:
      input.id ||
      `editor-command-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
  };
}
