import {
  applyEditorTransaction,
  cloneEditorValue,
  type EditorTransactionResult,
  type EditorValidationResult,
} from './editor-transaction';
import {
  pushEditorHistory,
  type EditorHistoryState,
} from './editor-history';
import type { EditorCommand } from './editor-command';

export interface EditorBatchOptions<T> {
  history: EditorHistoryState<T>;
  label?: string;
  source?: 'manual' | 'ai' | 'system';
  maxCommands?: number;
  maxHistoryEntries?: number;
  validate?: (candidate: T, previous: T) => EditorValidationResult;
  clone?: (value: T) => T;
  now?: () => number;
  id?: string;
}

export interface EditorBatchResult<T> {
  project: T;
  history: EditorHistoryState<T>;
  transaction: EditorTransactionResult<T>;
  executedCommandIds: string[];
}

function boundedBatchSize(value: number | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 60;
  return Math.max(1, Math.min(200, Math.round(parsed)));
}

export function runEditorCommandBatch<T>(
  current: T,
  commands: EditorCommand<T>[],
  options: EditorBatchOptions<T>,
): EditorBatchResult<T> {
  const clone = options.clone || cloneEditorValue;
  const now = options.now || Date.now;
  const maxCommands = boundedBatchSize(options.maxCommands);
  const resolved = commands.slice(0, maxCommands);
  const source = options.source || resolved[0]?.source || 'ai';
  const label = options.label?.trim() || `Apply ${resolved.length} editor changes`;
  const executedCommandIds: string[] = [];

  const transaction = applyEditorTransaction(current, (draft) => {
    let working = draft;
    for (const command of resolved) {
      const returned = command.mutate(working);
      working = returned === undefined ? working : returned;
      executedCommandIds.push(command.id);
    }
    return working;
  }, {
    label,
    source,
    validate: options.validate,
    clone,
    now,
    idFactory: () => options.id || `editor-batch-${now().toString(36)}`,
  });

  if (!transaction.ok || !transaction.changed) {
    return {
      project: clone(current),
      history: options.history,
      transaction,
      executedCommandIds: transaction.ok ? executedCommandIds : [],
    };
  }

  const history = pushEditorHistory(options.history, transaction.before, {
    id: transaction.meta.id,
    label: transaction.meta.label,
    source,
    createdAt: transaction.meta.finishedAt,
    maxEntries: options.maxHistoryEntries,
    clone,
  });

  return {
    project: clone(transaction.after),
    history,
    transaction,
    executedCommandIds,
  };
}
