import type { Language } from '@/context/PreferencesContext';
import { buildPublishedSiteBaseUrl,buildPublishedSiteUrl } from '@/lib/published-site-url';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import type { EditorProjectAccess } from '../core/editor-project-access';
import { DEFAULT_EDITOR_PROJECT_ACCESS } from '../core/editor-project-access';
import { saveActiveWebsiteProjectId,saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import type { WebsiteBrand,WebsiteSection,WebsiteSEO } from '../core/types';
import { sanitizeRobotsRules } from '../core/website-builder-config';
import type { CloudWebsiteProject,LiveVerification,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { escapeHtml } from '../core/website-builder-rendering';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { websitePathUrl } from '../core/website-localization';
import { createWebsiteProjectInCloud,updateWebsiteProjectPublicationState } from '../services/projectCloudService';
import { archivePublishedWebsiteFiles,readPublishedWebsiteFolderFiles,replacePublishedWebsiteFiles,restorePublishedWebsiteSnapshot,snapshotPublishedWebsiteFiles,verifyPublishedRoute } from '../services/publishedWebsiteService';
import { createWebsitePublishVersion,discardWebsitePublishVersionArchive } from '../services/publishVersionService';
import type { WebsiteCustomDomain } from '../services/websiteDomainService';
import type { WebsiteFormRow } from '../services/websiteFormService';
import { restorePublishedWebsiteForms,snapshotPublishedWebsiteForms,syncPublishedWebsiteForms } from '../services/websiteFormService';

interface PublishWebsiteHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  billingEntitlements: import("./website-builder-model").BillingEntitlements;
  buildEditableFingerprint: () => string;
  buildProjectData: (historyEntries?: ProjectHistoryEntry[]) => { history: ProjectHistoryEntry[]; version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  cloudProjectId: string | null;
  cloudRevisionRef: React.MutableRefObject<{ projectId: string; updatedAt: string | null; } | null>;
  customDomain: WebsiteCustomDomain | null;
  get404Html: (productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  getHtml: (pageSections?: WebsiteSection[], pageId?: string, productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  getOutputFilename: (page: WebsitePage) => string;
  getOutputPages: () => { outputPath: string; language: Language; id: string; name: string; slug: string; sections: WebsiteSection[]; showInNavigation: boolean; seoTitle?: string; seoDescription?: string; socialImage?: string; canonicalUrl?: string; translationKey?: string; noIndex?: boolean; cmsTemplate?: { collectionId: string; viewId?: string; routePattern?: string; }; }[];
  l: (text: string) => string;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  openBillingWithMessage: (message?: string) => void;
  previewBusy: boolean;
  previewFingerprint: string;
  previewToken: string;
  productionConfig: WebsiteProductionConfig;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  publishBusy: boolean;
  publishOperationalBlocker: () => string;
  publishOperationSequenceRef: React.MutableRefObject<number>;
  refreshPublishVersions: (expectedProjectId?: string | null, expectedOwnerId?: string, expectedLoadSequence?: number) => Promise<void>;
  releaseNote: string;
  saveProject: (options?: { automatic?: boolean; createHistory?: boolean; forPublication?: boolean; }) => Promise<boolean>;
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "failed" | "saving" | "saved">>;
  setCloudProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setCloudProjects: React.Dispatch<React.SetStateAction<CloudWebsiteProject[]>>;
  setCloudSyncFailed: React.Dispatch<React.SetStateAction<boolean>>;
  setLastPublishedFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  setLiveVerification: React.Dispatch<React.SetStateAction<LiveVerification>>;
  setProjectTeamAccess: React.Dispatch<React.SetStateAction<EditorProjectAccess>>;
  setPublishBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setPublishedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string>>;
  setPublishError: React.Dispatch<React.SetStateAction<string>>;
  setPublishVersionsError: React.Dispatch<React.SetStateAction<string>>;
  setReleaseNote: React.Dispatch<React.SetStateAction<string>>;
  siteName: string;
  user: User | null;
}

export function createPublishWebsiteHandler({
  activeUserIdRef,
  billingEntitlements,
  buildEditableFingerprint,
  buildProjectData,
  cloudProjectId,
  cloudRevisionRef,
  customDomain,
  get404Html,
  getHtml,
  getOutputFilename,
  getOutputPages,
  l,
  lastSavedSnapshotRef,
  openBillingWithMessage,
  previewBusy,
  previewFingerprint,
  previewToken,
  productionConfig,
  projectLoadSequenceRef,
  publishBusy,
  publishOperationalBlocker,
  publishOperationSequenceRef,
  refreshPublishVersions,
  releaseNote,
  saveProject,
  setAutoSaveStatus,
  setCloudProjectId,
  setCloudProjects,
  setCloudSyncFailed,
  setLastPublishedFingerprint,
  setLastPublishedVersionId,
  setLiveVerification,
  setProjectTeamAccess,
  setPublishBusy,
  setPublishedAt,
  setPublishedUrl,
  setPublishError,
  setPublishVersionsError,
  setReleaseNote,
  siteName,
  user,
}: PublishWebsiteHandlerDependencies) {
  return async function publishWebsite(fromStaging = false) {
    if (publishBusy || previewBusy) return;
    if (fromStaging && (!cloudProjectId || !previewToken || !previewFingerprint)) {
      setPublishError('Regenerate staging before promoting it to production.');
      return;
    }
    if (fromStaging && previewFingerprint !== buildEditableFingerprint()) {
      setPublishError('Staging is behind the current editor. Regenerate it before promotion if these changes should go live.');
      return;
    }
    const operationalBlocker = publishOperationalBlocker();
    if (operationalBlocker) {
      setPublishError(operationalBlocker);
      return;
    }

    if (!user) return;

    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    if (!supabaseUrl) {
      setPublishError('Supabase URL is not configured.');
      return;
    }

    const publishSequence = ++publishOperationSequenceRef.current;
    const publishLoadSequence = projectLoadSequenceRef.current;
    const publishUserId = user.id;
    const publishTitle = siteName.trim() || 'My Website';
    const publishIsCurrent = () =>
      publishOperationSequenceRef.current === publishSequence &&
      projectLoadSequenceRef.current === publishLoadSequence &&
      activeUserIdRef.current === publishUserId;
    const assertPublishIsCurrent = () => {
      if (!publishIsCurrent()) {
        throw new Error('Publishing stopped because the active project changed.');
      }
    };

    let liveRollback: {
      folder: string;
      snapshot: Awaited<ReturnType<typeof snapshotPublishedWebsiteFiles>>;
    } | null = null;
    let liveFilesReplaced = false;
    let publicationStateCommitted = false;
    let formRollback: { projectId: string; ownerId: string; rows: WebsiteFormRow[] } | null = null;
    let formsSynchronized = false;
    let pendingArchiveCleanup: Parameters<typeof discardWebsitePublishVersionArchive>[0] | null = null;

    setPublishBusy(true);
    setPublishError('');
    setPublishVersionsError('');
    setLiveVerification('checking');

    try {
      let publishProjectId = cloudProjectId;

      if (publishProjectId) {
        const latestSaved = await saveProject({
          forPublication: true,
          automatic: true,
          createHistory: false,
        });

        assertPublishIsCurrent();

        if (!latestSaved) {
          throw new Error('The latest editor changes could not be synchronized before publishing.');
        }
      } else {
        const draftData = buildProjectData();
        const createResult = await createWebsiteProjectInCloud({
          userId: publishUserId,
          title: publishTitle,
          content: draftData,
          published: false,
        });

        assertPublishIsCurrent();

        if (createResult.error || !createResult.data) {
          if (createResult.error && /limit reached/i.test(createResult.error.message || '')) {
            openBillingWithMessage(createResult.error.message || 'Website project limit reached.');
          }

          throw new Error(
            createResult.error?.message ||
            'The project could not be created in Tayar cloud before publishing.'
          );
        }

        publishProjectId = String((createResult.data as { id: string }).id);
        cloudRevisionRef.current = { projectId: publishProjectId, updatedAt: createResult.data.updated_at || null };
        setCloudProjectId(publishProjectId);
        saveActiveWebsiteProjectId(publishProjectId);
        setProjectTeamAccess({
          ...DEFAULT_EDITOR_PROJECT_ACCESS,
          ownerId: publishUserId,
        });
        setCloudSyncFailed(false);
      }

      if (!publishProjectId) {
        throw new Error('A cloud project ID is required to publish.');
      }

      assertPublishIsCurrent();

      const publishRevision = cloudRevisionRef.current?.projectId === publishProjectId ? cloudRevisionRef.current.updatedAt : null;
      if (!publishRevision) throw new Error('Reopen the cloud project before publishing so its current version can be verified.');
      const folder = publishUserId + '/' + publishProjectId;
      const publicBaseUrl = buildPublishedSiteBaseUrl(publishUserId, publishProjectId);
      if (!publicBaseUrl) {
        throw new Error('Could not build the public website URL.');
      }
      const productionBaseUrl = customDomain?.status === 'verified' ? `https://${customDomain.hostname}` : publicBaseUrl;
      const releasePublishedUrl = customDomain?.status === 'verified' ? `${productionBaseUrl}/` : `${publicBaseUrl}/index.html`;

      const currentPages = getOutputPages();

      if (!currentPages.length) {
        throw new Error('Add at least one page before publishing.');
      }

      const formSnapshot = await snapshotPublishedWebsiteForms(publishProjectId, publishUserId);
      if (formSnapshot.error) throw new Error('Published form configuration could not be backed up before publishing.');
      formRollback = { projectId: publishProjectId, ownerId: publishUserId, rows: (formSnapshot.data || []) as WebsiteFormRow[] };
      const formSync = await syncPublishedWebsiteForms({
        projectId: publishProjectId,
        ownerId: publishUserId,
        pages: currentPages,
      });
      formsSynchronized = true;
      assertPublishIsCurrent();
      if (formSync.error) {
        throw new Error('Published form configuration could not be synchronized. Apply the Forms + Automations MAX database migration and try again.');
      }

      let files: Array<{
        name: string;
        content: string;
        contentType: string;
      }> = currentPages.map((page) => ({
        name: getOutputFilename(page),
        content: getHtml(
          page.sections,
          page.id,
          productionBaseUrl,
          true,
          true,
        ),
        contentType: 'text/html; charset=utf-8',
      }));

      if (!files.some((file) => file.name === 'index.html')) {
        const firstPage = currentPages[0];
        files.unshift({
          name: 'index.html',
          content: getHtml(
            firstPage.sections,
            firstPage.id,
            productionBaseUrl,
            true,
            true,
          ),
          contentType: 'text/html; charset=utf-8',
        });
      }

      const sitemapEntries = currentPages
        .filter((page) => page.noIndex !== true)
        .map((page) => {
          const location = websitePathUrl(productionBaseUrl, getOutputFilename(page), true);

          return '  <url><loc>' + escapeHtml(location) + '</loc></url>';
        })
        .join('\n');

      const customRobotsRules =
        sanitizeRobotsRules(
          productionConfig.customRobotsRules,
        );

      files.push(
        {
          name: '404.html',
          content: get404Html(
            productionBaseUrl,
            true,
            true,
          ),
          contentType: 'text/html; charset=utf-8',
        },
        {
          name: 'sitemap.xml',
          content:
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            sitemapEntries +
            '\n</urlset>',
          contentType: 'application/xml; charset=utf-8',
        },
        {
          name: 'robots.txt',
          content:
            'User-agent: *\nAllow: /\n' +
            (customRobotsRules
              ? '\n' + customRobotsRules + '\n'
              : '\n') +
            'Sitemap: ' +
            productionBaseUrl +
            '/sitemap.xml\n',
          contentType: 'text/plain; charset=utf-8',
        },
      );

      if (fromStaging) {
        files = await readPublishedWebsiteFolderFiles(`${folder}/previews/${previewToken}/release`);
        assertPublishIsCurrent();
      }
      const publishBaseProjectData = buildProjectData();
      const publishEditableFingerprint = fromStaging ? previewFingerprint : buildEditableFingerprint();
      const publishReleaseNote = releaseNote.trim().slice(0, 500);
      const publishReleaseHistoryEnabled =
        billingEntitlements.features.releaseHistory;

      const previousLiveSnapshot = await snapshotPublishedWebsiteFiles(folder);
      assertPublishIsCurrent();
      liveRollback = { folder, snapshot: previousLiveSnapshot };
      await replacePublishedWebsiteFiles(folder, files, previousLiveSnapshot);
      liveFilesReplaced = true;
      assertPublishIsCurrent();

      const versionId =
        typeof crypto !== 'undefined' &&
        'randomUUID' in crypto
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
              .replace(
                /[xy]/g,
                (character) => {
                  const random =
                    Math.floor(
                      Math.random() * 16,
                    );

                  const value =
                    character === 'x'
                      ? random
                      : (random & 0x3) |
                        0x8;

                  return value.toString(16);
                },
              );

      const versionPrefix =
        folder +
        '/versions/' +
        versionId;

      const manifest = files.map((file) => ({
        name: file.name,
        contentType: file.contentType,
      }));

      let archivedReleaseId:
        string | null = null;

      let archiveWarning = '';

      if (publishReleaseHistoryEnabled) {
        try {
          await archivePublishedWebsiteFiles(versionPrefix, files);
          pendingArchiveCleanup = {
            versionId,
            projectId: publishProjectId,
            ownerId: publishUserId,
            storagePrefix: versionPrefix,
            fileManifest: manifest,
          };

          assertPublishIsCurrent();

          const provisionalData = {
            ...publishBaseProjectData,
            ...(fromStaging ? JSON.parse(previewFingerprint) : {}),
            publishedUrl:
              releasePublishedUrl,
            publishedAt:
              new Date().toISOString(),
            lastPublishedVersionId:
              versionId,
            lastPublishedFingerprint:
              publishEditableFingerprint,
          };

          const {
            error: versionError,
          } = await createWebsitePublishVersion({
            id: versionId,
            projectId: publishProjectId,
            ownerId: publishUserId,
            releaseNote: publishReleaseNote,
            publishedUrl: releasePublishedUrl,
            storagePrefix: versionPrefix,
            editorFingerprint: publishEditableFingerprint,
            snapshot: provisionalData,
            fileManifest: manifest,
          });

          assertPublishIsCurrent();

          if (versionError) {
            throw versionError;
          }

          archivedReleaseId =
            versionId;
        } catch (error) {
          if (!publishIsCurrent()) throw error;
          let archiveMessage =
            error instanceof Error
              ? error.message
              : 'Release history could not be archived.';

          if (pendingArchiveCleanup) {
            const cleanup = pendingArchiveCleanup;
            pendingArchiveCleanup = null;
            const { error: cleanupError } = await discardWebsitePublishVersionArchive(cleanup);
            if (cleanupError) archiveMessage += ' Archive cleanup needs support review.';
          }

          archiveWarning = archiveMessage;
        }
      }

      const nextPublishedRouteUrl =
        buildPublishedSiteUrl(publishUserId, publishProjectId, 'index.html');

      if (!nextPublishedRouteUrl) {
        throw new Error('Could not build the public website URL.');
      }

      assertPublishIsCurrent();

      const renderedRouteHealthy =
        await verifyPublishedRoute(nextPublishedRouteUrl);

      assertPublishIsCurrent();

      if (!renderedRouteHealthy) {
        throw new Error(
          'The website files were uploaded, but the public renderer did not return a valid HTML page.'
        );
      }

      const nextPublishedAt =
        new Date().toISOString();
      const nextPublishedUrl = customDomain?.status === 'verified' ? `${productionBaseUrl}/` : nextPublishedRouteUrl;

      const projectData = {
        ...publishBaseProjectData,
        publishedUrl:
          nextPublishedUrl,
        publishedAt:
          nextPublishedAt,
        lastPublishedVersionId:
          archivedReleaseId,
        lastPublishedFingerprint:
          publishEditableFingerprint,
        updatedAt:
          nextPublishedAt,
      };

      assertPublishIsCurrent();

      const {
        data: publishedRow,
        error: projectError,
      } = await updateWebsiteProjectPublicationState({
        projectId: publishProjectId,
        expectedUpdatedAt: publishRevision,
        userId: publishUserId,
        content: projectData,
        published: true,
        updatedAt: nextPublishedAt,
      });

      if (projectError) {
        throw new Error(
          'The site is uploaded, but the project publish state could not be saved: ' +
          projectError.message
        );
      }

      if (publishIsCurrent()) cloudRevisionRef.current = { projectId: publishProjectId, updatedAt: publishedRow?.updated_at || nextPublishedAt };
      publicationStateCommitted = true;
      formRollback = null;
      liveRollback = null;
      pendingArchiveCleanup = null;
      assertPublishIsCurrent();

      setCloudProjects((current) => {
        const existing = current.find((project) => project.id === publishProjectId);
        const updatedProject: CloudWebsiteProject = {
          ...(existing || {
            id: publishProjectId,
            user_id: publishUserId,
            workspace_id: null,
            title: publishTitle,
            content: projectData,
            status: 'completed',
            updated_at: publishedRow?.updated_at || nextPublishedAt,
          }),
          content: projectData,
          status: 'completed',
          updated_at: publishedRow?.updated_at || nextPublishedAt,
        };

        return [
          updatedProject,
          ...current.filter((project) => project.id !== publishProjectId),
        ];
      });

      setPublishedUrl(
        nextPublishedUrl,
      );

      setPublishedAt(
        nextPublishedAt,
      );

      setLastPublishedVersionId(
        archivedReleaseId,
      );

      setLastPublishedFingerprint(
        publishEditableFingerprint,
      );

      setReleaseNote('');

      saveLocalWebsiteProject(projectData);

      lastSavedSnapshotRef.current = '';

      setAutoSaveStatus(
        'saved',
      );

      setCloudSyncFailed(
        false,
      );

      setLiveVerification(
        'healthy',
      );

      if (archiveWarning) {
        setPublishVersionsError(
          `${l('Website published successfully. Release history was skipped:')} ${l(archiveWarning)}`
        );
      }

      if (publishReleaseHistoryEnabled) {
        await refreshPublishVersions(
          publishProjectId,
          publishUserId,
          publishLoadSequence,
        );
      }
    } catch (error) {
      let message = error instanceof Error
        ? error.message
        : 'Could not publish this website.';

      if (formRollback && formsSynchronized && !publicationStateCommitted) {
        const restoredForms = await restorePublishedWebsiteForms(formRollback.projectId, formRollback.ownerId, formRollback.rows);
        if (restoredForms.error) message += ' Form configuration rollback needs support review.';
      }

      if (liveRollback && liveFilesReplaced && !publicationStateCommitted) {
        try {
          await restorePublishedWebsiteSnapshot(liveRollback.folder, liveRollback.snapshot);
          message += ' The previous live website was restored automatically.';
        } catch (rollbackError) {
          message += ' Automatic rollback needs support review: ' +
            (rollbackError instanceof Error ? rollbackError.message : 'unknown rollback error');
        }
      }

      if (pendingArchiveCleanup && !publicationStateCommitted) {
        const cleanup = pendingArchiveCleanup;
        pendingArchiveCleanup = null;
        try {
          const { error: cleanupError } = await discardWebsitePublishVersionArchive(cleanup);
          if (cleanupError) message += ' Release archive cleanup needs support review.';
        } catch {
          message += ' Release archive cleanup needs support review.';
        }
      }

      if (!publishIsCurrent()) return;

      setPublishError(message);

      setLiveVerification(
        'failed',
      );
    } finally {
      if (publishOperationSequenceRef.current === publishSequence) {
        setPublishBusy(false);
      }
    }
  };
}
