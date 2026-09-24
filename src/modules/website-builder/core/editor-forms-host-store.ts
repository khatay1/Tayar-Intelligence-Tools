import {
  normalizeEditorFormsProjectState,
  type EditorFormsProjectState,
} from './editor-forms-project-state';

let currentState: EditorFormsProjectState = normalizeEditorFormsProjectState(undefined);
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getEditorFormsHostState(): EditorFormsProjectState {
  return currentState;
}

export function setEditorFormsHostState(value: unknown): void {
  currentState = normalizeEditorFormsProjectState(value);
  emit();
}

export function patchEditorFormsHostState(patch: Partial<EditorFormsProjectState>): void {
  currentState = normalizeEditorFormsProjectState({ ...currentState, ...patch });
  emit();
}

export function hydrateEditorFormsHost(value: unknown): EditorFormsProjectState {
  currentState = normalizeEditorFormsProjectState(value);
  emit();
  return currentState;
}

export function subscribeEditorFormsHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
