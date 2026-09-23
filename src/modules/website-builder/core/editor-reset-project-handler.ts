import type * as React from 'react';
import { defaultBrand,defaultSections,defaultSEO } from '../core/defaults';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import { DEFAULT_DELIVERY_CONFIG } from '../core/delivery-config';
import { clearLocalWebsiteProjects,saveActiveWebsiteProjectId } from '../core/editor-project-lifecycle';
import type { WebsiteBrand,WebsiteSection,WebsiteSEO } from '../core/types';
import { DEFAULT_FOOTER_CONFIG,DEFAULT_HEADER_CONFIG,DEFAULT_PRODUCTION_CONFIG,DEFAULT_SITE_ENHANCEMENTS,DEFAULT_THEME } from '../core/website-builder-config';
import type { LiveVerification,ProjectHistoryEntry,WebsiteAnalyticsEvent,WebsiteFooterConfig,WebsiteHeaderConfig,WebsiteLead,WebsitePage,WebsiteProductionConfig,WebsitePublishVersion,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import { EMPTY_WEBSITE_CMS } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { DEFAULT_WEBSITE_LOCALIZATION } from '../core/website-localization';
import type { WebsiteFormDelivery } from '../services/websiteFormService';

interface createResetProjectHandlerDependencies {
  cancelPendingProjectPersistence: () => void;
  l: (text: string) => string;
  lastSavedSnapshotRef: React.MutableRefObject<string>;
  newProjectIntentRef: React.MutableRefObject<boolean>;
  prefs: import("@/context/PreferencesContext").UserPreferences;
  projectLoadSequenceRef: React.MutableRefObject<number>;
  saveRecoverySnapshot: (reason: string) => void;
  setActivePageId: React.Dispatch<React.SetStateAction<string>>;
  setAnalyticsError: React.Dispatch<React.SetStateAction<string>>;
  setAnalyticsEvents: React.Dispatch<React.SetStateAction<WebsiteAnalyticsEvent[]>>;
  setAnalyticsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAutoSaveStatus: React.Dispatch<React.SetStateAction<"idle" | "failed" | "saving" | "saved">>;
  setBrand: React.Dispatch<React.SetStateAction<WebsiteBrand>>;
  setCloudError: React.Dispatch<React.SetStateAction<string>>;
  setCloudProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  setCms: React.Dispatch<React.SetStateAction<WebsiteCmsState>>;
  setDeliveryConfig: React.Dispatch<React.SetStateAction<WebsiteDeliveryConfig>>;
  setDeliveryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFaviconUrl: React.Dispatch<React.SetStateAction<string>>;
  setFooterConfig: React.Dispatch<React.SetStateAction<WebsiteFooterConfig>>;
  setFormDeliveries: React.Dispatch<React.SetStateAction<WebsiteFormDelivery[]>>;
  setFuture: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHomePageId: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
  setLeads: React.Dispatch<React.SetStateAction<WebsiteLead[]>>;
  setLeadsError: React.Dispatch<React.SetStateAction<string>>;
  setLeadsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLiveVerification: React.Dispatch<React.SetStateAction<LiveVerification>>;
  setLocalization: React.Dispatch<React.SetStateAction<WebsiteLocalizationConfig>>;
  setPages: React.Dispatch<React.SetStateAction<WebsitePage[]>>;
  setPreviewCreatedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewError: React.Dispatch<React.SetStateAction<string>>;
  setPreviewFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setPreviewToken: React.Dispatch<React.SetStateAction<string>>;
  setPreviewUrl: React.Dispatch<React.SetStateAction<string>>;
  setProductionConfig: React.Dispatch<React.SetStateAction<WebsiteProductionConfig>>;
  setProjectHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setPublishedAt: React.Dispatch<React.SetStateAction<string | null>>;
  setPublishedUrl: React.Dispatch<React.SetStateAction<string>>;
  setPublishError: React.Dispatch<React.SetStateAction<string>>;
  setPublishVersions: React.Dispatch<React.SetStateAction<WebsitePublishVersion[]>>;
  setReleaseHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  setSelectedElementId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSeo: React.Dispatch<React.SetStateAction<WebsiteSEO>>;
  setSiteEnhancements: React.Dispatch<React.SetStateAction<WebsiteSiteEnhancements>>;
  setSiteName: React.Dispatch<React.SetStateAction<string>>;
  setSiteUrl: React.Dispatch<React.SetStateAction<string>>;
  setSymbols: React.Dispatch<React.SetStateAction<WebsiteSymbol[]>>;
  setTheme: React.Dispatch<React.SetStateAction<WebsiteTheme>>;
}

export function createResetProjectHandler({
  cancelPendingProjectPersistence,
  l,
  lastSavedSnapshotRef,
  newProjectIntentRef,
  prefs,
  projectLoadSequenceRef,
  saveRecoverySnapshot,
  setActivePageId,
  setAnalyticsError,
  setAnalyticsEvents,
  setAnalyticsOpen,
  setAutoSaveStatus,
  setBrand,
  setCloudError,
  setCloudProjectId,
  setCms,
  setDeliveryConfig,
  setDeliveryOpen,
  setFaviconUrl,
  setFooterConfig,
  setFormDeliveries,
  setFuture,
  setHeaderConfig,
  setHistory,
  setHistoryOpen,
  setHomePageId,
  setLastPublishedFingerprint,
  setLastPublishedVersionId,
  setLeads,
  setLeadsError,
  setLeadsOpen,
  setLiveVerification,
  setLocalization,
  setPages,
  setPreviewCreatedAt,
  setPreviewError,
  setPreviewFingerprint,
  setPreviewToken,
  setPreviewUrl,
  setProductionConfig,
  setProjectHistory,
  setPublishedAt,
  setPublishedUrl,
  setPublishError,
  setPublishVersions,
  setReleaseHistoryOpen,
  setSaved,
  setSections,
  setSelectedElementId,
  setSelectedId,
  setSeo,
  setSiteEnhancements,
  setSiteName,
  setSiteUrl,
  setSymbols,
  setTheme,
}: createResetProjectHandlerDependencies) {
  return function resetProject() {
    const confirmed = window.confirm(
      l('Reset the website builder to the default project?')
    );

    if (!confirmed) return;

    saveRecoverySnapshot('before reset');
    cancelPendingProjectPersistence();
    projectLoadSequenceRef.current += 1;
    newProjectIntentRef.current = true;
    setSections(defaultSections);
    setPages([{ id: 'page-home', name: 'Home', slug: 'home', sections: defaultSections, showInNavigation: true }]);
    setActivePageId('page-home');
    setHomePageId('page-home');
    setCms(EMPTY_WEBSITE_CMS);
    setLocalization({ ...DEFAULT_WEBSITE_LOCALIZATION, defaultLanguage: prefs.language });
    setSelectedId(defaultSections[0].id);
    setSelectedElementId(defaultSections[0].elements[0]?.id ?? null);
    setSiteName('My Website');
    setSiteUrl('');
    setFaviconUrl('');
    setBrand(defaultBrand);
    setTheme(DEFAULT_THEME);
    setHeaderConfig(DEFAULT_HEADER_CONFIG);
    setFooterConfig(DEFAULT_FOOTER_CONFIG);
    setSiteEnhancements(DEFAULT_SITE_ENHANCEMENTS);
    setProductionConfig(DEFAULT_PRODUCTION_CONFIG);
    setDeliveryConfig(DEFAULT_DELIVERY_CONFIG);
    setDeliveryOpen(false);
    setSymbols([]);
    setSeo(defaultSEO);
    setPublishedUrl('');
    setPublishedAt(null);
    setPreviewUrl('');
    setPreviewToken('');
    setPreviewCreatedAt(null);
    setPreviewFingerprint('');
    setLastPublishedVersionId(null);
    setLastPublishedFingerprint('');
    setPublishVersions([]);
    setReleaseHistoryOpen(false);
    setLiveVerification('idle');
    setPublishError('');
    setPreviewError('');
    clearLocalWebsiteProjects();
    setCloudProjectId(null);
    saveActiveWebsiteProjectId(null);
    setCloudError('');
    setProjectHistory([]);
    setHistory([]);
    setFuture([]);
    setLeads([]);
    setFormDeliveries([]);
    setLeadsOpen(false);
    setLeadsError('');
    setAnalyticsEvents([]);
    setAnalyticsOpen(false);
    setAnalyticsError('');
    setHistoryOpen(false);
    lastSavedSnapshotRef.current = '';
    setAutoSaveStatus('idle');
    setSaved(false);
  };
}
