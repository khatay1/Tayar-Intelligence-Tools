import type { Language } from '@/context/PreferencesContext';
import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import { saveActiveWebsiteProjectId,saveLocalWebsiteProject } from '../core/editor-project-lifecycle';
import type { WebsiteBrand,WebsiteSEO } from '../core/types';
import { BILLING_PLAN_DETAILS } from '../core/website-builder-config';
import type { BillingPlan,BillingState,LiveVerification,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsiteLead,WebsitePage,WebsiteProductionConfig,WebsitePublishVersion,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { createWebsiteProjectInCloud } from '../services/projectCloudService';
import type { WebsiteFormDelivery } from '../services/websiteFormService';

interface createDuplicateProjectHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  billingEntitlements: import("./website-builder-model").BillingEntitlements;
  billingPlan: BillingPlan;
  billingState: BillingState;
  buildProjectSnapshot: () => { version: number; cloudProjectId: string | null; siteName: string; siteUrl: string; faviconUrl: string; publishedUrl: string; publishedAt: string | null; previewUrl: string; previewToken: string; previewCreatedAt: string | null; previewFingerprint: string; lastPublishedVersionId: string | null; lastPublishedFingerprint: string; activePageId: string; homePageId: string; pages: WebsitePage[]; cms: WebsiteCmsState; localization: WebsiteLocalizationConfig; brand: WebsiteBrand; theme: WebsiteTheme; headerConfig: WebsiteHeaderConfig; footerConfig: WebsiteFooterConfig; siteEnhancements: WebsiteSiteEnhancements; productionConfig: WebsiteProductionConfig; deliveryConfig: WebsiteDeliveryConfig; symbols: WebsiteSymbol[]; seo: WebsiteSEO; language: Language; updatedAt: string; };
  cancelPendingProjectPersistence: () => void;
  cloudRevisionRef: React.MutableRefObject<{ projectId: string; updatedAt: string | null; } | null>;
  deliveryConfig: WebsiteDeliveryConfig;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  newProjectIntentRef: React.MutableRefObject<boolean>;
  openBillingWithMessage: (message?: string) => void;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  refreshCloudProjects: () => Promise<void>;
  setCloudBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setCloudError: React.Dispatch<React.SetStateAction<string>>;
  setCloudProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setDeliveryConfig: React.Dispatch<React.SetStateAction<WebsiteDeliveryConfig>>;
  setFormDeliveries: React.Dispatch<React.SetStateAction<WebsiteFormDelivery[]>>;
  setFuture: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setLastPublishedFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  setLeads: React.Dispatch<React.SetStateAction<WebsiteLead[]>>;
  setLeadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLiveVerification: React.Dispatch<React.SetStateAction<LiveVerification>>;
  setPreviewCreatedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setPreviewToken: React.Dispatch<React.SetStateAction<string>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string>>;
  setProjectHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setPublishedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string>>;
  setPublishVersions: React.Dispatch<React.SetStateAction<WebsitePublishVersion[]>>;
  setReleaseHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  showSavedFeedback: (expectedLoadSequence?: number, expectedUserId?: string | null) => void;
  siteName: string;
  user: User | null;
}

export function createDuplicateProjectHandler({
  activeUserIdRef,
  billingEntitlements,
  billingPlan,
  billingState,
  buildProjectSnapshot,
  cancelPendingProjectPersistence,
  cloudRevisionRef,
  deliveryConfig,
  lastSavedSnapshotRef,
  newProjectIntentRef,
  openBillingWithMessage,
  projectLoadSequenceRef,
  refreshCloudProjects,
  setCloudBusy,
  setCloudError,
  setCloudProjectId,
  setDeliveryConfig,
  setFormDeliveries,
  setFuture,
  setHistory,
  setLastPublishedFingerprint,
  setLastPublishedVersionId,
  setLeads,
  setLeadsOpen,
  setLiveVerification,
  setPreviewCreatedAt,
  setPreviewFingerprint,
  setPreviewToken,
  setPreviewUrl,
  setProjectHistory,
  setPublishedAt,
  setPublishedUrl,
  setPublishVersions,
  setReleaseHistoryOpen,
  setSiteName,
  showSavedFeedback,
  siteName,
  user,
}: createDuplicateProjectHandlerDependencies) {
  return async function duplicateProject() {
    if (user && billingState.usage.websiteProjects >= billingEntitlements.maxWebsiteProjects) {
      openBillingWithMessage(`Your ${BILLING_PLAN_DETAILS[billingPlan].label} plan supports ${billingEntitlements.maxWebsiteProjects} Website Builder project${billingEntitlements.maxWebsiteProjects === 1 ? '' : 's'}. Upgrade before duplicating another project.`);
      return;
    }

    cancelPendingProjectPersistence();
    projectLoadSequenceRef.current += 1;
    const duplicateLoadSequence = projectLoadSequenceRef.current;
    const duplicateUserId = user?.id ?? null;
    const duplicateIsCurrent = () =>
      projectLoadSequenceRef.current === duplicateLoadSequence &&
      activeUserIdRef.current === duplicateUserId;

    const duplicateTitle = `${siteName.trim() || 'My Website'} Copy`;
    const duplicateContent = {
      ...buildProjectSnapshot(),
      cloudProjectId: null,
      siteName: duplicateTitle,
      publishedUrl: '',
      publishedAt: null,
      previewUrl: '',
      previewToken: '',
      previewCreatedAt: null,
      previewFingerprint: '',
      lastPublishedVersionId: null,
      lastPublishedFingerprint: '',
      deliveryConfig: { ...deliveryConfig, status: 'building', approvedAt: null, approvedFingerprint: '', deliveredAt: null },
      history: [],
      updatedAt: new Date().toISOString(),
    };

    if (!user) {
      setCloudProjectId(null);
      saveActiveWebsiteProjectId(null);
      setProjectHistory([]);
      setHistory([]);
      setFuture([]);
      setSiteName(duplicateTitle);
      setPublishedUrl('');
      setPublishedAt(null);
      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setPreviewFingerprint('');
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setDeliveryConfig((current) => ({ ...current, status: 'building', approvedAt: null, approvedFingerprint: '', deliveredAt: null }));
      setPublishVersions([]);
      setReleaseHistoryOpen(false);
      setLiveVerification('idle');
      saveLocalWebsiteProject(duplicateContent);
      lastSavedSnapshotRef.current = '';
      showSavedFeedback(duplicateLoadSequence, duplicateUserId);
      return;
    }

    if (!duplicateUserId) return;

    setCloudBusy(true);
    setCloudError('');
    const { data, error } = await createWebsiteProjectInCloud({
      userId: duplicateUserId,
      title: duplicateTitle,
      content: duplicateContent,
      published: false,
    });

    if (!duplicateIsCurrent()) return;

    if (error || !data) {
      if (error && /limit reached/i.test(error.message || '')) openBillingWithMessage(error.message);
      setCloudError(error?.message || 'Could not duplicate this project.');
      setCloudBusy(false);
      return;
    }

    newProjectIntentRef.current = false;
    cloudRevisionRef.current = { projectId: data.id, updatedAt: data.updated_at || null };
    setCloudProjectId(data.id);
    saveActiveWebsiteProjectId(data.id);
    setProjectHistory([]);
    setHistory([]);
    setFuture([]);
    setLeads([]);
    setFormDeliveries([]);
    setLeadsOpen(false);
    setSiteName(duplicateTitle);
    setPublishedUrl('');
    setPublishedAt(null);
    setPreviewUrl('');
    setPreviewToken('');
    setPreviewCreatedAt(null);
    setPreviewFingerprint('');
    setLastPublishedVersionId(null);
    setLastPublishedFingerprint('');
    setDeliveryConfig((current) => ({ ...current, status: 'building', approvedAt: null, approvedFingerprint: '', deliveredAt: null }));
    setPublishVersions([]);
    setReleaseHistoryOpen(false);
    setLiveVerification('idle');
    saveLocalWebsiteProject({
      ...duplicateContent,
      cloudProjectId: data.id,
    });
    lastSavedSnapshotRef.current = '';
    await refreshCloudProjects();
    if (!duplicateIsCurrent()) return;
    setCloudBusy(false);
    showSavedFeedback(duplicateLoadSequence, duplicateUserId);
  };
}
