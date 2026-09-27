import { normalizePublishedSiteUrl } from '@/lib/published-site-url';
import type * as React from 'react';
import type { WebsiteDeliveryConfig } from '../core/delivery-config';
import { DEFAULT_DELIVERY_CONFIG,normalizeDeliveryConfig } from '../core/delivery-config';
import { normalizeWebsiteProjectLoad } from '../core/project-normalization';
import type { WebsiteBrand,WebsiteSection,WebsiteSEO } from '../core/types';
import { DEFAULT_FOOTER_CONFIG,DEFAULT_HEADER_CONFIG,DEFAULT_PRODUCTION_CONFIG,DEFAULT_SITE_ENHANCEMENTS,DEFAULT_THEME,normalizeFooterConfig,normalizeHeaderConfig,normalizeProductionConfig,normalizeSiteEnhancements,normalizeTheme } from '../core/website-builder-config';
import type { LiveVerification,PersistedWebsiteProject,ProjectHistoryEntry,WebsiteFooterConfig,WebsiteHeaderConfig,WebsitePage,WebsiteProductionConfig,WebsiteSiteEnhancements,WebsiteSymbol,WebsiteTheme } from '../core/website-builder-model';
import { isWebsiteSymbol } from '../core/website-builder-model';
import type { WebsiteCmsState } from '../core/website-cms';
import { EMPTY_WEBSITE_CMS,normalizeWebsiteCms } from '../core/website-cms';
import type { WebsiteLocalizationConfig } from '../core/website-localization';
import { DEFAULT_WEBSITE_LOCALIZATION,normalizeWebsiteLocalization } from '../core/website-localization';
import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';

interface createApplyProjectDataHandlerDependencies {
  setApplication?: React.Dispatch<React.SetStateAction<ApplicationDefinition | undefined>>;
  prefs: import("@/context/PreferencesContext").UserPreferences;
  setActivePageId: React.Dispatch<React.SetStateAction<string>>;
  setBrand: React.Dispatch<React.SetStateAction<WebsiteBrand>>;
  setCms: React.Dispatch<React.SetStateAction<WebsiteCmsState>>;
  setDeliveryConfig: React.Dispatch<React.SetStateAction<WebsiteDeliveryConfig>>;
  setFaviconUrl: React.Dispatch<React.SetStateAction<string>>;
  setFooterConfig: React.Dispatch<React.SetStateAction<WebsiteFooterConfig>>;
  setFuture: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setHeaderConfig: React.Dispatch<React.SetStateAction<WebsiteHeaderConfig>>;
  setHistory: React.Dispatch<React.SetStateAction<ProjectHistoryEntry[]>>;
  setHomePageId: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedFingerprint: React.Dispatch<React.SetStateAction<string>>;
  setLastPublishedVersionId: React.Dispatch<React.SetStateAction<string | null>>;
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

export function createApplyProjectDataHandler({
  setApplication,
  prefs,
  setActivePageId,
  setBrand,
  setCms,
  setDeliveryConfig,
  setFaviconUrl,
  setFooterConfig,
  setFuture,
  setHeaderConfig,
  setHistory,
  setHomePageId,
  setLastPublishedFingerprint,
  setLastPublishedVersionId,
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
}: createApplyProjectDataHandlerDependencies) {
  return function applyProjectData(input: unknown, loadHistory = true, resetEditHistory = true) {
    const rawApplication = input && typeof input === 'object' && !Array.isArray(input) ? (input as PersistedWebsiteProject).application : undefined;
    // Validate before normalization hydrates any global editor stores.
    const rawPages = input && typeof input === 'object' && !Array.isArray(input) ? (input as PersistedWebsiteProject).pages : undefined;
    const nextApplication = rawApplication === undefined ? undefined : readApplicationDefinition(rawApplication, new Set((rawPages ?? []).map(page => String(page.id))));
    const normalizedLoad = normalizeWebsiteProjectLoad(input);
    if (normalizedLoad.kind === 'invalid') return;
    setApplication?.(nextApplication);

    const normalizedSections = normalizedLoad.sections;
    const normalizedPages = normalizedLoad.pages as WebsitePage[];

    if (normalizedLoad.kind === 'legacy-array') {
      setCms(EMPTY_WEBSITE_CMS);
      setLocalization({ ...DEFAULT_WEBSITE_LOCALIZATION, defaultLanguage: prefs.language });
      setSections(normalizedSections);
      setPages(normalizedPages);
      setActivePageId(normalizedLoad.activePageId);
      setHomePageId(normalizedLoad.homePageId);
      setSelectedId(normalizedSections[0].id);
      setSelectedElementId(normalizedSections[0].elements[0]?.id ?? null);
      setFaviconUrl('');
      setTheme(DEFAULT_THEME);
      setHeaderConfig(DEFAULT_HEADER_CONFIG);
      setFooterConfig(DEFAULT_FOOTER_CONFIG);
      setSiteEnhancements(DEFAULT_SITE_ENHANCEMENTS);
      setProductionConfig(DEFAULT_PRODUCTION_CONFIG);
      setDeliveryConfig(DEFAULT_DELIVERY_CONFIG);
      setSymbols([]);
      setPublishedUrl('');
      setPublishedAt(null);
      setPreviewUrl('');
      setPreviewToken('');
      setPreviewCreatedAt(null);
      setPreviewFingerprint('');
      setLastPublishedVersionId(null);
      setLastPublishedFingerprint('');
      setLiveVerification('idle');
      setPublishError('');
      setPreviewError('');
      if (resetEditHistory) {
        setHistory([]);
        setFuture([]);
      }
      if (loadHistory) setProjectHistory([]);
      setSaved(false);
      return;
    }

    const parsed = normalizedLoad.parsed as PersistedWebsiteProject;
    setCms(normalizeWebsiteCms(parsed.cms));
    setLocalization(normalizeWebsiteLocalization(parsed.localization, parsed.language || prefs.language));

    if (normalizedLoad.kind === 'pages') {
      setPages(normalizedPages);
      setActivePageId(normalizedLoad.activePageId);
      setHomePageId(normalizedLoad.homePageId);
      setSections(normalizedSections);
    } else {
      setSections(normalizedSections);
      setPages(normalizedPages);
      setActivePageId(normalizedLoad.activePageId);
      setHomePageId(normalizedLoad.homePageId);
    }

    setSelectedId(normalizedSections[0]?.id ?? null);
    setSelectedElementId(normalizedSections[0]?.elements[0]?.id ?? null);
    setSiteName(parsed.siteName || 'My Website');
    setSiteUrl(parsed.siteUrl || '');
    setFaviconUrl(typeof parsed.faviconUrl === 'string' ? parsed.faviconUrl : '');
    setPublishedUrl(typeof parsed.publishedUrl === 'string' ? normalizePublishedSiteUrl(parsed.publishedUrl) : '');
    setPublishedAt(typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null);
    setPreviewUrl(typeof parsed.previewUrl === 'string' ? normalizePublishedSiteUrl(parsed.previewUrl) : '');
    setPreviewToken(typeof parsed.previewToken === 'string' ? parsed.previewToken : '');
    setPreviewCreatedAt(typeof parsed.previewCreatedAt === 'string' ? parsed.previewCreatedAt : null);
    setPreviewFingerprint(typeof parsed.previewFingerprint === 'string' ? parsed.previewFingerprint : '');
    setLastPublishedVersionId(typeof parsed.lastPublishedVersionId === 'string' ? parsed.lastPublishedVersionId : null);
    setLastPublishedFingerprint(typeof parsed.lastPublishedFingerprint === 'string' ? parsed.lastPublishedFingerprint : '');
    setLiveVerification('idle');
    setPublishError('');
    setPreviewError('');
    if (parsed.brand) setBrand(parsed.brand);
    setTheme(normalizeTheme(parsed.theme));
    setHeaderConfig(normalizeHeaderConfig(parsed.headerConfig));
    setFooterConfig(normalizeFooterConfig(parsed.footerConfig));
    setSiteEnhancements(normalizeSiteEnhancements(parsed.siteEnhancements));
    setProductionConfig(normalizeProductionConfig(parsed.productionConfig));
    setDeliveryConfig(normalizeDeliveryConfig(parsed.deliveryConfig));
    setSymbols(Array.isArray(parsed.symbols) ? parsed.symbols.filter(isWebsiteSymbol).slice(0, 50) : []);
    if (parsed.seo) setSeo(parsed.seo);
    if (resetEditHistory) {
      setHistory([]);
      setFuture([]);
    }
    if (loadHistory) setProjectHistory(Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : []);
    setSaved(false);
  };
}
