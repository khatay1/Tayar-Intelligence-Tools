import { BILLING_PLAN_DETAILS } from './website-builder-config';
import type { BillingPlan, LiveVerification, WebsitePage, WebsiteProductionConfig } from './website-builder-model';
import type { WebsiteSEO, WebsiteSection } from './types';
import { normalizeSiteUrl } from './website-builder-rendering';

interface LaunchReadinessInput {
  auditScore: number;
  siteUrl: string;
  cloudProjectId: string | null;
  previewUrl: string;
  approvalCurrent: boolean;
  publishedUrl: string;
  faviconUrl: string;
}

export function calculateLaunchReadiness({ auditScore, siteUrl, cloudProjectId, previewUrl, approvalCurrent, publishedUrl, faviconUrl }: LaunchReadinessInput) {
  const auditPoints = Math.round(auditScore * 0.4);
  const checks = [
    { label: 'Production URL', ok: Boolean(normalizeSiteUrl(siteUrl)), points: 10 },
    { label: 'Cloud project', ok: Boolean(cloudProjectId), points: 10 },
    { label: 'Share preview', ok: Boolean(previewUrl), points: 8 },
    { label: 'Client approval', ok: approvalCurrent, points: 12 },
    { label: 'Published website', ok: Boolean(publishedUrl), points: 15 },
    { label: 'Favicon', ok: Boolean(faviconUrl.trim()), points: 5 },
  ];
  const score = Math.min(100, auditPoints + checks.reduce((total, item) => total + (item.ok ? item.points : 0), 0));
  return { score, checks, auditPoints };
}

interface V1LaunchStatusInput {
  pages: WebsitePage[];
  activePageId: string;
  sections: WebsiteSection[];
  networkOnline: boolean;
  cloudSyncFailed: boolean;
  autoSaveStatus: string;
  user: { id: string } | null;
  billingLoading: boolean;
  billingError: string;
  billingPlan: BillingPlan;
  siteUrl: string;
  seo: WebsiteSEO;
  faviconUrl: string;
  siteAudit: { score: number; errors: unknown[] };
  cloudProjectId: string | null;
  canPublish: boolean;
  publishedUrl: string;
  lastPublishedVersionId: string | null;
  liveVerification: LiveVerification;
  productionConfig: WebsiteProductionConfig;
  lastPublishedFingerprint: string;
  buildEditableFingerprint: () => string;
}

export function calculateV1LaunchStatus({ pages, activePageId, sections, networkOnline, cloudSyncFailed, autoSaveStatus, user, billingLoading, billingError, billingPlan, siteUrl, seo, faviconUrl, siteAudit, cloudProjectId, canPublish, publishedUrl, lastPublishedVersionId, liveVerification, productionConfig, lastPublishedFingerprint, buildEditableFingerprint }: V1LaunchStatusInput) {
  const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
  const contentReady = currentPages.length > 0 && currentPages.some((page) => page.sections.some((section) => (section.elements || []).length > 0));
  const syncHealthy = networkOnline && !cloudSyncFailed && autoSaveStatus !== 'failed';
  const billingVerified = Boolean(user) && !billingLoading && !billingError;
  const productionUrlReady = Boolean(normalizeSiteUrl(siteUrl));
  const seoReady = Boolean(seo.title.trim() && faviconUrl.trim());
  const auditReady = siteAudit.errors.length === 0 && siteAudit.score >= 80;
  const publishPermission = Boolean(user && cloudProjectId && canPublish);
  const publishedRelease = Boolean(publishedUrl);
  const liveHealthy = Boolean(publishedRelease && liveVerification === 'healthy');
  const unpublished = Boolean(publishedUrl && lastPublishedFingerprint && buildEditableFingerprint() !== lastPublishedFingerprint);

  const checks = [
    { label: 'Site content', detail: `${currentPages.length} page${currentPages.length === 1 ? '' : 's'} configured`, ok: contentReady, points: 8 },
    { label: 'SEO & accessibility audit', detail: `${siteAudit.score}/100 · ${siteAudit.errors.length} critical`, ok: auditReady, points: 15 },
    { label: 'Cloud project', detail: cloudProjectId ? 'Project is saved to Tayar cloud' : 'Save the project to cloud', ok: Boolean(cloudProjectId), points: 10 },
    { label: 'Cloud sync', detail: !networkOnline ? 'Offline' : cloudSyncFailed || autoSaveStatus === 'failed' ? 'Sync needs retry' : 'Sync healthy', ok: syncHealthy, points: 10 },
    { label: 'Production URL', detail: productionUrlReady ? normalizeSiteUrl(siteUrl) : 'Add your production URL', ok: productionUrlReady, points: 8 },
    { label: 'SEO title + favicon', detail: seoReady ? 'Branding metadata is configured' : 'Complete SEO title and favicon', ok: seoReady, points: 7 },
    { label: 'Billing backend', detail: billingVerified ? `${BILLING_PLAN_DETAILS[billingPlan].label} entitlements verified` : billingError || 'Sign in and refresh billing', ok: billingVerified, points: 7 },
    { label: 'Publish permission', detail: canPublish ? 'Owner may publish' : 'Only the project owner can publish', ok: publishPermission, points: 5 },
    { label: 'Published website', detail: publishedRelease ? (lastPublishedVersionId ? `Live · archive ${lastPublishedVersionId.slice(0, 8)}` : 'Live website detected') : 'Publish the first release', ok: publishedRelease, points: 15 },
    { label: 'Live verification', detail: liveVerification === 'healthy' ? 'Published index verified' : publishedRelease ? 'Run live verification' : 'Available after publishing', ok: liveHealthy, points: 15 },
  ];
  const score = Math.min(100, checks.reduce((total, check) => total + (check.ok ? check.points : 0), 0));
  const blockers = [
    !user ? 'Sign in before production launch.' : '',
    !cloudProjectId ? 'Save the project to cloud.' : '',
    !networkOnline ? 'Reconnect to the internet.' : '',
    cloudSyncFailed || autoSaveStatus === 'failed' ? 'Resolve cloud sync before publishing.' : '',
    siteAudit.errors.length ? `Fix ${siteAudit.errors.length} critical audit error${siteAudit.errors.length === 1 ? '' : 's'}.` : '',
    !siteAudit.errors.length && siteAudit.score < 80 ? 'Raise the SEO and accessibility audit score to at least 80.' : '',
    !productionUrlReady ? 'Add a valid production URL.' : '',
    !seoReady ? 'Complete the SEO title and favicon.' : '',
    billingLoading ? 'Wait for billing entitlements to finish loading.' : '',
    !billingVerified && !billingLoading && !billingError ? 'Refresh billing entitlements before publishing.' : '',
    productionConfig.maintenanceMode ? 'Disable maintenance mode for public launch.' : '',
    user && cloudProjectId && !canPublish ? 'The project owner must perform the publish.' : '',
    billingError ? 'Billing entitlements could not be verified.' : '',
  ].filter(Boolean) as string[];
  const preflightReady = blockers.length === 0 && productionUrlReady && seoReady && siteAudit.score >= 80;
  const status = !preflightReady
    ? 'NO-GO'
    : !publishedRelease
      ? 'READY TO PUBLISH'
      : unpublished
        ? 'CHANGES WAITING'
        : liveHealthy
          ? 'V1 LIVE'
          : 'VERIFY LIVE';
  return { score, checks, blockers, preflightReady, publishedRelease, liveHealthy, status };
}
