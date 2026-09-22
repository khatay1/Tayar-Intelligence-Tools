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

function cleanText(value: unknown, max = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().slice(0, max);
  return cleaned || undefined;
}

function cleanLocale(locale: EditorLocaleDefinition): EditorLocaleDefinition {
  const code = normalizeEditorLocaleCode(locale.code).slice(0, 35) || 'en';
  const fallbackLocale = locale.fallbackLocale ? normalizeEditorLocaleCode(locale.fallbackLocale).slice(0, 35) : undefined;
  return {
    ...locale,
    code,
    label: cleanText(locale.label, 80) ?? code,
    nativeLabel: cleanText(locale.nativeLabel, 80) ?? cleanText(locale.label, 80) ?? code,
    direction: locale.direction === 'rtl' ? 'rtl' : 'ltr',
    enabled: locale.enabled === true,
    fallbackLocale: fallbackLocale && fallbackLocale !== code ? fallbackLocale : undefined,
    slugPrefix: cleanText(locale.slugPrefix?.replace(/^\/+|\/+$/g, ''), 120),
    domain: cleanText(locale.domain?.replace(/^https?:\/\//i, '').replace(/\/$/, ''), 253),
    subdomain: cleanText(locale.subdomain?.replace(/^\.+|\.+$/g, ''), 63),
  };
}

function cleanPageContent(value: unknown, knownLocales: Set<string>): EditorLocalizationConfig['pageContent'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: EditorLocalizationConfig['pageContent'] = {};
  for (const [pageId, rawLocales] of Object.entries(value as Record<string, unknown>)) {
    if (!pageId || !rawLocales || typeof rawLocales !== 'object' || Array.isArray(rawLocales)) continue;
    const localized: Record<string, EditorLocalizedPageContent> = {};
    for (const [rawCode, rawContent] of Object.entries(rawLocales as Record<string, unknown>)) {
      if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) continue;
      const code = normalizeEditorLocaleCode(rawCode).slice(0, 35);
      if (!code || !knownLocales.has(code)) continue;
      const source = rawContent as Partial<EditorLocalizedPageContent>;
      const rawValues = source.values && typeof source.values === 'object' && !Array.isArray(source.values) ? source.values : {};
      const values = Object.fromEntries(Object.entries(rawValues).filter((entry): entry is [string, string] => typeof entry[1] === 'string').map(([key, text]) => [key.slice(0, 200), text.slice(0, 20_000)]));
      const seo = source.seo && typeof source.seo === 'object' ? {
        title: cleanText(source.seo.title, 300),
        description: cleanText(source.seo.description, 1000),
        canonical: cleanText(source.seo.canonical, 2000),
        openGraphTitle: cleanText(source.seo.openGraphTitle, 300),
        openGraphDescription: cleanText(source.seo.openGraphDescription, 1000),
      } : undefined;
      localized[code] = {
        locale: code,
        name: cleanText(source.name, 200),
        slug: cleanText(source.slug?.replace(/^\/+|\/+$/g, ''), 240),
        values,
        seo,
        updatedAt: cleanText(source.updatedAt, 80),
        translatedBy: source.translatedBy === 'ai' ? 'ai' : source.translatedBy === 'manual' ? 'manual' : undefined,
      };
    }
    if (Object.keys(localized).length) result[pageId.slice(0, 200)] = localized;
  }
  return result;
}

export function normalizeEditorLocalizationConfig(value: unknown): EditorLocalizationConfig {
  const fallback = createEditorLocalizationConfig('en');
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const source = value as Partial<EditorLocalizationConfig>;
  const rawLocales = Array.isArray(source.locales)
    ? source.locales.filter((item): item is EditorLocaleDefinition => !!item && typeof item === 'object' && typeof item.code === 'string').map(cleanLocale)
    : fallback.locales.map(cleanLocale);
  const locales = Array.from(new Map(rawLocales.map(locale => [locale.code, locale])).values());
  const requestedDefault = normalizeEditorLocaleCode(typeof source.defaultLocale === 'string' ? source.defaultLocale : fallback.defaultLocale).slice(0, 35) || 'en';
  if (!locales.some(locale => locale.code === requestedDefault)) {
    const preset = fallback.locales.find(locale => locale.code === requestedDefault);
    locales.unshift(cleanLocale(preset ?? { ...fallback.locales[0], code: requestedDefault, label: requestedDefault, nativeLabel: requestedDefault, enabled: true }));
  }
  const knownLocales = new Set(locales.map(locale => locale.code));
  const normalizedLocales = locales.map(locale => ({
    ...locale,
    enabled: locale.code === requestedDefault ? true : locale.enabled,
    fallbackLocale: locale.fallbackLocale && knownLocales.has(locale.fallbackLocale) && locale.fallbackLocale !== locale.code ? locale.fallbackLocale : undefined,
  }));
  return {
    defaultLocale: requestedDefault,
    locales: normalizedLocales,
    pageContent: cleanPageContent(source.pageContent, knownLocales),
  };
}

export function serializeEditorLocalization(config: EditorLocalizationConfig): EditorLocalizationEnvelope {
  return { version: EDITOR_LOCALIZATION_SCHEMA_VERSION, config: normalizeEditorLocalizationConfig(config) };
}

export function deserializeEditorLocalization(value: unknown): EditorLocalizationConfig {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'config' in value) return normalizeEditorLocalizationConfig((value as Partial<EditorLocalizationEnvelope>).config);
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
  return normalizeEditorLocalizationConfig({
    ...config,
    pageContent: {
      ...config.pageContent,
      [pageId]: {
        ...(config.pageContent[pageId] ?? {}),
        [locale]: { ...current, ...patch, locale, updatedAt: new Date().toISOString() },
      },
    },
  });
}

export function removeEditorLocalizedPage(config: EditorLocalizationConfig, pageId: string): EditorLocalizationConfig {
  const pageContent = { ...config.pageContent };
  delete pageContent[pageId];
  return { ...config, pageContent };
}

export function duplicateEditorLocalizedPage(config: EditorLocalizationConfig, sourcePageId: string, targetPageId: string): EditorLocalizationConfig {
  const source = config.pageContent[sourcePageId];
  if (!source) return config;
  return normalizeEditorLocalizationConfig({ ...config, pageContent: { ...config.pageContent, [targetPageId]: structuredClone(source) } });
}
