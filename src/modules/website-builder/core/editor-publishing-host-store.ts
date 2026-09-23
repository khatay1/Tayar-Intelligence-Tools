import type { EditorPublishEnvironment, EditorPublishMode } from './editor-publishing';

export interface EditorPublishingHostState {
  environment: EditorPublishEnvironment;
  mode: EditorPublishMode;
  pageIds: string[];
  scheduledAt: string;
  releaseNote: string;
}

const EMPTY_PUBLISHING_STATE: EditorPublishingHostState = {
  environment: 'production',
  mode: 'full',
  pageIds: [],
  scheduledAt: '',
  releaseNote: '',
};

let currentState: EditorPublishingHostState = EMPTY_PUBLISHING_STATE;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function normalize(value: unknown): EditorPublishingHostState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_PUBLISHING_STATE;
  const input = value as Partial<EditorPublishingHostState>;
  return {
    environment: input.environment === 'staging' ? 'staging' : 'production',
    mode: input.mode === 'selective' ? 'selective' : 'full',
    pageIds: Array.from(new Set(Array.isArray(input.pageIds) ? input.pageIds.filter((id): id is string => typeof id === 'string' && Boolean(id)) : [])),
    scheduledAt: typeof input.scheduledAt === 'string' ? input.scheduledAt : '',
    releaseNote: typeof input.releaseNote === 'string' ? input.releaseNote.slice(0, 500) : '',
  };
}

export function getEditorPublishingHostState(): EditorPublishingHostState {
  return currentState;
}

export function setEditorPublishingHostState(next: EditorPublishingHostState): void {
  currentState = normalize(next);
  emit();
}

export function patchEditorPublishingHostState(patch: Partial<EditorPublishingHostState>): void {
  currentState = normalize({ ...currentState, ...patch });
  emit();
}

export function subscribeEditorPublishingHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateEditorPublishingHost(value: unknown): EditorPublishingHostState {
  currentState = normalize(value);
  emit();
  return currentState;
}
