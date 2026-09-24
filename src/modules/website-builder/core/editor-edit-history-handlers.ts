import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { WebsiteSection } from './types';
import type { ProjectHistoryEntry, WebsitePage } from './website-builder-model';
import { createApplyProjectDataHandler } from './editor-apply-project-handler';

interface EditHistoryContext {
  activePageId: string;
  history: ProjectHistoryEntry[];
  future: ProjectHistoryEntry[];
  buildProjectSnapshot: () => { pages: WebsitePage[] } & Record<string, unknown>;
  setHistory: Dispatch<SetStateAction<ProjectHistoryEntry[]>>;
  setFuture: Dispatch<SetStateAction<ProjectHistoryEntry[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  skipNextAutosaveRef: MutableRefObject<boolean>;
  snapshotConflictsWithActiveProject: (snapshot: unknown, requireIdentity?: boolean) => boolean;
  prepareProjectStateRestore: () => void;
  applyProjectData: ReturnType<typeof createApplyProjectDataHandler>;
  saveRecoverySnapshot: (reason: string) => void;
  l: (text: string) => string;
  setCloudError: Dispatch<SetStateAction<string>>;
  setHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setAutoSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved' | 'failed'>>;
}

export function createEditHistoryHandlers({
  activePageId, history, future, buildProjectSnapshot, setHistory, setFuture,
  setSaved, skipNextAutosaveRef, snapshotConflictsWithActiveProject,
  prepareProjectStateRestore, applyProjectData, saveRecoverySnapshot, l,
  setCloudError, setHistoryOpen, setAutoSaveStatus,
}: EditHistoryContext) {
  function createEditHistoryEntry(label: string, currentSections?: WebsiteSection[]): ProjectHistoryEntry {
    const savedAt = new Date().toISOString();
    const snapshot = buildProjectSnapshot();
    if (currentSections) {
      const preservedSections = JSON.parse(JSON.stringify(currentSections)) as WebsiteSection[];
      snapshot.pages = snapshot.pages.map((page) => page.id === activePageId
        ? { ...page, sections: preservedSections }
        : page);
    }
    return {
      id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt,
      label,
      snapshot,
    };
  }

  function remember(current: WebsiteSection[], label = 'Manual edit') {
    // Event handlers can outlive a memoized project snapshot by one render. Preserve
    // the exact sections supplied by the mutation so Undo always restores its input.
    const entry = createEditHistoryEntry(label, current);
    setHistory((current) => [...current.slice(-49), entry]);
    setFuture([]);
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    if (snapshotConflictsWithActiveProject(previous.snapshot)) return;

    const redoEntry = createEditHistoryEntry(previous.label);
    prepareProjectStateRestore();
    setHistory((current) => current.slice(0, -1));
    setFuture((current) => [redoEntry, ...current].slice(0, 50));
    skipNextAutosaveRef.current = true;
    applyProjectData(previous.snapshot, false, false);
    setSaved(false);
  }

  function redo() {
    if (!future.length) return;
    const next = future[0];
    if (snapshotConflictsWithActiveProject(next.snapshot)) return;

    const undoEntry = createEditHistoryEntry(next.label);
    prepareProjectStateRestore();
    setFuture((current) => current.slice(1));
    setHistory((current) => [...current.slice(-49), undoEntry]);
    skipNextAutosaveRef.current = true;
    applyProjectData(next.snapshot, false, false);
    setSaved(false);
  }

  function restoreEditHistoryEntry(entryId: string) {
    const targetIndex = history.findIndex((entry) => entry.id === entryId);
    if (targetIndex < 0) return;

    const target = history[targetIndex];
    if (snapshotConflictsWithActiveProject(target.snapshot)) return;
    if (!window.confirm(l('Restore this history state? Your current unsaved changes will move to the Redo queue.'))) return;

    saveRecoverySnapshot('before restoring edit history entry');
    const currentEntry = createEditHistoryEntry('Current state before history restore');
    prepareProjectStateRestore();
    const redoPath = [
      ...history.slice(targetIndex + 1),
      currentEntry,
      ...future,
    ].slice(0, 50);

    setHistory(history.slice(0, targetIndex));
    setFuture(redoPath);
    skipNextAutosaveRef.current = true;
    applyProjectData(target.snapshot, false, false);
    setSaved(false);
  }

  function restoreHistoryEntry(entry: ProjectHistoryEntry) {
    const confirmed = window.confirm(`${l('Restore')} "${entry.label}"? ${l('Your current unsaved changes will be replaced.')}`);
    if (!confirmed) return;

    if (snapshotConflictsWithActiveProject(entry.snapshot)) {
      setCloudError('This history snapshot does not belong to the active project.');
      return;
    }

    saveRecoverySnapshot('before restoring history entry');

    const undoEntry = createEditHistoryEntry(`Before restoring ${entry.label}`);
    prepareProjectStateRestore();
    setHistory((current) => [...current.slice(-49), undoEntry]);
    setFuture([]);

    applyProjectData(entry.snapshot, false, false);
    setHistoryOpen(false);
    setSaved(false);
    setAutoSaveStatus('saving');
  }

  return { createEditHistoryEntry, remember, undo, redo, restoreEditHistoryEntry, restoreHistoryEntry };
}
