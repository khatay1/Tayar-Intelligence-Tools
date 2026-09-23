import type { Language } from '@/context/PreferencesContext';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import type { EditorProjectAccess } from '../core/editor-project-access';
import { saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import type { WebsiteBrand,WebsiteSEO } from '../core/types';
import type { CloudWebsiteProject,LiveVerification,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { updateWebsiteProjectPublicationState } from '../services/projectCloudService';
import { removePublishedWebsiteFiles,restorePublishedWebsiteSnapshot,snapshotPublishedWebsiteFiles } from '../services/publishedWebsiteService';

interface CreateUnpublishWebsiteHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  buildProjectData: (historyEntries?: ProjectHistoryEntry[]) => { history: ProjectHistoryEntry[]; version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  cloudProjectId: string | null;
  cloudRevisionRef: React.MutableRefObject<{ projectId: string; updatedAt: string | null; } | null>;
  l: (text: string) => string;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  previewBusy: boolean;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  projectTeamAccess: EditorProjectAccess;
  publishBusy: boolean;
  publishOperationSequenceRef: React.MutableRefObject<number>;
  saveInFlightRef: React.MutableRefObject<boolean>;
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "failed" | "saving" | "saved">>;
  setCloudProjects: React.Dispatch<React.SetStateAction<CloudWebsiteProject[]>>;
  setLastPublishedFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  setLiveVerification: React.Dispatch<React.SetStateAction<LiveVerification>>;
  setPublishBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setPublishedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string>>;
  setPublishError: React.Dispatch<React.SetStateAction<string>>;
  user: User | null;
}

export function createUnpublishWebsiteHandler({
  activeUserIdRef,
  buildProjectData,
  cloudProjectId,
  cloudRevisionRef,
  l,
  lastSavedSnapshotRef,
  previewBusy,
  projectLoadSequenceRef,
  projectTeamAccess,
  publishBusy,
  publishOperationSequenceRef,
  saveInFlightRef,
  setAutoSaveStatus,
  setCloudProjects,
  setLastPublishedFingerprint,
  setLastPublishedVersionId,
  setLiveVerification,
  setPublishBusy,
  setPublishedAt,
  setPublishedUrl,
  setPublishError,
  user,
}: CreateUnpublishWebsiteHandlerDependencies) {
  return async function unpublishWebsite() {
    if (publishBusy || previewBusy || saveInFlightRef.current) return;
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can unpublish a shared website.');
      return;
    }
    if (!window.confirm(l('Remove the public version of this website?'))) return;

    const unpublishSequence = ++publishOperationSequenceRef.current;
    const unpublishLoadSequence = projectLoadSequenceRef.current;
    const unpublishProjectId = cloudProjectId;
    const unpublishUserId = user.id;
    const unpublishBaseProjectData = buildProjectData();
    const unpublishRevision = cloudRevisionRef.current?.projectId === unpublishProjectId ? cloudRevisionRef.current.updatedAt : null;
    const unpublishIsCurrent = () =>
      publishOperationSequenceRef.current === unpublishSequence &&
      projectLoadSequenceRef.current === unpublishLoadSequence &&
      activeUserIdRef.current === unpublishUserId;
    const assertUnpublishIsCurrent = () => {
      if (!unpublishIsCurrent()) {
        throw new Error('Unpublishing stopped because the active project changed.');
      }
    };

    let liveRollback: {
      folder: string;
      snapshot: Awaited<ReturnType<typeof snapshotPublishedWebsiteFiles>>;
    } | null = null;
    let removalStarted = false;
    let publicationStateCommitted = false;

    setPublishBusy(true);
    setPublishError('');

    try {
      if (!unpublishRevision) throw new Error('Reopen the cloud project before unpublishing so its current version can be verified.');
      const folder = `${unpublishUserId}/${unpublishProjectId}`;
      const previousLiveSnapshot = await snapshotPublishedWebsiteFiles(folder);
      assertUnpublishIsCurrent();
      liveRollback = { folder, snapshot: previousLiveSnapshot };
      removalStarted = true;
      await removePublishedWebsiteFiles(folder);

      assertUnpublishIsCurrent();

      const nextUpdatedAt = new Date().toISOString();
      const projectData = {
        ...unpublishBaseProjectData,
        publishedUrl: '',
        publishedAt: null,
        lastPublishedVersionId: null,
        lastPublishedFingerprint: '',
        updatedAt: nextUpdatedAt,
      };

      assertUnpublishIsCurrent();

      const { data: publishedRow, error: projectError } = await updateWebsiteProjectPublicationState({
        projectId: unpublishProjectId,
        expectedUpdatedAt: unpublishRevision,
        userId: unpublishUserId,
        content: projectData,
        published: false,
        updatedAt: nextUpdatedAt,
      });

      if (projectError) throw projectError;
      if (unpublishIsCurrent()) cloudRevisionRef.current = { projectId: unpublishProjectId, updatedAt: publishedRow?.updated_at || nextUpdatedAt };
      publicationStateCommitted = true;
      liveRollback = null;
      assertUnpublishIsCurrent();

      setCloudProjects((current) =>
        current.map((project) =>
          project.id === unpublishProjectId
            ? {
                ...project,
                content: projectData,
                status: 'draft',
                updated_at: publishedRow?.updated_at || nextUpdatedAt,
              }
            : project
        )
      );

      setPublishedUrl('');
      setPublishedAt(null);
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setLiveVerification('idle');
      saveLocalWebsiteProject(projectData);
      lastSavedSnapshotRef.current = '';
      setAutoSaveStatus('saved');
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Could not unpublish this website.';

      if (liveRollback && removalStarted && !publicationStateCommitted) {
        try {
          await restorePublishedWebsiteSnapshot(liveRollback.folder, liveRollback.snapshot);
          message += ' The public website was restored automatically.';
        } catch (rollbackError) {
          message += ' Automatic rollback needs support review: ' +
            (rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error');
        }
      }

      if (!unpublishIsCurrent()) return;
      setPublishError(message);
    } finally {
      if (publishOperationSequenceRef.current === unpublishSequence) {
        setPublishBusy(false);
      }
    }
  };
}
