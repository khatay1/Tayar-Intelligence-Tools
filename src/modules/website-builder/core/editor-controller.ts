import {
  createEditorSession,
  executeEditorSessionCommand,
  markEditorSessionSaved,
  redoEditorSession,
  undoEditorSession,
  type EditorSessionOptions,
  type EditorSessionState,
} from './editor-session';
import type { EditorCommand } from './editor-command';
import {
  applyEditorNativePatch,
  type ApplyEditorNativePatchOptions,
  type ApplyEditorNativePatchResult,
} from './editor-native-patch';
import {
  createEditorLayoutState,
  type EditorLayoutState,
} from './editor-layout';
import {
  sanitizeEditorSelection,
  type EditorResolvedSelection,
  type EditorSelection,
} from './editor-selection';
import type { EditorProjectLike } from './editor-model';
import type { EditorNativeOperation } from './editor-native-operation';

export interface EditorControllerState<P extends EditorProjectLike> {
  session: EditorSessionState<P>;
  selection?: EditorResolvedSelection;
  layout: EditorLayoutState;
}

export interface EditorControllerMutationResult<P extends EditorProjectLike> {
  state: EditorControllerState<P>;
  changed: boolean;
  errors: string[];
  warnings: string[];
}

function withSanitizedSelection<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  selection: EditorSelection | undefined = state.selection,
): EditorControllerState<P> {
  return {
    ...state,
    selection: sanitizeEditorSelection(state.session.project, selection),
  };
}

export function createEditorControllerState<P extends EditorProjectLike>(
  project: P,
  options: {
    selection?: EditorSelection;
    layout?: EditorLayoutState;
  } = {},
): EditorControllerState<P> {
  const session = createEditorSession(project);
  return {
    session,
    selection: sanitizeEditorSelection(session.project, options.selection),
    layout: options.layout || createEditorLayoutState(),
  };
}

export function setEditorControllerSelection<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  selection: EditorSelection,
) {
  return withSanitizedSelection(state, selection);
}

export function setEditorControllerLayout<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  layout: EditorLayoutState,
): EditorControllerState<P> {
  return { ...state, layout };
}

export function executeEditorControllerCommand<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  command: EditorCommand<P>,
  options: EditorSessionOptions<P> = {},
): EditorControllerMutationResult<P> {
  const result = executeEditorSessionCommand(state.session, command, options);
  const next = withSanitizedSelection({ ...state, session: result.state });
  return {
    state: next,
    changed: result.changed,
    errors: result.transaction && !result.transaction.ok ? result.transaction.errors : [],
    warnings: result.transaction?.warnings || [],
  };
}

export function applyEditorControllerNativePatch<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  operations: EditorNativeOperation[],
  options: ApplyEditorNativePatchOptions<P> = {},
): EditorControllerMutationResult<P> & { patch: ApplyEditorNativePatchResult<P> } {
  const patch = applyEditorNativePatch(state.session, operations, options);
  const next = withSanitizedSelection({ ...state, session: patch.state });
  return {
    state: next,
    changed: patch.changed,
    errors: patch.errors,
    warnings: patch.warnings,
    patch,
  };
}

export function undoEditorController<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
): EditorControllerMutationResult<P> {
  const result = undoEditorSession(state.session);
  return {
    state: withSanitizedSelection({ ...state, session: result.state }),
    changed: result.changed,
    errors: [],
    warnings: [],
  };
}

export function redoEditorController<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
): EditorControllerMutationResult<P> {
  const result = redoEditorSession(state.session);
  return {
    state: withSanitizedSelection({ ...state, session: result.state }),
    changed: result.changed,
    errors: [],
    warnings: [],
  };
}

export function markEditorControllerSaved<P extends EditorProjectLike>(
  state: EditorControllerState<P>,
  savedAt = Date.now(),
): EditorControllerState<P> {
  return { ...state, session: markEditorSessionSaved(state.session, savedAt) };
}
