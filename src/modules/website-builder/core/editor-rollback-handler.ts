import type { Language } from '@/context/PreferencesContext';
import { buildPublishedSiteBaseUrl,buildPublishedSiteUrl,normalizePublishedSiteUrl } from '@/lib/published-site-url';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import type { EditorProjectAccess } from '../core/editor-project-access';
import { saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import { assertValidPublishVersionArchive } from '../core/publish-version-archive-validation';
import { isValidPublishedHtml } from '../core/published-site-validation';
import type { WebsiteBrand,WebsiteSEO } from '../core/types';
import type { CloudWebsiteProject,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsitePublishVersion,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { updateWebsiteProjectPublicationState } from '../services/projectCloudService';
import { downloadPublishedWebsiteFile,removeStalePublishedWebsiteFiles,restorePublishedWebsiteSnapshot,snapshotPublishedWebsiteFiles,uploadPublishedWebsiteBlob,verifyPublishedRoute } from '../services/publishedWebsiteService';

interface CreateRollbackPublishVersionHandlerDependencies {
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
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "saving" | "saved" | "failed">>;
  setCloudProjects: React.Dispatch<React.SetStateAction<CloudWebsiteProject[]>>;
  setLastPublishedFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setPublishedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string>>;
  setPublishError: React.Dispatch<React.SetStateAction<string>>;
  user: User | null;
  verifyLiveDeployment: (expectedProjectId?: string | null, expectedOwnerId?: string, expectedLoadSequence?: number) => Promise<boolean>;
}

export function createRollbackPublishVersionHandler({
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
  setPublishBusy,
  setPublishedAt,
  setPublishedUrl,
  setPublishError,
  user,
  verifyLiveDeployment,
}: CreateRollbackPublishVersionHandlerDependencies) {
  return async function rollbackPublishVersion(version: WebsitePublishVersion) {
    if (publishBusy || previewBusy || saveInFlightRef.current) return;
    if (!user || !cloudProjectId) return;
    if (!projectTeamAccess.canPublish) {
      setPublishError('Only the project owner can rollback a published release.');
      return;
    }
    if (!window.confirm(`${l('Rollback the live website to the release from')} ${new Date(version.created_at).toLocaleString()}? ${l('Your editor draft will stay unchanged.')}`)) return;

    const rollbackSequence = ++publishOperationSequenceRef.current;
    const rollbackLoadSequence = projectLoadSequenceRef.current;
    const rollbackProjectId = cloudProjectId;
    const rollbackUserId = user.id;
    const rollbackBaseProjectData = buildProjectData();
    const rollbackRevision = cloudRevisionRef.current?.projectId === rollbackProjectId ? cloudRevisionRef.current.updatedAt : null;
    const rollbackIsCurrent = () =>
      publishOperationSequenceRef.current === rollbackSequence &&
      projectLoadSequenceRef.current === rollbackLoadSequence &&
      activeUserIdRef.current === rollbackUserId;

    const assertRollbackIsCurrent = () => { if (!rollbackIsCurrent()) throw new Error('Rollback stopped because the active project changed.'); };
    let liveRollback: { folder: string; snapshot: Awaited<ReturnType<typeof snapshotPublishedWebsiteFiles>> } | null = null;
    let rollbackStarted = false;
    let committed = false;

    setPublishBusy(true);
    setPublishError('');

    try {
      if (!rollbackRevision) throw new Error('Reopen the cloud project before rolling back so its current version can be verified.');
      const folder = `${rollbackUserId}/${rollbackProjectId}`;
      const manifest = Array.isArray(version.file_manifest) ? version.file_manifest : [];
      if (version.project_id !== rollbackProjectId || version.user_id !== rollbackUserId) {
        throw new Error('This release belongs to another project.');
      }
      assertValidPublishVersionArchive({
        versionId: version.id,
        projectId: rollbackProjectId,
        ownerId: rollbackUserId,
        storagePrefix: version.storage_prefix,
        fileManifest: manifest,
      });

      const nextPublishedBaseUrl = buildPublishedSiteBaseUrl(rollbackUserId, rollbackProjectId);
      const nextPublishedUrl = buildPublishedSiteUrl(rollbackUserId, rollbackProjectId, 'index.html');
      if (!nextPublishedBaseUrl || !nextPublishedUrl) throw new Error('Could not build the live website URL.');

      const legacyVersionUrl = normalizePublishedSiteUrl(version.published_url || '');
      const legacyVersionBase = (version.published_url || '').replace(/\/index\.html(?:[?#].*)?$/i, '');
      const canonicalVersionBase = legacyVersionUrl.replace(/\/index\.html(?:[?#].*)?$/i, '');

      const archivedFiles: Array<{ name: string; body: Blob; contentType: string }> = [];
      for (const file of manifest) {
        assertRollbackIsCurrent();

        const { data: blob, error: downloadError } = await downloadPublishedWebsiteFile(`${version.storage_prefix}/${file.name}`);
        assertRollbackIsCurrent();
        if (downloadError || !blob) throw downloadError || new Error(`Could not restore ${file.name}`);

        let uploadBody: Blob = blob;
        const textual = /(?:text\/|application\/(?:json|xml))/i.test(file.contentType || blob.type || '') || /\.(?:html?|xml|txt|css|js|json)$/i.test(file.name);
        if (textual) {
          let text = await blob.text();
          assertRollbackIsCurrent();
          if (legacyVersionBase && legacyVersionBase !== canonicalVersionBase) {
            text = text.split(legacyVersionBase).join(nextPublishedBaseUrl);
          }
          if (canonicalVersionBase && canonicalVersionBase !== nextPublishedBaseUrl) {
            text = text.split(canonicalVersionBase).join(nextPublishedBaseUrl);
          }
          uploadBody = new Blob([text], { type: file.contentType || blob.type || 'text/plain; charset=utf-8' });
        }

        if (file.name === 'index.html') {
          if (!/^text\/html(?:;|$)/i.test(file.contentType.trim()) || !isValidPublishedHtml(await uploadBody.text())) {
            throw new Error('The archived index.html is not a valid published HTML page.');
          }
        }

        archivedFiles.push({ name: file.name, body: uploadBody, contentType: file.contentType || blob.type || 'application/octet-stream' });
      }

      assertRollbackIsCurrent();
      const snapshot = await snapshotPublishedWebsiteFiles(folder);
      assertRollbackIsCurrent();
      liveRollback = { folder, snapshot };
      rollbackStarted = true;
      const liveNames = new Set(archivedFiles.map(file => file.name));

      for (const file of archivedFiles) {

        assertRollbackIsCurrent();

        const { error: uploadError } = await uploadPublishedWebsiteBlob({
          path: `${folder}/${file.name}`,
          body: file.body,
          contentType: file.contentType,
          cacheControl: '0',
          upsert: true,
        });

        assertRollbackIsCurrent();
        if (uploadError) throw uploadError;
      }

      assertRollbackIsCurrent();
      const { data: liveIndex, error: liveIndexError } = await downloadPublishedWebsiteFile(`${folder}/index.html`);
      assertRollbackIsCurrent();
      if (liveIndexError || !liveIndex || !isValidPublishedHtml(await liveIndex.text())) {
        throw liveIndexError || new Error('The restored index.html could not be verified in live storage.');
      }
      assertRollbackIsCurrent();
      await removeStalePublishedWebsiteFiles(folder, liveNames);
      assertRollbackIsCurrent();

      // Verify the actual public route while the previous project state and
      // rollback snapshot are still available. A failed route restores storage.
      if (!(await verifyPublishedRoute(nextPublishedUrl))) {
        throw new Error('The restored website did not pass public route verification.');
      }
      assertRollbackIsCurrent();

      const nextPublishedAt = new Date().toISOString();
      const projectData = {
        ...rollbackBaseProjectData,
        publishedUrl: nextPublishedUrl,
        publishedAt: nextPublishedAt,
        lastPublishedVersionId: version.id,
        lastPublishedFingerprint: version.editor_fingerprint,
        updatedAt: nextPublishedAt,
      };

      assertRollbackIsCurrent();

      const { data: publishedRow, error: projectError } = await updateWebsiteProjectPublicationState({
        projectId: rollbackProjectId,
        expectedUpdatedAt: rollbackRevision,
        userId: rollbackUserId,
        content: projectData,
        published: true,
        updatedAt: nextPublishedAt,
      });

      if (projectError) throw projectError;
      committed = true;
      assertRollbackIsCurrent();
      cloudRevisionRef.current = { projectId: rollbackProjectId, updatedAt: publishedRow?.updated_at || nextPublishedAt };

      setCloudProjects((current) =>
        current.map((project) =>
          project.id === rollbackProjectId
            ? {
                ...project,
                content: projectData,
                status: 'completed',
                updated_at: publishedRow?.updated_at || nextPublishedAt,
              }
            : project
        )
      );
      setPublishedUrl(nextPublishedUrl);
      setPublishedAt(nextPublishedAt);
      setLastPublishedVersionId(version.id);
      setLastPublishedFingerprint(version.editor_fingerprint);
      saveLocalWebsiteProject(projectData);
      lastSavedSnapshotRef.current = '';
      setAutoSaveStatus('saved');

      await verifyLiveDeployment(
        rollbackProjectId,
        rollbackUserId,
        rollbackLoadSequence,
      );
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Could not rollback this release.';
      if (liveRollback && rollbackStarted && !committed) {
        try {
          await restorePublishedWebsiteSnapshot(liveRollback.folder, liveRollback.snapshot);
          message += ' The previous live website was restored automatically.';
        } catch { message += ' Automatic rollback needs support review.'; }
      }
      if (rollbackIsCurrent()) setPublishError(message);
    } finally {
      if (publishOperationSequenceRef.current === rollbackSequence) {
        setPublishBusy(false);
      }
    }
  };
}
