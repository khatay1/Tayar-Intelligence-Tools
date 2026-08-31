import {
  createEditorCommand,
  runEditorCommand,
  type EditorCommand,
} from './editor-command';
import {
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
  type EditorHistoryState,
} from './editor-history';
import { runEditorCommandBatch } from './editor-batch';
import {
  cloneEditorValue,
  type EditorTransactionResult,
  type EditorValidationResult,
} from './editor-transaction';

export interface EditorSessionState<T> {
  project: T;
  savedProject: T;
  history: EditorHistoryState<T>;
  revision: number;
  savedRevision: number;
  lastSavedAt?: number;
  lastTransaction?: EditorTransactionResult<T>;
}

export interface EditorSessionOptions<T> {
  validate?: (candidate: T, previous: T) => EditorValidationResult;
  maxHistoryEntries?: number;
  clone?: (value: T) => T;
  now?: () => number;
}

export interface EditorSessionMutationResult<T> {
  state: EditorSessionState<T>;
  changed: boolean;
  transaction?: EditorTransactionResult<T>;
}

function editorValuesEqual<T>(left: T, right: T) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function createEditorSession<T>(
  project: T,
  clone: (value: T) => T = cloneEditorValue,
): EditorSessionState<T> {
  const initial = clone(project);
  return {
    project: initial,
    savedProject: clone(initial),
    history: createEditorHistory<T>(),
    revision: 0,
    savedRevision: 0,
  };
}

export function isEditorSessionDirty<T>(state: EditorSessionState<T>) {
  return !editorValuesEqual(state.project, state.savedProject);
}

export function executeEditorSessionCommand<T>(
  state: EditorSessionState<T>,
  command: EditorCommand<T> | (Omit<EditorCommand<T>, 'id'> & { id?: string }),
  options: EditorSessionOptions<T> = {},
): EditorSessionMutationResult<T> {
  const clone = options.clone || cloneEditorValue;
  const resolvedCommand = command.id ? command as EditorCommand<T> : createEditorCommand(command);
  const result = runEditorCommand(state.project, resolvedCommand, {
    history: state.history,
    maxHistoryEntries: options.maxHistoryEntries,
    validate: options.validate,
    clone,
    now: options.now,
  });

  const changed = Boolean(result.transaction.ok && result.transaction.changed);
  if (!changed) {
    return {
      changed: false,
      transaction: result.transaction,
      state: {
        ...state,
        project: clone(state.project),
        lastTransaction: result.transaction,
      },
    };
  }

  return {
    changed: true,
    transaction: result.transaction,
    state: {
      ...state,
      project: clone(result.project),
      history: result.history,
      revision: state.revision + 1,
      lastTransaction: result.transaction,
    },
  };
}

export function executeEditorSessionBatch<T>(
  state: EditorSessionState<T>,
  commands: EditorCommand<T>[],
  options: EditorSessionOptions<T> & {
    label?: string;
    source?: 'manual' | 'ai' | 'system';
    maxCommands?: number;
    id?: string;
  } = {},
): EditorSessionMutationResult<T> {
  const clone = options.clone || cloneEditorValue;
  const result = runEditorCommandBatch(state.project, commands, {
    history: state.history,
    label: options.label,
    source: options.source,
    maxCommands: options.maxCommands,
    maxHistoryEntries: options.maxHistoryEntries,
    validate: options.validate,
    clone,
    now: options.now,
    id: options.id,
  });

  const changed = Boolean(result.transaction.ok && result.transaction.changed);
  if (!changed) {
    return {
      changed: false,
      transaction: result.transaction,
      state: {
        ...state,
        project: clone(state.project),
        lastTransaction: result.transaction,
      },
    };
  }

  return {
    changed: true,
    transaction: result.transaction,
    state: {
      ...state,
      project: clone(result.project),
      history: result.history,
      revision: state.revision + 1,
      lastTransaction: result.transaction,
    },
  };
}

export function undoEditorSession<T>(
  state: EditorSessionState<T>,
  options: Pick<EditorSessionOptions<T>, 'clone' | 'now'> = {},
): EditorSessionMutationResult<T> {
  const clone = options.clone || cloneEditorValue;
  const navigation = undoEditorHistory(
    state.project,
    state.history,
    (options.now || Date.now)(),
    clone,
  );

  if (!navigation.changed) {
    return { changed: false, state };
  }

  return {
    changed: true,
    state: {
      ...state,
      project: clone(navigation.value),
      history: navigation.history,
      revision: state.revision + 1,
      lastTransaction: undefined,
    },
  };
}

export function redoEditorSession<T>(
  state: EditorSessionState<T>,
  options: Pick<EditorSessionOptions<T>, 'clone' | 'now'> = {},
): EditorSessionMutationResult<T> {
  const clone = options.clone || cloneEditorValue;
  const navigation = redoEditorHistory(
    state.project,
    state.history,
    (options.now || Date.now)(),
    clone,
  );

  if (!navigation.changed) {
    return { changed: false, state };
  }

  return {
    changed: true,
    state: {
      ...state,
      project: clone(navigation.value),
      history: navigation.history,
      revision: state.revision + 1,
      lastTransaction: undefined,
    },
  };
}

export function markEditorSessionSaved<T>(
  state: EditorSessionState<T>,
  savedAt = Date.now(),
): EditorSessionState<T> {
  return {
    ...state,
    savedProject: cloneEditorValue(state.project),
    savedRevision: state.revision,
    lastSavedAt: savedAt,
  };
}

export function replaceEditorSessionProject<T>(
  state: EditorSessionState<T>,
  project: T,
  options: {
    resetHistory?: boolean;
    markSaved?: boolean;
    clone?: (value: T) => T;
    savedAt?: number;
  } = {},
): EditorSessionState<T> {
  const clone = options.clone || cloneEditorValue;
  const nextRevision = state.revision + 1;
  const nextProject = clone(project);
  return {
    ...state,
    project: nextProject,
    savedProject: options.markSaved ? clone(nextProject) : clone(state.savedProject),
    history: options.resetHistory === false ? state.history : createEditorHistory<T>(),
    revision: nextRevision,
    savedRevision: options.markSaved ? nextRevision : state.savedRevision,
    lastSavedAt: options.markSaved ? (options.savedAt || Date.now()) : state.lastSavedAt,
    lastTransaction: undefined,
  };
}
