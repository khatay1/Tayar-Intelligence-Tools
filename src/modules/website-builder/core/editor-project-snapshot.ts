import type { Language } from '@/context/PreferencesContext';
import type { WebsiteDeliveryConfig } from './delivery-config';
import type { WebsiteBrand, WebsiteSEO } from './types';
import type {
  WebsiteFooterConfig, WebsiteHeaderConfig, WebsitePage,
  WebsiteProductionConfig, WebsiteSiteEnhancements, WebsiteSymbol, WebsiteTheme,
} from './website-builder-model';
import type { WebsiteCmsState } from './website-cms';
import type { WebsiteLocalizationConfig } from './website-localization';
import type { ApplicationDefinition } from './application-model';

export interface EditorProjectSnapshotValues {
  cloudProjectId: string | null;
  siteName: string;
  siteUrl: string;
  faviconUrl: string;
  publishedUrl: string;
  publishedAt: string | null;
  previewUrl: string;
  previewToken: string;
  previewCreatedAt: string | null;
  previewFingerprint: string;
  lastPublishedVersionId: string | null;
  lastPublishedFingerprint: string;
  activePageId: string;
  homePageId: string;
  pages: WebsitePage[];
  cms: WebsiteCmsState;
  application?: ApplicationDefinition;
  localization: WebsiteLocalizationConfig;
  brand: WebsiteBrand;
  theme: WebsiteTheme;
  headerConfig: WebsiteHeaderConfig;
  footerConfig: WebsiteFooterConfig;
  siteEnhancements: WebsiteSiteEnhancements;
  productionConfig: WebsiteProductionConfig;
  deliveryConfig: WebsiteDeliveryConfig;
  symbols: WebsiteSymbol[];
  seo: WebsiteSEO;
  language: Language;
}

export function createEditorProjectSnapshot(values: EditorProjectSnapshotValues) {
  return { version: values.application ? 7 : 6, ...values, updatedAt: new Date().toISOString() };
}

export function fingerprintEditorProject(values: EditorProjectSnapshotValues) {
  return JSON.stringify({
    siteName: values.siteName,
    siteUrl: values.siteUrl,
    faviconUrl: values.faviconUrl,
    publishedUrl: values.publishedUrl,
    publishedAt: values.publishedAt,
    previewUrl: values.previewUrl,
    previewToken: values.previewToken,
    previewCreatedAt: values.previewCreatedAt,
    previewFingerprint: values.previewFingerprint,
    lastPublishedVersionId: values.lastPublishedVersionId,
    lastPublishedFingerprint: values.lastPublishedFingerprint,
    activePageId: values.activePageId,
    homePageId: values.homePageId,
    pages: values.pages,
    cms: values.cms,
    application: values.application,
    localization: values.localization,
    brand: values.brand,
    theme: values.theme,
    headerConfig: values.headerConfig,
    footerConfig: values.footerConfig,
    siteEnhancements: values.siteEnhancements,
    productionConfig: values.productionConfig,
    deliveryConfig: values.deliveryConfig,
    symbols: values.symbols,
    seo: values.seo,
    language: values.language,
  });
}

export function fingerprintEditableProject(values: EditorProjectSnapshotValues) {
  return JSON.stringify({
    siteName: values.siteName,
    siteUrl: values.siteUrl,
    faviconUrl: values.faviconUrl,
    homePageId: values.homePageId,
    pages: values.pages,
    cms: values.cms,
    application: values.application,
    localization: values.localization,
    brand: values.brand,
    theme: values.theme,
    headerConfig: values.headerConfig,
    footerConfig: values.footerConfig,
    siteEnhancements: values.siteEnhancements,
    productionConfig: values.productionConfig,
    symbols: values.symbols,
    seo: values.seo,
    language: values.language,
  });
}
