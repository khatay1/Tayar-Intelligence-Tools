import type { Language } from '@/context/PreferencesContext';
import { createSection } from './defaults';
import { normalizePageLanguage, normalizeSlug } from './project-identifiers';
import type { WebsiteSEO, WebsiteSection } from './types';
import type { WebsiteFooterConfig, WebsiteHeaderConfig, WebsitePage, WebsiteProductionConfig, WebsiteSiteEnhancements, WebsiteTheme } from './website-builder-model';
import { buildFullHtml, normalizeSiteUrl } from './website-builder-rendering';

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
}: WebsiteBuilderOutputDependencies) {
  function getHtml(
    pageSections: WebsiteSection[] = sections,
    pageId = activePageId,
    productionUrlOverride?: string,
    homeUsesIndexFile = false,
    trackAnalytics = false,
  ) {
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
    const page = currentPages.find((item) => item.id === pageId) || currentPages[0];
    const productionUrl = normalizeSiteUrl(productionUrlOverride ?? siteUrl);
    const filename = page?.id === homePageId ? 'index.html' : `${normalizeSlug(page?.slug || 'page')}.html`;
    const canonicalOverride = page?.canonicalUrl?.trim() ? normalizeSiteUrl(page.canonicalUrl) : '';
    const canonicalUrl = canonicalOverride || (productionUrl
      ? page?.id === homePageId
        ? homeUsesIndexFile ? `${productionUrl}/index.html` : `${productionUrl}/`
        : `${productionUrl}/${filename}`
      : '');
    const baseTitle = seo.title.trim() || siteName;
    const defaultPageTitle = page?.id === homePageId ? baseTitle : `${page?.name || 'Page'} | ${baseTitle}`;
    const pageTitle = page?.seoTitle?.trim() || defaultPageTitle;
    const pageDescription = page?.seoDescription?.trim() || seo.description.trim();
    const pageLanguage = normalizePageLanguage(page?.language, preferredLanguage);
    const translationKey = page?.translationKey?.trim();
    const translationPages = translationKey ? currentPages.filter((item) => item.translationKey?.trim() === translationKey) : [];
    const alternateLinks = productionUrl && translationPages.length > 1
      ? translationPages.map((item, index) => ({
          language: normalizePageLanguage(item.language, preferredLanguage),
          href: item.id === homePageId
            ? homeUsesIndexFile ? `${productionUrl}/index.html` : `${productionUrl}/`
            : `${productionUrl}/${normalizeSlug(item.slug)}.html`,
          isDefault: index === 0,
        }))
      : [];

    return buildFullHtml(pageSections, {
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
      headerConfig,
      footerConfig,
      siteEnhancements,
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
    const currentPages = pages.map((page) => page.id === activePageId ? { ...page, sections } : page);
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

  return { getHtml, get404Html };
}
