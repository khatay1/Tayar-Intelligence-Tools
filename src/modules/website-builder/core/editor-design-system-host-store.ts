import {
  EMPTY_EDITOR_DESIGN_SYSTEM,
  normalizeEditorDesignSystem,
  type EditorDesignSystemState,
} from './editor-design-system';

let currentState: EditorDesignSystemState = EMPTY_EDITOR_DESIGN_SYSTEM;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getEditorDesignSystemHostState(): EditorDesignSystemState {
  return currentState;
}

export function setEditorDesignSystemHostState(value: unknown): void {
  currentState = normalizeEditorDesignSystem(value);
  emit();
}

export function patchEditorDesignSystemHostState(patch: Partial<EditorDesignSystemState>): void {
  currentState = normalizeEditorDesignSystem({ ...currentState, ...patch });
  emit();
}

export function hydrateEditorDesignSystemHost(value: unknown): EditorDesignSystemState {
  currentState = normalizeEditorDesignSystem(value);
  emit();
  return currentState;
}

export function subscribeEditorDesignSystemHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
