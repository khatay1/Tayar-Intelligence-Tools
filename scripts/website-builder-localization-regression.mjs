import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-locales-'));
try {
  async function load(file) {
    const outfile = join(temp, file + '.cjs');
    await build({ entryPoints: [`src/modules/website-builder/core/${file}.ts`], bundle: true, platform: 'node', format: 'cjs', alias: { '@': join(process.cwd(), 'src') }, define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'test-only' }) }, outfile });
    return (await import(pathToFileURL(outfile))).default;
  }
  const routes = await load('website-localization');
  const storage = await load('editor-published-storage');
  const output = await load('website-builder-output');
  const config = await load('website-builder-config');
  const defaults = await load('defaults');
  const max = await load('editor-localization');
  const maxStorage = await load('editor-localization-storage');
  const localizedOutput = await load('editor-localized-output');
  const en = { id: 'en', name: 'Home', slug: 'home', language: 'en', translationKey: 'home', showInNavigation: true, sections: [defaults.createSection('hero')] };
  const sv = { ...structuredClone(en), id: 'sv', language: 'sv' };
  const about = { ...structuredClone(en), id: 'about', language: 'sv', slug: 'about', translationKey: 'about', name: 'About' };
  sv.sections[0].buttonUrl = 'page:about';
  sv.sections[0].elements = [{ ...defaults.createElement('button'), href: 'page:about' }];
  const pages = [sv, en, about];
  const localization = { defaultLanguage: 'en', routeStrategy: 'subdirectory' };
  assert.equal(routes.normalizeWebsiteLocalization(undefined).routeStrategy, 'flat', 'existing projects keep flat URLs');
  assert.equal(routes.websitePageOutputPath(sv, pages, 'en', localization), 'sv/index.html');
  assert.equal(routes.websitePageOutputPath(en, pages, 'en', localization), 'index.html');
  assert.equal(routes.websitePageOutputPath(about, pages, 'en', localization), 'sv/about.html');
  assert.ok(routes.validateWebsiteLocalization([...pages, { ...sv, id: 'duplicate' }], 'en', localization).some((issue) => issue.code === 'duplicate-route'));
  const site = output.createWebsiteBuilderOutput({
    pages, sections: sv.sections, activePageId: 'sv', homePageId: 'en', localization,
    cms: { collections: [] }, siteUrl: 'https://example.com', siteName: 'Test', faviconUrl: '',
    seo: { title: 'Test', description: 'Test description', keywords: [] }, theme: config.DEFAULT_THEME,
    headerConfig: { ...config.DEFAULT_HEADER_CONFIG, languageSwitcher: true, ctaHref: 'page:about', showCta: true },
    footerConfig: config.DEFAULT_FOOTER_CONFIG, siteEnhancements: config.DEFAULT_SITE_ENHANCEMENTS,
    productionConfig: config.DEFAULT_PRODUCTION_CONFIG, preferredLanguage: 'ar', cloudProjectId: null, supabaseUrl: '', supabaseAnonKey: '',
  });
  const html = site.getHtml(sv.sections, 'sv');
  assert.ok(html.includes('href="../sv/about.html"'), 'nested body and navigation links resolve from locale folder');
  assert.ok(html.includes('hreflang="x-default" href="https://example.com/"'), 'x-default chooses default language, not first page');
  assert.ok(html.includes('rel="canonical" href="https://example.com/sv/index.html"'));
  const listed = [];
  const bucket = {
    async list(path) {
      listed.push(path);
      return { error: null, data: path === 'owner/project'
        ? [{ id: 'index', name: 'index.html' }, { name: 'sv' }, { name: 'previews' }, { name: 'versions' }]
        : [{ id: 'sv-index', name: 'index.html' }] };
    },
  };
  const files = await storage.listAllPublishedSiteFiles(bucket, 'owner/project');
  assert.deepEqual(files.map((file) => file.name), ['index.html', 'sv/index.html']);
  assert.deepEqual(listed, ['owner/project', 'owner/project/sv'], 'replacement never traverses release or preview archives');
  const endless = { async list() { return { error: null, data: [{ name: 'nested' }] }; } };
  await assert.rejects(storage.listAllPublishedSiteFiles(endless, 'root', { maxEntries: 5 }), /too many/);

  const maxConfig = max.createEditorLocalizationConfig('en');
  maxConfig.locales = maxConfig.locales.map(locale => locale.code === 'sv' ? { ...locale, enabled: true, subdomain: 'sv' } : locale.code === 'ar' ? { ...locale, enabled: true } : locale);
  maxConfig.pageContent = { home: { sv: { locale: 'sv', slug: 'hem', name: 'Hem', values: {}, seo: { title: 'Svensk titel' } } } };
  assert.deepEqual(max.buildEditorLocaleFallbackChain(maxConfig, 'sv'), ['sv', 'en']);
  assert.equal(max.resolveEditorLocale(maxConfig, 'ar').direction, 'rtl');
  assert.equal(max.buildEditorLocalizedPath(maxConfig, 'home', 'sv', 'home'), '/sv/hem');
  assert.equal(max.resolveEditorLocaleHost(max.resolveEditorLocale(maxConfig, 'sv'), 'example.com'), 'sv.example.com');
  assert.ok(max.buildEditorLocaleHrefLang(maxConfig, 'home', 'home').some(item => item.hrefLang === 'ar'));

  const migrated = maxStorage.createEditorLocalizationFromWebsiteProject(localization, pages);
  assert.equal(migrated.defaultLocale, 'en');
  assert.equal(migrated.locales.find(locale => locale.code === 'sv')?.enabled, true, 'existing translated pages enable their locale');
  assert.equal(migrated.pageContent.home.sv.slug, 'home', 'existing translated page slugs migrate into MAX content');
  assert.deepEqual(maxStorage.websiteLocalizationFromEditorConfig(migrated, localization), localization, 'MAX settings round-trip to canonical runtime localization');

  const project = { id: 'p', pages: [{ id: 'home', name: 'Home', slug: 'home' }], symbols: [] };
  const plan = { environment: 'production', pageIds: ['home'] };
  const manifest = localizedOutput.buildEditorLocalizedPublishManifest(project, maxConfig, plan, 'example.com');
  assert.equal(manifest.length, 3, 'publish manifest contains every enabled locale');
  assert.ok(manifest.some(route => route.locale === 'sv' && route.url === 'https://sv.example.com/sv/hem'));
  assert.deepEqual(localizedOutput.validateEditorLocalizationForPublish(project, maxConfig, plan), []);
  const localized = localizedOutput.buildEditorLocalizedPageOutput(project, project.pages[0], maxConfig, 'sv', 'example.com');
  assert.equal(localized.meta.title, 'Svensk titel');
  assert.equal(localized.route.direction, 'ltr');
  const panel = await readFile('src/modules/website-builder/v2-ui/BuilderLocalizationMaxPanel.tsx', 'utf8');
  assert.ok(panel.includes('localization-max-panel'));
  assert.ok(panel.includes('Fallback language') && panel.includes('Custom domain') && panel.includes('Subdomain'));
  assert.ok(panel.includes('Translate page with AI') && panel.includes('onTranslatePage'));
  console.log('PASS Localization MAX routes, RTL/fallback, legacy persistence bridge, localized SEO, domain mapping, publish manifest, AI workspace, canonical, hreflang and bounded storage traversal');
} finally {
  await rm(temp, { recursive: true, force: true });
}
