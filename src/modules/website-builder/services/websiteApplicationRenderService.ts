import { createWebsiteBuilderOutput } from '../core/website-builder-output';
import { normalizeSection } from '../core/defaults';
import { normalizeWebsiteCms } from '../core/website-cms';
import { normalizeWebsiteLocalization } from '../core/website-localization';
import { normalizeTheme, normalizeHeaderConfig, normalizeFooterConfig, normalizeSiteEnhancements, normalizeProductionConfig } from '../core/website-builder-config';
import { editorIntegrationPublishBlockers, readEditorIntegrationsFromProject } from '../core/editor-integrations-project-host';
import { assertValidPublishedWebsiteBundle, isValidPublishedHtml } from '../core/published-site-validation';
import type { WebsitePage } from '../core/website-builder-model';
import type { WebsiteSection } from '../core/types';
import { compileApplicationCreateForm } from '../core/application-form-runtime';
import { preparePublishedApplicationDataViews } from '../core/application-published-data-views';
import type { ApplicationDefinition } from '../core/application-model';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;

/** Render only the captured saved project with the existing editor exporter.
 * Never hydrate editor host stores on the server: they are process-global.
 * This is the HTML layer; application Auth/data/action browser wiring is separate.
 */
export async function renderWebsiteApplicationSnapshot(input: Record<string, unknown>) {
  if (typeof window !== 'undefined') throw new Error('Private release rendering requires a server runtime.');
  const snapshot = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  if (!Array.isArray(snapshot.pages) || !snapshot.pages.length || snapshot.pages.length > 100
    || typeof snapshot.homePageId !== 'string' || !snapshot.application) throw new Error('Invalid saved application pages.');
  if (editorIntegrationPublishBlockers(readEditorIntegrationsFromProject(snapshot)).length) {
    throw new Error('Published integration execution is unavailable.');
  }
  const localization = normalizeWebsiteLocalization(record(snapshot.localization) ? snapshot.localization : undefined);
  const pages: WebsitePage[] = snapshot.pages.map(page => {
    if (!record(page) || typeof page.id !== 'string' || !page.id || typeof page.slug !== 'string'
      || !Array.isArray(page.sections) || page.sections.length > 100 || page.sections.some(section => !record(section))
      || (page.language !== undefined && !['en', 'ar', 'sv'].includes(String(page.language)))) throw new Error('Invalid saved application page.');
    // Generated CMS IDs need a trusted template-to-runtime authorization mapping.
    // Refuse this case rather than omitting/reclassifying protected dynamic pages.
    if (page.cmsTemplate) throw new Error('Private CMS route mapping is unavailable.');
    preparePublishedApplicationDataViews(snapshot.application as ApplicationDefinition, page.id, page.sections as WebsiteSection[]);
    for (const section of page.sections as WebsiteSection[]) {
      if (section.applicationFormBinding === undefined) continue;
      compileApplicationCreateForm(snapshot.application as ApplicationDefinition, section, section.applicationFormBinding);
      // The exporter emits a disabled contact button and no platform lead
      // endpoint. Only the authorized isolated page bootstrap can attach the
      // dedicated application listener. Release preflight remains closed.
    }
    return { ...page, outputPath: undefined, id: page.id, slug: page.slug, name: text(page.name, 'Page'),
      sections: (page.sections as WebsiteSection[]).map(normalizeSection),
      showInNavigation: page.showInNavigation !== false,
    } as WebsitePage;
  });
  const pageIds = new Set(pages.map(page => page.id));
  if (pageIds.size !== pages.length || !pageIds.has(snapshot.homePageId)) throw new Error('Invalid saved application page identity.');
  const home = pages.find(page => page.id === snapshot.homePageId)!;
  const seo = record(snapshot.seo) ? snapshot.seo : {};
  const output = createWebsiteBuilderOutput({
    pages, sections: home.sections, activePageId: home.id, homePageId: home.id,
    siteUrl: text(snapshot.siteUrl), siteName: text(snapshot.siteName, 'My Website'), faviconUrl: text(snapshot.faviconUrl),
    seo: { title: text(seo.title), description: text(seo.description), keywords: Array.isArray(seo.keywords) ? seo.keywords.filter((value): value is string => typeof value === 'string') : [] },
    theme: normalizeTheme(record(snapshot.theme) ? snapshot.theme : undefined),
    headerConfig: normalizeHeaderConfig(record(snapshot.headerConfig) ? snapshot.headerConfig : undefined),
    footerConfig: normalizeFooterConfig(record(snapshot.footerConfig) ? snapshot.footerConfig : undefined),
    siteEnhancements: normalizeSiteEnhancements(record(snapshot.siteEnhancements) ? snapshot.siteEnhancements : undefined),
    productionConfig: normalizeProductionConfig(record(snapshot.productionConfig) ? snapshot.productionConfig : undefined),
    preferredLanguage: localization.defaultLanguage,
    cms: normalizeWebsiteCms(snapshot.cms), localization,
    // Do not embed Tayar's backend identity or enable platform lead/analytics RPCs.
    cloudProjectId: null, supabaseUrl: '', supabaseAnonKey: '',
  });
  if (output.pages.length !== pages.length || output.pages.some(page => !pageIds.has(page.id))) throw new Error('Application route identity changed during rendering.');
  const files = output.pages.map(page => ({ name: output.filenameForPage(page), pageId: page.id,
    contentType: 'text/html; charset=utf-8', content: output.getHtml(page.sections, page.id, undefined, true, false),
  }));
  assertValidPublishedWebsiteBundle(files);
  if (files.some(file => !isValidPublishedHtml(file.content))) throw new Error('Application page rendering failed.');
  return files;
}
