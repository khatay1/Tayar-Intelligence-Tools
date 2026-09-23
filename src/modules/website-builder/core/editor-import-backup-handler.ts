import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import { normalizeDeliveryConfig } from '../core/delivery-config';
import { saveActiveWebsiteProjectId,saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import type { ProjectHistoryEntry } from '../core/website-builder-model';

interface createImportProjectBackupHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  applyProjectData: (input: unknown, loadHistory?: boolean, resetEditHistory?: boolean) => void;
  cancelPendingProjectPersistence: () => void;
  l: (text: string) => string;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  newProjectIntentRef: React.MutableRefObject<boolean>;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  saveRecoverySnapshot: (reason: string) => void;
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "saving" | "saved" | "failed">>;
  setCloudProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setOperationsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  skipNextAutosaveRef: React.MutableRefObject<boolean>;
  user: User | null;
}

export function createImportProjectBackupHandler({
  activeUserIdRef,
  applyProjectData,
  cancelPendingProjectPersistence,
  l,
  lastSavedSnapshotRef,
  newProjectIntentRef,
  projectLoadSequenceRef,
  saveRecoverySnapshot,
  setAutoSaveStatus,
  setCloudProjectId,
  setOperationsOpen,
  setProjectHistory,
  skipNextAutosaveRef,
  user,
}: createImportProjectBackupHandlerDependencies) {
  return function importProjectBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const importLoadSequence = projectLoadSequenceRef.current;
      const importUserId = user?.id ?? null;
      const importIsCurrent = () =>
        projectLoadSequenceRef.current === importLoadSequence &&
        activeUserIdRef.current === importUserId;

      let raw = '';
      try {
        raw = await file.text();
      } catch {
        if (importIsCurrent()) {
          window.alert(l('This JSON file could not be read.'));
        }
        return;
      }

      if (!importIsCurrent()) return;

      try {
        const parsed = JSON.parse(raw);
        const project = parsed?.project ?? parsed;
        if (!project || (!Array.isArray(project.pages) && !Array.isArray(project.sections))) throw new Error('Invalid project backup');
        const importedProject = {
          ...project,
          cloudProjectId: null,
          publishedUrl: '',
          publishedAt: null,
          previewUrl: '',
          previewToken: '',
          previewCreatedAt: null,
          previewFingerprint: '',
          lastPublishedVersionId: null,
          lastPublishedFingerprint: '',
          deliveryConfig: {
            ...normalizeDeliveryConfig(project.deliveryConfig),
            status: 'building',
            approvedAt: null,
            approvedFingerprint: '',
            deliveredAt: null,
          },
          history: [],
          updatedAt: new Date().toISOString(),
        };

        if (!importIsCurrent()) return;

        saveRecoverySnapshot('before importing backup');
        cancelPendingProjectPersistence();
        projectLoadSequenceRef.current += 1;
        skipNextAutosaveRef.current = true;
        applyProjectData(importedProject);
        newProjectIntentRef.current = true;
        setCloudProjectId(null);
        saveActiveWebsiteProjectId(null);
        setProjectHistory(Array.isArray(importedProject.history) ? importedProject.history.slice(0, 30) : []);
        saveLocalWebsiteProject(importedProject);
        lastSavedSnapshotRef.current = '';
        setAutoSaveStatus('saved');
        setOperationsOpen(false);
      } catch {
        window.alert(l('This JSON file is not a valid Tayar Website Builder backup.'));
      }
    };
    input.click();
  };
}
