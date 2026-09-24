import {
  EMPTY_EDITOR_COLLABORATION_PROJECT_STATE,
  normalizeEditorCollaborationProjectState,
  type EditorCollaborationProjectState,
} from './editor-collaboration-project-state';

let currentState: EditorCollaborationProjectState = EMPTY_EDITOR_COLLABORATION_PROJECT_STATE;
const listeners = new Set<() => void>();

function emit(): void { for (const listener of listeners) listener(); }
export function getEditorCollaborationHostState(): EditorCollaborationProjectState { return currentState; }
export function setEditorCollaborationHostState(value: unknown): void { currentState = normalizeEditorCollaborationProjectState(value); emit(); }
export function patchEditorCollaborationHostState(patch: Partial<EditorCollaborationProjectState>): void { currentState = normalizeEditorCollaborationProjectState({ ...currentState, ...patch }); emit(); }
export function hydrateEditorCollaborationHost(value: unknown): EditorCollaborationProjectState { currentState = normalizeEditorCollaborationProjectState(value); emit(); return currentState; }
export function subscribeEditorCollaborationHost(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }
