import type { Language } from '@/context/PreferencesContext';
import type { WebsitePage } from './website-builder-model';
import type { WebsiteLocalizationConfig } from './website-localization';
import {
  createEditorLocalizationConfig,
  normalizeEditorLocaleCode,
  type EditorLocalizationConfig,
  type EditorLocaleDefinition,
  type EditorLocalizedPageContent,
} from './editor-localization';

export const EDITOR_LOCALIZATION_SCHEMA_VERSION = 1;

export interface EditorLocalizationEnvelope {
  version: number;
  config: EditorLocalizationConfig;
}

function cleanLocale(locale: EditorLocaleDefinition): EditorLocaleDefinition {
  return {
    ...locale,
    code: normalizeEditorLocaleCode(locale.code),
    fallbackLocale: locale.fallbackLocale ? normalizeEditorLocaleCode(locale.fallbackLocale) : undefined,
    slugPrefix: locale.slugPrefix?.replace(/^\/+|\/+$/g, ''),
    domain: locale.domain?.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '') || undefined,
    subdomain: locale.subdomain?.trim().replace(/^\.+|\.+$/g, '') || undefined,
  };
}

export function normalizeEditorLocalizationConfig(value: unknown): EditorLocalizationConfig {
  const fallback = createEditorLocalizationConfig('en');
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<EditorLocalizationConfig>;
  const locales = Array.isArray(source.locales)
    ? source.locales.filter((item): item is EditorLocaleDefinition => !!item && typeof item.code === 'string').map(cleanLocale)
    : fallback.locales;
  const defaultLocale = normalizeEditorLocaleCode(typeof source.defaultLocale === 'string' ? source.defaultLocale : fallback.defaultLocale);
  if (!locales.some(locale => locale.code === defaultLocale)) locales.unshift({ ...fallback.locales[0], code: defaultLocale, enabled: true });
  return {
    defaultLocale,
    locales: locales.map(locale => locale.code === defaultLocale ? { ...locale, enabled: true } : locale),
    pageContent: source.pageContent && typeof source.pageContent === 'object' ? source.pageContent : {},
  };
}

export function serializeEditorLocalization(config: EditorLocalizationConfig): EditorLocalizationEnvelope {
  return { version: EDITOR_LOCALIZATION_SCHEMA_VERSION, config: normalizeEditorLocalizationConfig(config) };
}

export function deserializeEditorLocalization(value: unknown): EditorLocalizationConfig {
  if (value && typeof value === 'object' && 'config' in value) return normalizeEditorLocalizationConfig((value as Partial<EditorLocalizationEnvelope>).config);
  return normalizeEditorLocalizationConfig(value);
}

/** Migrates the established page-per-locale model into the MAX workspace. */
export function createEditorLocalizationFromWebsiteProject(
  localization: WebsiteLocalizationConfig | null | undefined,
  pages: Pick<WebsitePage, 'id' | 'name' | 'slug' | 'language' | 'translationKey' | 'seoTitle' | 'seoDescription' | 'canonicalUrl'>[],
  fallbackLanguage: Language = 'en',
): EditorLocalizationConfig {
  const defaultLocale = localization?.defaultLanguage ?? fallbackLanguage;
  const config = createEditorLocalizationConfig(defaultLocale);
  const usedLanguages = new Set<string>([defaultLocale]);
  const pageContent: EditorLocalizationConfig['pageContent'] = {};

  for (const page of pages) {
    const locale = normalizeEditorLocaleCode(page.language ?? defaultLocale);
    usedLanguages.add(locale);
    const sourcePageId = page.translationKey?.trim() || page.id;
    pageContent[sourcePageId] = {
      ...(pageContent[sourcePageId] ?? {}),
      [locale]: {
        locale,
        name: page.name,
        slug: page.slug,
        values: {},
        seo: {
          title: page.seoTitle,
          description: page.seoDescription,
          canonical: page.canonicalUrl,
        },
      },
    };
  }

  return normalizeEditorLocalizationConfig({
    ...config,
    defaultLocale,
    locales: config.locales.map(locale => ({
      ...locale,
      enabled: locale.code === defaultLocale || usedLanguages.has(locale.code),
      slugPrefix: localization?.routeStrategy === 'subdirectory' && locale.code !== defaultLocale ? locale.code : undefined,
    })),
    pageContent,
  });
}

/** Synchronizes MAX settings back to the canonical persisted/runtime config. */
export function websiteLocalizationFromEditorConfig(
  config: EditorLocalizationConfig,
  previous?: WebsiteLocalizationConfig | null,
): WebsiteLocalizationConfig {
  const normalized = normalizeEditorLocalizationConfig(config);
  const defaultLanguage: Language = normalized.defaultLocale === 'ar' || normalized.defaultLocale === 'sv'
    ? normalized.defaultLocale
    : 'en';
  const enabledNonDefault = normalized.locales.filter(locale => locale.enabled && locale.code !== normalized.defaultLocale);
  const routeStrategy = enabledNonDefault.some(locale => (locale.slugPrefix ?? locale.code).length > 0)
    ? 'subdirectory'
    : (previous?.routeStrategy ?? 'flat');
  return { defaultLanguage, routeStrategy };
}

export function setEditorLocalizedPageContent(config: EditorLocalizationConfig, pageId: string, localeCode: string, patch: Partial<EditorLocalizedPageContent>): EditorLocalizationConfig {
  const locale = normalizeEditorLocaleCode(localeCode);
  const current = config.pageContent[pageId]?.[locale] ?? { locale, values: {} };
  return {
    ...config,
    pageContent: {
      ...config.pageContent,
      [pageId]: {
        ...(config.pageContent[pageId] ?? {}),
        [locale]: { ...current, ...patch, locale, updatedAt: new Date().toISOString() },
      },
    },
  };
}

export function removeEditorLocalizedPage(config: EditorLocalizationConfig, pageId: string): EditorLocalizationConfig {
  const pageContent = { ...config.pageContent };
  delete pageContent[pageId];
  return { ...config, pageContent };
}

export function duplicateEditorLocalizedPage(config: EditorLocalizationConfig, sourcePageId: string, targetPageId: string): EditorLocalizationConfig {
  const source = config.pageContent[sourcePageId];
  if (!source) return config;
  return { ...config, pageContent: { ...config.pageContent, [targetPageId]: structuredClone(source) } };
}
