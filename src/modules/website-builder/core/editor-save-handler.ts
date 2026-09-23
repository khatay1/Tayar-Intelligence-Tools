import type { Language } from '@/context/PreferencesContext';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import { createProjectHistoryEntry } from '../core/editor-autosave-policy';
import type { EditorProjectAccess } from '../core/editor-project-access';
import { DEFAULT_EDITOR_PROJECT_ACCESS } from '../core/editor-project-access';
import { loadActiveWebsiteProjectId,saveActiveWebsiteProjectId,saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import type { WebsiteBrand,WebsiteSEO } from '../core/types';
import type { CloudWebsiteProject,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { createWebsiteProjectInCloud,updateWebsiteProjectInCloud } from '../services/projectCloudService';

interface SaveProjectHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  buildProjectData: (historyEntries?: ProjectHistoryEntry[]) => { history: ProjectHistoryEntry[]; version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  buildProjectFingerprint: () => string;
  buildProjectSnapshot: () => { version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  cloudProjectId: string | null;
  cloudProjects: CloudWebsiteProject[];
  cloudProjectsLoaded: boolean;
  cloudRevisionRef: React.MutableRefObject<{ projectId: string; updatedAt: string | null; } | null>;
  l: (text: string) => string;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  loadCloudProjectRef: React.MutableRefObject<(projectId: string) => Promise<void>>;
  networkOnline: boolean;
  newProjectIntentRef: React.MutableRefObject<boolean>;
  openBillingWithMessage: (message?: string) => void;
  previewBusy: boolean;
  projectHistory: ProjectHistoryEntry[];
  projectId: string | null;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  projectTeamAccess: EditorProjectAccess;
  publishBusy: boolean;
  publishedUrl: string;
  saveAbortControllerRef: React.MutableRefObject<AbortController | null>;
  saveInFlightRef: React.MutableRefObject<boolean>;
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "saving" | "saved" | "failed">>;
  setCloudBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setCloudError: React.Dispatch<React.SetStateAction<string>>;
  setCloudProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setCloudProjects: React.Dispatch<React.SetStateAction<CloudWebsiteProject[]>>;
  setCloudSyncFailed: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setProjectTeamAccess: React.Dispatch<React.SetStateAction<EditorProjectAccess>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  showSavedFeedback: (expectedLoadSequence?: number, expectedUserId?: string | null) => void;
  siteName: string;
  user: User | null;
}

export function createSaveProjectHandler({
  activeUserIdRef,
  buildProjectData,
  buildProjectFingerprint,
  buildProjectSnapshot,
  cloudProjectId,
  cloudProjects,
  cloudProjectsLoaded,
  cloudRevisionRef,
  l,
  lastSavedSnapshotRef,
  loadCloudProjectRef,
  networkOnline,
  newProjectIntentRef,
  openBillingWithMessage,
  previewBusy,
  projectHistory,
  projectId,
  projectLoadSequenceRef,
  projectTeamAccess,
  publishBusy,
  publishedUrl,
  saveAbortControllerRef,
  saveInFlightRef,
  setAutoSaveStatus,
  setCloudBusy,
  setCloudError,
  setCloudProjectId,
  setCloudProjects,
  setCloudSyncFailed,
  setProjectHistory,
  setProjectTeamAccess,
  setSaved,
  showSavedFeedback,
  siteName,
  user,
}: SaveProjectHandlerDependencies) {
  return async function saveProject(options: { automatic?: boolean; createHistory?: boolean; forPublication?: boolean } = {}): Promise<boolean> {
    if ((publishBusy || previewBusy) && !options.forPublication) return false;
    const automatic = options.automatic === true;
    if (user && projectId && cloudProjectId !== projectId) {
      setCloudError('Opening your saved website. Save will continue when it is loaded.');
      return false;
    }

    if (user && !cloudProjectId) {
      const preservedProjectId = projectId || loadActiveWebsiteProjectId();
      if (preservedProjectId) {
        setCloudError('Your existing website is still reconnecting. Tayar will not create a duplicate draft while its saved identity is available.');
        setAutoSaveStatus('failed');
        return false;
      }

      if (!newProjectIntentRef.current && cloudProjectsLoaded && cloudProjects.length > 0) {
        const fallbackProject =
          cloudProjects.find((project) => project.user_id === user.id) ??
          cloudProjects[0];

        saveActiveWebsiteProjectId(fallbackProject.id);
        setCloudError('Opening your most recent saved website before saving. No duplicate draft was created.');
        setAutoSaveStatus('saving');
        void loadCloudProjectRef.current(fallbackProject.id);
        return false;
      }
    }

    const createHistory = options.createHistory ?? !automatic;
    const fingerprint = buildProjectFingerprint();

    if (user && cloudProjectId && !projectTeamAccess.canEdit) {
      setCloudError('This shared project is read-only for your Viewer role.');
      setAutoSaveStatus('failed');
      return false;
    }

    if (saveInFlightRef.current) {
      return false;
    }

    const saveLoadSequence = projectLoadSequenceRef.current;
    const saveUserId = user?.id ?? null;
    const saveController = new AbortController();
    const saveIsCurrent = () =>
      !saveController.signal.aborted &&
      projectLoadSequenceRef.current === saveLoadSequence &&
      activeUserIdRef.current === saveUserId;

    saveAbortControllerRef.current = saveController;
    saveInFlightRef.current = true;

    try {
      let historyEntries = projectHistory;
      if (createHistory) {
        const snapshot = buildProjectSnapshot();
        const entry = createProjectHistoryEntry(snapshot) as ProjectHistoryEntry;
        historyEntries = [entry, ...projectHistory].slice(0, 30);
      }

      const projectData = buildProjectData(historyEntries);
    const localSaved = saveLocalWebsiteProject(projectData);
    if (!localSaved) {
      setCloudError('Local recovery storage is full. Cloud save will still be attempted.');
    }

    let cloudSaved = !user;
    if (user) {
      setCloudBusy(true);
      setCloudError('');
      setAutoSaveStatus('saving');

      if (!networkOnline) {
        setCloudSyncFailed(true);
        setCloudError('You are offline. Changes are saved locally and will retry when the connection returns.');
      } else if (cloudProjectId) {
        const expectedUpdatedAt = cloudRevisionRef.current?.projectId === cloudProjectId ? cloudRevisionRef.current.updatedAt : null;
        if (!expectedUpdatedAt) throw new Error('Reopen the cloud project before saving so its current version can be verified.');
        const nextUpdatedAt = String(projectData.updatedAt || new Date().toISOString());
        const result = await updateWebsiteProjectInCloud({
          projectId: cloudProjectId,
          title: siteName.trim() || 'My Website',
          content: projectData,
          published: Boolean(publishedUrl),
          signal: saveController.signal,
          expectedUpdatedAt,
          updatedAt: nextUpdatedAt,
        });

        if (!saveIsCurrent()) return false;

        if (result.error) {
          if (/limit reached/i.test(result.error.message || '')) openBillingWithMessage(result.error.message);
          setCloudError(result.error.message || (automatic ? 'Autosaved locally, but cloud autosave failed.' : 'Saved locally, but cloud save failed.'));
          setCloudSyncFailed(true);
        } else {
          cloudSaved = true;
          cloudRevisionRef.current = { projectId: cloudProjectId, updatedAt: result.data?.updated_at || nextUpdatedAt };
          setCloudSyncFailed(false);
          setCloudProjects((current) =>
            current.map((project) =>
              project.id === cloudProjectId
                ? {
                    ...project,
                    title: siteName.trim() || 'My Website',
                    content: projectData,
                    status: publishedUrl ? 'completed' : 'draft',
                    updated_at: result.data?.updated_at || nextUpdatedAt,
                  }
                : project
            )
          );
        }
      } else {
        const result = await createWebsiteProjectInCloud({
          userId: user.id,
          title: siteName.trim() || 'My Website',
          content: projectData,
          published: Boolean(publishedUrl),
          signal: saveController.signal,
        });

        if (!saveIsCurrent()) return false;

        if (result.error || !result.data) {
          if (result.error && /limit reached/i.test(result.error.message || '')) openBillingWithMessage(result.error.message);
          setCloudError(result.error?.message || (automatic ? 'Autosaved locally, but cloud autosave failed.' : 'Saved locally, but cloud save failed.'));
          setCloudSyncFailed(true);
        } else {
          const createdProject = result.data;
          cloudRevisionRef.current = { projectId: createdProject.id, updatedAt: createdProject.updated_at || null };
          newProjectIntentRef.current = false;
          setCloudProjectId(createdProject.id);
          saveActiveWebsiteProjectId(createdProject.id);
          saveLocalWebsiteProject({
            ...projectData,
            cloudProjectId: createdProject.id,
          });
          setProjectTeamAccess({ ...DEFAULT_EDITOR_PROJECT_ACCESS, ownerId: user.id });
          setCloudProjects((current) => [
            {
              id: createdProject.id,
              user_id: user.id,
              workspace_id: null,
              title: siteName.trim() || 'My Website',
              content: projectData,
              status: publishedUrl ? 'completed' : 'draft',
              updated_at: typeof createdProject.updated_at === 'string'
                ? createdProject.updated_at
                : String(projectData.updatedAt || new Date().toISOString()),
            },
            ...current.filter((project) => project.id !== createdProject.id),
          ]);
          cloudSaved = true;
          setCloudSyncFailed(false);
        }
      }

      if (!saveIsCurrent()) return false;
    }

    if (!saveIsCurrent()) return false;

    if (createHistory && (localSaved || cloudSaved)) {
      setProjectHistory(historyEntries);
    }

    const durableSaved = user ? cloudSaved : localSaved;
    if (durableSaved) lastSavedSnapshotRef.current = fingerprint;
    setAutoSaveStatus(durableSaved ? 'saved' : 'failed');

    if (!automatic) {
      if (durableSaved) {
        showSavedFeedback(saveLoadSequence, user?.id ?? null);
      } else {
        setSaved(false);
      }
    }
    return durableSaved;
    } catch (error) {
      if (saveIsCurrent()) {
        const message = error instanceof Error ? error.message : l('Unexpected save failure.');
        setCloudSyncFailed(Boolean(saveUserId));
        setCloudError(saveUserId ? `${l('Save failed')}: ${l(message)}` : l(message));
        setAutoSaveStatus('failed');
        if (!automatic) setSaved(false);
      }
      return false;
    } finally {
      if (saveAbortControllerRef.current === saveController) {
        saveAbortControllerRef.current = null;
        saveInFlightRef.current = false;
        if (saveIsCurrent()) setCloudBusy(false);
      }
    }
  };
}
