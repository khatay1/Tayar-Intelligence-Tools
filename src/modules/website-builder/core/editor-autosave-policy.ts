export type EditorAutosaveDecision =
  | 'blocked'
  | 'initialize'
  | 'skip-once'
  | 'unchanged'
  | 'schedule';

export interface EditorAutosaveDecisionInput {
  fingerprint: string;
  lastSavedFingerprint: string;
  skipNext: boolean;
  signedIn: boolean;
  cloudProjectsLoaded: boolean;
  requestedProjectId?: string | null;
  activeProjectId?: string | null;
}

export function decideEditorAutosave({
  fingerprint,
  lastSavedFingerprint,
  skipNext,
  signedIn,
  cloudProjectsLoaded,
  requestedProjectId,
  activeProjectId,
}: EditorAutosaveDecisionInput): EditorAutosaveDecision {
  if (signedIn && !cloudProjectsLoaded) return 'blocked';
  if (requestedProjectId && activeProjectId !== requestedProjectId) return 'blocked';
  if (!lastSavedFingerprint) return 'initialize';
  if (skipNext) return 'skip-once';
  if (fingerprint === lastSavedFingerprint) return 'unchanged';
  return 'schedule';
}

export interface ProjectHistoryEntryLike<TSnapshot> {
  id: string;
  savedAt: string;
  label: string;
  snapshot: TSnapshot;
}

export function createProjectHistoryEntry<TSnapshot extends { updatedAt: string }>(
  snapshot: TSnapshot,
  now = Date.now(),
): ProjectHistoryEntryLike<TSnapshot> {
  return {
    id: `history-${now}-${Math.random().toString(36).slice(2, 6)}`,
    savedAt: snapshot.updatedAt,
    label: `Saved ${new Date(snapshot.updatedAt).toLocaleString()}`,
    snapshot,
  };
}
