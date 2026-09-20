import type { Language } from '@/context/PreferencesContext';
import { normalizePageLanguage, normalizeSlug } from './project-identifiers';
import type { WebsitePage } from './website-builder-model';

export type WebsiteLocaleRouteStrategy = 'flat' | 'subdirectory';

export interface WebsiteLocalizationConfig {
  defaultLanguage: Language;
  routeStrategy: WebsiteLocaleRouteStrategy;
}

export const DEFAULT_WEBSITE_LOCALIZATION: WebsiteLocalizationConfig = {
  defaultLanguage: 'en',
  routeStrategy: 'subdirectory',
};

export function normalizeWebsiteLocalization(
  value: Partial<WebsiteLocalizationConfig> | null | undefined,
  fallbackLanguage: Language = 'en',
): WebsiteLocalizationConfig {
  const defaultLanguage = value?.defaultLanguage === 'ar' || value?.defaultLanguage === 'sv' || value?.defaultLanguage === 'en'
    ? value.defaultLanguage
    : fallbackLanguage;

  return {
    defaultLanguage,
    routeStrategy: value?.routeStrategy === 'subdirectory' ? 'subdirectory' : 'flat',
  };
}

function isLocalizedHome(page: WebsitePage, pages: WebsitePage[], homePageId: string): boolean {
  if (page.id === homePageId) return true;
  const home = pages.find((item) => item.id === homePageId);
  const homeTranslationKey = home?.translationKey?.trim();
  return Boolean(homeTranslationKey && page.translationKey?.trim() === homeTranslationKey);
}

export function websitePageOutputPath(
  page: WebsitePage,
  pages: WebsitePage[],
  homePageId: string,
  localization: WebsiteLocalizationConfig,
): string {
  const language = normalizePageLanguage(page.language, localization.defaultLanguage);
  const home = isLocalizedHome(page, pages, homePageId);

  if (localization.routeStrategy === 'flat') {
    return page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`;
  }

  if (page.id === homePageId) return 'index.html';
  const prefix = language === localization.defaultLanguage ? '' : `${language}/`;
  return home ? `${prefix}index.html` : `${prefix}${normalizeSlug(page.slug)}.html`;
}

export function relativeWebsitePageHref(fromPath: string, toPath: string): string {
  const fromDirectoryDepth = Math.max(0, fromPath.split('/').filter(Boolean).length - 1);
  return `${'../'.repeat(fromDirectoryDepth)}${toPath}`;
}

export function websitePathUrl(baseUrl: string, path: string, homeUsesIndexFile: boolean): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  if (!normalizedBase) return '';
  if (path === 'index.html' && !homeUsesIndexFile) return `${normalizedBase}/`;
  return `${normalizedBase}/${path}`;
}

export interface WebsiteLocalizationIssue {
  code: 'duplicate-route' | 'duplicate-language' | 'missing-default-translation';
  message: string;
  pageIds: string[];
}

export function validateWebsiteLocalization(
  pages: WebsitePage[],
  homePageId: string,
  localization: WebsiteLocalizationConfig,
): WebsiteLocalizationIssue[] {
  const issues: WebsiteLocalizationIssue[] = [];
  const routes = new Map<string, string[]>();

  pages.forEach((page) => {
    const path = websitePageOutputPath(page, pages, homePageId, localization);
    routes.set(path, [...(routes.get(path) || []), page.id]);
  });
  routes.forEach((pageIds, path) => {
    if (pageIds.length > 1) issues.push({ code: 'duplicate-route', message: `Multiple pages resolve to ${path}.`, pageIds });
  });

  const groups = new Map<string, WebsitePage[]>();
  pages.forEach((page) => {
    const key = page.translationKey?.trim();
    if (key) groups.set(key, [...(groups.get(key) || []), page]);
  });
  groups.forEach((group) => {
    const byLanguage = new Map<Language, string[]>();
    group.forEach((page) => {
      const language = normalizePageLanguage(page.language, localization.defaultLanguage);
      byLanguage.set(language, [...(byLanguage.get(language) || []), page.id]);
    });
    byLanguage.forEach((pageIds, language) => {
      if (pageIds.length > 1) issues.push({ code: 'duplicate-language', message: `Translation group has more than one ${language} page.`, pageIds });
    });
    if (!byLanguage.has(localization.defaultLanguage)) {
      issues.push({ code: 'missing-default-translation', message: `Translation group is missing its ${localization.defaultLanguage} default page.`, pageIds: group.map((page) => page.id) });
    }
  });

  return issues;
}
