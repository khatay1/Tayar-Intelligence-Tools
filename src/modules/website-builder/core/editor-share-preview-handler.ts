import type { Language } from '@/context/PreferencesContext';
import { buildPreviewSiteBaseUrl,buildPreviewSiteUrl,buildPublishedSiteBaseUrl } from '@/lib/published-site-url';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import type { EditorProjectAccess } from '../core/editor-project-access';
import type { WebsiteBrand,WebsiteSEO } from '../core/types';
import { sanitizeRobotsRules } from '../core/website-builder-config';
import type { CloudWebsiteProject,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { escapeHtml } from '../core/website-builder-rendering';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { websitePathUrl } from '../core/website-localization';
import { updateWebsiteProjectInCloud } from '../services/projectCloudService';
import { removePublishedWebsiteFiles,uploadPublishedWebsiteFolderFiles,verifyPublishedRoute } from '../services/publishedWebsiteService';
import type { WebsiteCustomDomain } from '../services/websiteDomainService';
import type { WebsiteSection } from './types';

interface CreateSharePreviewHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  buildEditableFingerprint: () => string;
  buildProjectData: (historyEntries?: ProjectHistoryEntry[]) => { history: ProjectHistoryEntry[]; version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  cloudProjectId: string | null;
  cloudRevisionRef: React.MutableRefObject<{ projectId: string; updatedAt: string | null; } | null>;
  cmsErrors: import("./website-cms").WebsiteCmsIssue[];
  customDomain: WebsiteCustomDomain | null;
  previewBusy: boolean;
  previewOperationSequenceRef: React.MutableRefObject<number>;
  previewToken: string;
  productionConfig: WebsiteProductionConfig;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  projectTeamAccess: EditorProjectAccess;
  publishBusy: boolean;
  publishedUrl: string;
  setCloudProjects: React.Dispatch<React.SetStateAction<CloudWebsiteProject[]>>;
  setPreviewBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviewCreatedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewError: React.Dispatch<React.SetStateAction<string>>;
  setPreviewFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setPreviewToken: React.Dispatch<React.SetStateAction<string>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  saveProject: (options?: { automatic?: boolean; createHistory?: boolean; forPublication?: boolean }) => Promise<boolean>;
  getOutputPages: () => WebsitePage[];
  getOutputFilename: (page: WebsitePage) => string;
  getHtml: (pageSections?: WebsiteSection[], pageId?: string, productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  get404Html: (productionUrlOverride?: string, homeUsesIndexFile?: boolean, trackAnalytics?: boolean) => string;
  siteAudit: { errors: string[]; warnings: string[]; score: number; };
  siteName: string;
  user: User | null;
}

export function createSharePreviewHandler({
  activeUserIdRef,
  buildEditableFingerprint,
  buildProjectData,
  cloudProjectId,
  cloudRevisionRef,
  cmsErrors,
  customDomain,
  previewBusy,
  previewOperationSequenceRef,
  previewToken,
  productionConfig,
  projectLoadSequenceRef,
  projectTeamAccess,
  publishBusy,
  publishedUrl,
  setCloudProjects,
  setPreviewBusy,
  setPreviewCreatedAt,
  setPreviewError,
  setPreviewFingerprint,
  setPreviewToken,
  setPreviewUrl,
  setSaved,
  saveProject,
  getOutputPages,
  getOutputFilename,
  getHtml,
  get404Html,
  siteAudit,
  siteName,
  user,
}: CreateSharePreviewHandlerDependencies) {
  return async function createSharePreview() {
    if (previewBusy || publishBusy) return;
    if (siteAudit.errors.length || cmsErrors.length) {
      setPreviewError('Fix critical audit errors before creating staging.');
      return;
    }
    if (cloudProjectId && !projectTeamAccess.canPublish) {
      setPreviewError('Only the project owner can create public share previews.');
      return;
    }
    if (!user || !cloudProjectId) {
      setPreviewError('Save this project to the cloud before creating a share preview.');
      return;
    }

    const previewSequence = ++previewOperationSequenceRef.current;
    const previewLoadSequence = projectLoadSequenceRef.current;
    const previewProjectId = cloudProjectId;
    const previewUserId = user.id;
    const previousPreviewToken = previewToken;
    const previewIsCurrent = () =>
      previewOperationSequenceRef.current === previewSequence &&
      projectLoadSequenceRef.current === previewLoadSequence &&
      activeUserIdRef.current === previewUserId;

    setPreviewBusy(true);
    setPreviewError('');

    const latestSaved = await saveProject({ automatic: true, createHistory: false, forPublication: true });

    if (!previewIsCurrent()) return;

    if (!latestSaved) {
      setPreviewError('The latest editor changes could not be synchronized before creating the preview.');
      setPreviewBusy(false);
      return;
    }

    const previewRevision = cloudRevisionRef.current?.projectId === previewProjectId ? cloudRevisionRef.current.updatedAt : null;
    try {
      const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      const folder = `${previewUserId}/${previewProjectId}/previews/${token}`;
      const publicBaseUrl = buildPreviewSiteBaseUrl(previewUserId, previewProjectId, token);
      if (!publicBaseUrl) throw new Error('Could not build the public preview URL.');

      const currentPages = getOutputPages();
      const files: Array<{ name: string; content: string; contentType: string }> = currentPages.map((page) => ({
        name: getOutputFilename(page),
        content: getHtml(page.sections, page.id, publicBaseUrl, true, false),
        contentType: 'text/html; charset=utf-8',
      }));
      files.push({ name: '404.html', content: get404Html(publicBaseUrl, true, false), contentType: 'text/html; charset=utf-8' });

      await uploadPublishedWebsiteFolderFiles(folder, files);

      // Freeze the production bundle at staging time, including forms and tracking.
      // The share preview remains a separate, untracked rendering.
      const publicRouteBaseUrl = buildPublishedSiteBaseUrl(previewUserId, previewProjectId);
      if (!publicRouteBaseUrl) throw new Error('Could not build the production URL.');
      const liveBaseUrl = customDomain?.status === 'verified' ? `https://${customDomain.hostname}` : publicRouteBaseUrl;
      const productionFiles = currentPages.map((page) => ({
        name: getOutputFilename(page),
        content: getHtml(page.sections, page.id, liveBaseUrl, true, true),
        contentType: 'text/html; charset=utf-8',
      }));
      productionFiles.push({ name: '404.html', content: get404Html(liveBaseUrl, true, true), contentType: 'text/html; charset=utf-8' });
      productionFiles.push({ name: 'sitemap.xml', content: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + currentPages.filter((page) => !page.noIndex).map((page) => `<url><loc>${escapeHtml(websitePathUrl(liveBaseUrl, getOutputFilename(page), true))}</loc></url>`).join('') + '</urlset>', contentType: 'application/xml; charset=utf-8' });
      productionFiles.push({ name: 'robots.txt', content: `User-agent: *\nAllow: /\n${sanitizeRobotsRules(productionConfig.customRobotsRules)}\nSitemap: ${liveBaseUrl}/sitemap.xml\n`, contentType: 'text/plain; charset=utf-8' });
      await uploadPublishedWebsiteFolderFiles(`${folder}/release`, productionFiles);

      if (!previewIsCurrent()) return;

      const nextUrl = buildPreviewSiteUrl(previewUserId, previewProjectId, token, 'index.html');
      if (!nextUrl) throw new Error('Could not build the public preview URL.');

      const routeHealthy = await verifyPublishedRoute(nextUrl);

      if (!previewIsCurrent()) return;

      if (!routeHealthy) {
        throw new Error('Preview files were saved, but the public preview renderer did not return HTML.');
      }

      const createdAt = new Date().toISOString();
      const createdFingerprint = buildEditableFingerprint();
      const stagedProjectData = {
        ...buildProjectData(),
        previewToken: token,
        previewUrl: nextUrl,
        previewCreatedAt: createdAt,
        previewFingerprint: createdFingerprint,
      };
      const stagedSave = await updateWebsiteProjectInCloud({
        projectId: previewProjectId,
        title: siteName,
        content: stagedProjectData,
        published: Boolean(publishedUrl),
        expectedUpdatedAt: previewRevision,
        updatedAt: String(stagedProjectData.updatedAt || createdAt),
      });
      if (stagedSave.error) throw new Error(stagedSave.error.message);
      if (!previewIsCurrent()) return;
      cloudRevisionRef.current = { projectId: previewProjectId, updatedAt: stagedSave.data?.updated_at || createdAt };
      setCloudProjects((current) => current.map((project) => project.id === previewProjectId
        ? {
            ...project,
            content: stagedProjectData,
            updated_at: stagedSave.data?.updated_at || String(stagedProjectData.updatedAt || createdAt),
          }
        : project));
      setPreviewToken(token);
      setPreviewUrl(nextUrl);
      setPreviewCreatedAt(createdAt);
      setPreviewFingerprint(createdFingerprint);
      setSaved(false);
      if (previousPreviewToken) {
        try {
          await removePublishedWebsiteFiles(`${previewUserId}/${previewProjectId}/previews/${previousPreviewToken}`);
        } catch {
          if (previewIsCurrent()) setPreviewError('The new preview is ready, but the previous preview could not be revoked.');
        }
      }
      if (!previewIsCurrent()) return;
      try { await navigator.clipboard.writeText(nextUrl); } catch { /* Clipboard access is optional. */ }
    } catch (error) {
      if (!previewIsCurrent()) return;
      setPreviewError(error instanceof Error ? error.message : 'Could not create share preview.');
    } finally {
      if (previewOperationSequenceRef.current === previewSequence) {
        setPreviewBusy(false);
      }
    }
  };
}
