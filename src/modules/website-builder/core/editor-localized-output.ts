import type { EditorPageLike, EditorProjectLike } from './editor-model';
import { buildEditorPageMeta } from './editor-seo-model';
import type { EditorPublishPlan } from './editor-publishing';
import {
  buildEditorLocaleHrefLang,
  buildEditorLocalizedPath,
  resolveEditorLocale,
  resolveEditorLocaleHost,
  resolveEditorLocalizedPageContent,
  type EditorLocalizationConfig,
} from './editor-localization';

export interface EditorLocalizedRoute {
  pageId: string;
  locale: string;
  direction: 'ltr' | 'rtl';
  path: string;
  host?: string;
  url?: string;
}

export interface EditorLocalizedPageOutput {
  route: EditorLocalizedRoute;
  name: string;
  values: Record<string, string>;
  meta: ReturnType<typeof buildEditorPageMeta> & {
    alternates: Array<{ hrefLang: string; href: string }>;
  };
}

function pageSlug(page: EditorPageLike) {
  const value = (page as EditorPageLike & { slug?: string }).slug;
  return typeof value === 'string' ? value : '';
}

function absoluteLocalizedHref(host: string | undefined, path: string) {
  if (!host) return path;
  const normalizedHost = host.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return `https://${normalizedHost}${path}`;
}

export function buildEditorLocalizedRoute(config: EditorLocalizationConfig, page: EditorPageLike, localeCode: string, rootDomain?: string): EditorLocalizedRoute {
  const locale = resolveEditorLocale(config, localeCode);
  const path = buildEditorLocalizedPath(config, page.id, locale.code, pageSlug(page));
  const host = resolveEditorLocaleHost(locale, rootDomain);
  return { pageId: page.id, locale: locale.code, direction: locale.direction, path, host, url: host ? absoluteLocalizedHref(host, path) : undefined };
}

export function buildEditorLocalizedPageOutput(project: EditorProjectLike, page: EditorPageLike, config: EditorLocalizationConfig, localeCode: string, rootDomain?: string): EditorLocalizedPageOutput {
  const route = buildEditorLocalizedRoute(config, page, localeCode, rootDomain);
  const content = resolveEditorLocalizedPageContent(config, page.id, route.locale);
  const baseMeta = buildEditorPageMeta(page, project);
  const localizedSeo = content?.seo;
  const title = localizedSeo?.title || content?.name || baseMeta.title;
  const description = localizedSeo?.description || baseMeta.description;
  const canonical = localizedSeo?.canonical || route.url || baseMeta.canonical;
  const alternates = buildEditorLocaleHrefLang(config, page.id, pageSlug(page)).map(item => {
    const locale = resolveEditorLocale(config, item.locale);
    const host = resolveEditorLocaleHost(locale, rootDomain);
    return { hrefLang: item.hrefLang, href: absoluteLocalizedHref(host, item.path) };
  });
  return {
    route,
    name: content?.name || String(page.name || ''),
    values: content?.values || {},
    meta: {
      ...baseMeta,
      title,
      description,
      canonical,
      openGraph: {
        ...baseMeta.openGraph,
        title: localizedSeo?.openGraphTitle || title,
        description: localizedSeo?.openGraphDescription || description,
      },
      twitter: { ...baseMeta.twitter, title, description },
      alternates,
    },
  };
}

export function buildEditorLocalizedPublishManifest(project: EditorProjectLike, config: EditorLocalizationConfig, plan: EditorPublishPlan, rootDomain?: string) {
  const allowed = new Set(plan.pageIds);
  const enabledLocales = config.locales.filter(locale => locale.enabled);
  return project.pages.filter(page => allowed.has(page.id)).flatMap(page => enabledLocales.map(locale => buildEditorLocalizedRoute(config, page, locale.code, rootDomain)));
}

export function validateEditorLocalizationForPublish(project: EditorProjectLike, config: EditorLocalizationConfig, plan: EditorPublishPlan) {
  const errors: string[] = [];
  const enabledLocales = config.locales.filter(locale => locale.enabled);
  if (!enabledLocales.length) errors.push('Enable at least one locale before publishing.');
  if (!enabledLocales.some(locale => locale.code === config.defaultLocale)) errors.push('The default locale must be enabled.');
  const seen = new Set<string>();
  for (const route of buildEditorLocalizedPublishManifest(project, config, plan)) {
    const key = `${route.host || ''}${route.path}`.toLowerCase();
    if (seen.has(key)) errors.push(`Duplicate localized route: ${route.host || ''}${route.path}`);
    seen.add(key);
  }
  return errors;
}
