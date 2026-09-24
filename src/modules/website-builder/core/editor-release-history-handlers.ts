import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { deleteWebsitePublishVersionArchive } from '../services/publishVersionService';
import { buildProjectSnapshotDiffSummary } from './project-release-metrics';
import type { WebsitePublishVersion } from './website-builder-model';
import { createApplyProjectDataHandler } from './editor-apply-project-handler';

type ProjectSnapshot = Record<string, unknown>;

interface ReleaseHistoryContext {
  user: { id: string } | null;
  cloudProjectId: string | null;
  activeProjectOwnerId: string;
  projectTeamAccess: { canPublish: boolean };
  lastPublishedVersionId: string | null;
  lastPublishedFingerprint: string;
  publishedUrl: string;
  publishedAt: string | null;
  previewUrl: string;
  previewToken: string;
  previewCreatedAt: string | null;
  projectLoadSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  setPublishVersions: Dispatch<SetStateAction<WebsitePublishVersion[]>>;
  setPublishVersionsLoading: Dispatch<SetStateAction<boolean>>;
  setPublishVersionsError: Dispatch<SetStateAction<string>>;
  setReleaseHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setAutoSaveStatus: Dispatch<SetStateAction<'idle' | 'saving' | 'saved' | 'failed'>>;
  snapshotConflictsWithActiveProject: (snapshot: unknown, requireIdentity?: boolean) => boolean;
  buildProjectSnapshot: () => ProjectSnapshot;
  saveRecoverySnapshot: (reason: string) => void;
  prepareProjectStateRestore: () => void;
  applyProjectData: ReturnType<typeof createApplyProjectDataHandler>;
  l: (text: string) => string;
}

export function createReleaseHistoryHandlers({
  user, cloudProjectId, activeProjectOwnerId, projectTeamAccess,
  lastPublishedVersionId, lastPublishedFingerprint, publishedUrl, publishedAt,
  previewUrl, previewToken, previewCreatedAt, projectLoadSequenceRef, activeUserIdRef,
  setPublishVersions, setPublishVersionsLoading, setPublishVersionsError,
  setReleaseHistoryOpen, setAutoSaveStatus, snapshotConflictsWithActiveProject,
  buildProjectSnapshot, saveRecoverySnapshot, prepareProjectStateRestore, applyProjectData, l,
}: ReleaseHistoryContext) {
  function releaseDiffSummary(version: WebsitePublishVersion) {
    return buildProjectSnapshotDiffSummary(
      buildProjectSnapshot() as unknown as Record<string, unknown>,
      version.snapshot || {},
    );
  }

  function restorePublishVersionToEditor(version: WebsitePublishVersion) {
    if (snapshotConflictsWithActiveProject(version.snapshot)) {
      setPublishVersionsError('This release snapshot does not belong to the active project.');
      return;
    }

    if (!window.confirm(l('Restore this release into the editor? The live website will not change until you publish again.'))) return;
    const restored = {
      ...(version.snapshot || {}),
      publishedUrl,
      publishedAt,
      previewUrl,
      previewToken,
      previewCreatedAt,
      lastPublishedVersionId,
      lastPublishedFingerprint,
    };
    saveRecoverySnapshot('before restoring published release');
    prepareProjectStateRestore();
    applyProjectData(restored, false);
    setReleaseHistoryOpen(false);
    setAutoSaveStatus('saving');
  }

  async function deletePublishVersion(version: WebsitePublishVersion) {
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishVersionsError('Only the project owner can delete release archives.');
      return;
    }
    if (version.id === lastPublishedVersionId) {
      setPublishVersionsError('You cannot delete the release currently serving as the live rollback reference.');
      return;
    }
    if (!window.confirm(l('Delete this stored release archive? This cannot be undone.'))) return;

    const deleteLoadSequence = projectLoadSequenceRef.current;
    const deleteProjectId = cloudProjectId;
    const deleteOwnerId = activeProjectOwnerId;
    const deleteUserId = user.id;
    const deleteIsCurrent = () =>
      projectLoadSequenceRef.current === deleteLoadSequence &&
      activeUserIdRef.current === deleteUserId;

    setPublishVersionsLoading(true);
    setPublishVersionsError('');

    try {
      const manifest = Array.isArray(version.file_manifest) ? version.file_manifest : [];
      const { error, recordDeleted } = await deleteWebsitePublishVersionArchive({
        versionId: version.id,
        projectId: deleteProjectId,
        ownerId: deleteOwnerId,
        storagePrefix: version.storage_prefix,
        fileManifest: manifest,
      });

      if (!deleteIsCurrent()) return;
      if (recordDeleted) {
        setPublishVersions((current) => current.filter((item) => item.id !== version.id));
      }
      if (error) throw error;
    } catch (error) {
      if (!deleteIsCurrent()) return;
      setPublishVersionsError(error instanceof Error ? error.message : 'Could not delete this release.');
    } finally {
      if (deleteIsCurrent()) {
        setPublishVersionsLoading(false);
      }
    }
  }

  return { releaseDiffSummary, restorePublishVersionToEditor, deletePublishVersion };
}
