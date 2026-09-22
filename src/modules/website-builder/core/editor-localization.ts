export type EditorTextDirection = 'ltr' | 'rtl';

export interface EditorLocaleDefinition {
  code: string;
  label: string;
  nativeLabel: string;
  direction: EditorTextDirection;
  enabled: boolean;
  fallbackLocale?: string;
  slugPrefix?: string;
  domain?: string;
  subdomain?: string;
}

export interface EditorLocalizedSeo {
  title?: string;
  description?: string;
  canonical?: string;
  openGraphTitle?: string;
  openGraphDescription?: string;
}

export interface EditorLocalizedPageContent {
  locale: string;
  slug?: string;
  name?: string;
  seo?: EditorLocalizedSeo;
  values: Record<string, string>;
  updatedAt?: string;
  translatedBy?: 'manual' | 'ai';
}

export interface EditorLocalizationConfig {
  defaultLocale: string;
  locales: EditorLocaleDefinition[];
  pageContent: Record<string, Record<string, EditorLocalizedPageContent>>;
}

export const DEFAULT_EDITOR_LOCALES: EditorLocaleDefinition[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', direction: 'ltr', enabled: true },
  { code: 'sv', label: 'Swedish', nativeLabel: 'Svenska', direction: 'ltr', enabled: false, fallbackLocale: 'en' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية', direction: 'rtl', enabled: false, fallbackLocale: 'en' },
];

export function normalizeEditorLocaleCode(value: string) {
  return value.trim().replace('_', '-').toLowerCase();
}

export function findEditorLocale(config: EditorLocalizationConfig, locale: string) {
  const normalized = normalizeEditorLocaleCode(locale);
  return config.locales.find(item => normalizeEditorLocaleCode(item.code) === normalized);
}

export function resolveEditorLocale(config: EditorLocalizationConfig, requested?: string) {
  const enabled = config.locales.filter(locale => locale.enabled);
  const requestedLocale = requested ? findEditorLocale(config, requested) : undefined;
  if (requestedLocale?.enabled) return requestedLocale;
  const defaultLocale = findEditorLocale(config, config.defaultLocale);
  if (defaultLocale?.enabled) return defaultLocale;
  return enabled[0] ?? config.locales[0] ?? DEFAULT_EDITOR_LOCALES[0];
}

export function buildEditorLocaleFallbackChain(config: EditorLocalizationConfig, requested: string) {
  const chain: string[] = [];
  const visited = new Set<string>();
  let current = findEditorLocale(config, requested);
  while (current && !visited.has(current.code)) {
    visited.add(current.code);
    chain.push(current.code);
    current = current.fallbackLocale ? findEditorLocale(config, current.fallbackLocale) : undefined;
  }
  if (!chain.includes(config.defaultLocale)) chain.push(config.defaultLocale);
  return chain;
}

export function resolveEditorLocalizedPageContent(config: EditorLocalizationConfig, pageId: string, requested: string) {
  const localized = config.pageContent[pageId] ?? {};
  for (const locale of buildEditorLocaleFallbackChain(config, requested)) {
    if (localized[locale]) return localized[locale];
  }
  return undefined;
}

export function buildEditorLocalizedPath(config: EditorLocalizationConfig, pageId: string, localeCode: string, defaultSlug = '') {
  const locale = resolveEditorLocale(config, localeCode);
  const content = resolveEditorLocalizedPageContent(config, pageId, locale.code);
  const slug = (content?.slug ?? defaultSlug).replace(/^\/+|\/+$/g, '');
  const prefix = locale.code === config.defaultLocale ? '' : (locale.slugPrefix ?? locale.code).replace(/^\/+|\/+$/g, '');
  return `/${[prefix, slug].filter(Boolean).join('/')}`.replace(/\/{2,}/g, '/');
}

export function buildEditorLocaleHrefLang(config: EditorLocalizationConfig, pageId: string, defaultSlug = '') {
  return config.locales.filter(locale => locale.enabled).map(locale => ({
    locale: locale.code,
    hrefLang: locale.code,
    path: buildEditorLocalizedPath(config, pageId, locale.code, defaultSlug),
  }));
}

export function resolveEditorLocaleHost(locale: EditorLocaleDefinition, rootDomain?: string) {
  if (locale.domain) return locale.domain;
  if (locale.subdomain && rootDomain) return `${locale.subdomain}.${rootDomain}`;
  return rootDomain;
}

export function createEditorLocalizationConfig(defaultLocale = 'en'): EditorLocalizationConfig {
  return { defaultLocale, locales: DEFAULT_EDITOR_LOCALES.map(locale => ({ ...locale, enabled: locale.code === defaultLocale || locale.enabled })), pageContent: {} };
}
