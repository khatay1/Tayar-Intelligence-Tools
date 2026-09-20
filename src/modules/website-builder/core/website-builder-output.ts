import type { Language } from '@/context/PreferencesContext';
import { createSection } from './defaults';
import { normalizePageLanguage, normalizeSlug } from './project-identifiers';
import type { WebsiteSEO, WebsiteSection } from './types';
import type { WebsiteFooterConfig, WebsiteHeaderConfig, WebsitePage, WebsiteProductionConfig, WebsiteSiteEnhancements, WebsiteTheme } from './website-builder-model';
import { buildFullHtml, normalizeSiteUrl } from './website-builder-rendering';
import { expandWebsiteCmsPages, materializeWebsiteCmsSections, type WebsiteCmsState } from './website-cms';
import {
  normalizeWebsiteLocalization,
  relativeWebsitePageHref,
  websitePageOutputPath,
  websitePathUrl,
  type WebsiteLocalizationConfig,
} from './website-localization';

export interface WebsiteBuilderOutputDependencies {
  pages: WebsitePage[];
  sections: WebsiteSection[];
  activePageId: string;
  homePageId: string;
  siteUrl: string;
  siteName: string;
  faviconUrl: string;
  seo: WebsiteSEO;
  theme: WebsiteTheme;
  headerConfig: WebsiteHeaderConfig;
  footerConfig: WebsiteFooterConfig;
  siteEnhancements: WebsiteSiteEnhancements;
  productionConfig: WebsiteProductionConfig;
  preferredLanguage: Language;
  cloudProjectId: string | null;
  supabaseUrl: string;
  supabaseAnonKey: string;
  cms: WebsiteCmsState;
  localization: WebsiteLocalizationConfig;
}

export function createWebsiteBuilderOutput({
  pages,
  sections,
  activePageId,
  homePageId,
  siteUrl,
  siteName,
  faviconUrl,
  seo,
  theme,
  headerConfig,
  footerConfig,
  siteEnhancements,
  productionConfig,
  preferredLanguage,
  cloudProjectId,
  supabaseUrl,
  supabaseAnonKey,
  cms,
  localization,
}: WebsiteBuilderOutputDependencies) {
  const normalizedLocalization = normalizeWebsiteLocalization(localization, preferredLanguage);
  const sourcePages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
  const expandedPages = expandWebsiteCmsPages(sourcePages, cms).map((page) => ({ ...page, language: normalizePageLanguage(page.language, normalizedLocalization.defaultLanguage) }));
  const outputPages = expandedPages.map((page) => ({
    ...page,
    outputPath: websitePageOutputPath(page, expandedPages, homePageId, normalizedLocalization),
  }));

  function filenameForPage(page: WebsitePage): string {
    return page.outputPath || websitePageOutputPath(page, outputPages, homePageId, normalizedLocalization);
  }

  function getHtml(
    pageSections: WebsiteSection[] = sections,
    pageId = activePageId,
    productionUrlOverride?: string,
    homeUsesIndexFile = false,
    trackAnalytics = false,
  ) {
    const currentPages = outputPages.map((page) => page.id === pageId
      ? { ...page, sections: materializeWebsiteCmsSections(pageSections, cms) }
      : page);
    const page = currentPages.find((item) => item.id === pageId) || currentPages[0];
    const productionUrl = normalizeSiteUrl(productionUrlOverride ?? siteUrl);
    const filename = page ? filenameForPage(page) : 'index.html';
    const canonicalOverride = page?.canonicalUrl?.trim() ? normalizeSiteUrl(page.canonicalUrl) : '';
    const canonicalUrl = canonicalOverride || (productionUrl
      ? websitePathUrl(productionUrl, filename, homeUsesIndexFile)
      : '');
    const baseTitle = seo.title.trim() || siteName;
    const defaultPageTitle = page?.id === homePageId ? baseTitle : `${page?.name || 'Page'} | ${baseTitle}`;
    const pageTitle = page?.seoTitle?.trim() || defaultPageTitle;
    const pageDescription = page?.seoDescription?.trim() || seo.description.trim();
    const pageLanguage = normalizePageLanguage(page?.language, preferredLanguage);
    const translationKey = page?.translationKey?.trim();
    const translationPages = translationKey ? currentPages.filter((item) => item.translationKey?.trim() === translationKey) : [];
    const alternateLinks = productionUrl && translationPages.length > 1
      ? translationPages.map((item) => ({
          language: normalizePageLanguage(item.language, preferredLanguage),
          href: websitePathUrl(productionUrl, filenameForPage(item), homeUsesIndexFile),
          isDefault: item.id === (translationPages.find((candidate) => candidate.language === normalizedLocalization.defaultLanguage) || translationPages[0]).id,
        }))
      : [];

    const resolveLink = (value: string) => {
      if (!value.startsWith('page:')) return value;
      const matches = currentPages.filter((candidate) => normalizeSlug(candidate.slug) === normalizeSlug(value.slice(5)));
      const target = matches.find((candidate) => candidate.language === pageLanguage) || matches[0];
      return target ? relativeWebsitePageHref(filename, filenameForPage(target)) : value;
    };
    const localizeLinks = <T,>(value: T): T => {
      if (Array.isArray(value)) return value.map(localizeLinks) as T;
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
        typeof item === 'string' && ['href', 'buttonUrl', 'formRedirectUrl', 'ctaHref', 'announcementHref', 'popupButtonHref', 'floatingCtaHref'].includes(key)
          ? resolveLink(item) : localizeLinks(item),
      ])) as T;
    };
    return buildFullHtml(localizeLinks(page?.sections || pageSections), {
      language: pageLanguage,
      title: pageTitle,
      description: pageDescription,
      keywords: seo.keywords,
      canonicalUrl,
      faviconUrl: faviconUrl.trim(),
      socialImageUrl: page?.socialImage?.trim() || '',
      noIndex: page?.noIndex === true,
      alternateLinks,
      theme,
      headerConfig: localizeLinks(headerConfig),
      footerConfig,
      siteEnhancements: localizeLinks(siteEnhancements),
      productionConfig: productionConfig,
      pages: currentPages,
      homePageId,
      currentPageId: pageId,
      siteName,
      leadProjectId: trackAnalytics ? cloudProjectId : null,
      analyticsProjectId: cloudProjectId,
      analyticsEnabled: trackAnalytics,
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
    });
  }

  function get404Html(productionUrlOverride?: string, homeUsesIndexFile = false, trackAnalytics = false) {
    const productionUrl = normalizeSiteUrl(productionUrlOverride ?? siteUrl);
    const homeHref = productionUrl
      ? homeUsesIndexFile ? `${productionUrl}/index.html` : `${productionUrl}/`
      : 'index.html';
    const notFoundSection = createSection('hero');
    notFoundSection.title = 'Page not found';
    notFoundSection.description = 'The page you are looking for does not exist or may have moved.';
    notFoundSection.buttonText = 'Back to Home';
    notFoundSection.buttonUrl = homeHref;
    notFoundSection.elements = notFoundSection.elements.map((element) => {
      if (element.type === 'heading') return { ...element, content: '404 — Page not found' };
      if (element.type === 'text') return { ...element, content: 'The page you are looking for does not exist or may have moved.' };
      if (element.type === 'button') return { ...element, content: 'Back to Home', href: homeHref };
      return element;
    });
    const currentPages = outputPages;
    const homeLanguage = normalizePageLanguage(currentPages.find((page) => page.id === homePageId)?.language, preferredLanguage);
    return buildFullHtml([notFoundSection], {
      language: homeLanguage,
      title: `404 | ${seo.title.trim() || siteName}`,
      description: 'Page not found.',
      keywords: [],
      faviconUrl: faviconUrl.trim(),
      noIndex: true,
      theme,
      headerConfig,
      footerConfig,
      siteEnhancements,
      productionConfig: productionConfig,
      pages: currentPages,
      homePageId,
      currentPageId: '__404__',
      siteName,
      analyticsProjectId: cloudProjectId,
      analyticsEnabled: trackAnalytics,
      supabaseUrl: supabaseUrl,
      supabaseAnonKey: supabaseAnonKey,
    });
  }

  return { getHtml, get404Html, pages: outputPages, filenameForPage };
}
