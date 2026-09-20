import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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
  console.log('PASS localization routes, rendered links, canonical, hreflang, archive isolation and bounded traversal');
} finally {
  await rm(temp, { recursive: true, force: true });
}
