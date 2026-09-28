import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-private-render-'));
try {
  const outfile = join(dir, 'render.cjs');
  const built = await build({ metafile: true, stdin: { contents: `export { renderWebsiteApplicationSnapshot } from './src/modules/website-builder/services/websiteApplicationRenderService';
    export { validateWebsiteApplicationRelease } from './src/modules/website-builder/services/websiteApplicationPublishedService';
    export { createSection } from './src/modules/website-builder/core/defaults';`, resolveDir: process.cwd(), loader: 'ts' },
    tsconfig: 'tsconfig.app.json', bundle: true, platform: 'node', format: 'cjs', outfile });
  assert.ok(!Object.keys(built.metafile.inputs).some(path => /PreferencesContext|src\/lib\/(env|supabase)\.ts/.test(path)), 'Server render must not import platform/browser state');
  const { renderWebsiteApplicationSnapshot: render, validateWebsiteApplicationRelease: validate, createSection } = (await import(pathToFileURL(outfile))).default;
  const application = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] };
  const section = createSection('hero');
  section.elements.find(element => element.type === 'heading').content = 'PRIVATE_RENDER_ALPHA';
  const snapshot = { application, siteName: 'SERVER_SITE_ALPHA', siteUrl: 'https://example.com', homePageId: 'home',
    pages: [{ id: 'home', name: 'Home', slug: 'home', language: 'en', sections: [section], outputPath: '../../forged.html' },
      { id: 'dashboard', name: 'Dashboard', slug: 'dashboard', language: 'en', sections: [section] }],
    cloudProjectId: 'DO_NOT_EMBED_PLATFORM_PROJECT', supabaseUrl: 'https://platform-secret.invalid', supabaseAnonKey: 'DO_NOT_EMBED_PLATFORM_KEY',
  };
  const before = JSON.stringify(snapshot);
  const files = await render(snapshot);
  assert.deepEqual(files.map(file => [file.name, file.pageId]), [['index.html', 'home'], ['dashboard.html', 'dashboard']]);
  assert.equal(JSON.stringify(snapshot), before, 'Server export never mutates the saved project');
  for (const file of files) {
    assert.match(file.content, /PRIVATE_RENDER_ALPHA/);
    assert.match(file.content, /SERVER_SITE_ALPHA/);
    assert.ok(!file.content.includes('DO_NOT_EMBED_'));
    assert.ok(!file.content.includes('platform-secret.invalid'));
    assert.match(file.content, /^<!doctype html>/i);
  }
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const versionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  validate({ id: versionId, project_id: projectId, user_id: ownerId, backend, storage_bucket: 'website-application-releases',
    storage_prefix: `${ownerId}/${projectId}/versions/${versionId}`, snapshot,
    file_manifest: files.map(({ name, pageId, contentType }) => ({ name, pageId, contentType })) }, projectId, ownerId, 'https://pnbllxdlskljcakyaylt.supabase.co');
  const arabic = structuredClone(snapshot);
  arabic.siteName = 'موقع عربي';
  arabic.pages.forEach(page => { page.language = 'ar'; });
  arabic.localization = { defaultLanguage: 'ar' };
  arabic.pages[1].slug = 'لوحة';
  const [englishFiles, arabicFiles] = await Promise.all([render(snapshot), render(arabic)]);
  assert.match(englishFiles[0].content, /lang="en"/);
  assert.match(arabicFiles[0].content, /lang="ar"/);
  assert.equal(arabicFiles[1].name, 'لوحة.html');
  validate({ id: versionId, project_id: projectId, user_id: ownerId, backend, storage_bucket: 'website-application-releases',
    storage_prefix: `${ownerId}/${projectId}/versions/${versionId}`, snapshot: arabic,
    file_manifest: arabicFiles.map(({ name, pageId, contentType }) => ({ name, pageId, contentType })) }, projectId, ownerId, 'https://pnbllxdlskljcakyaylt.supabase.co');
  assert.match(arabicFiles[0].content, /dir="rtl"/);
  assert.ok(!englishFiles[0].content.includes('موقع عربي'));
  const duplicate = structuredClone(snapshot); duplicate.pages[1].id = 'home';
  const missingHome = { ...snapshot, homePageId: 'missing' };
  const cms = structuredClone(snapshot); cms.pages[1].cmsTemplate = { collectionId: 'records' };
  const bound = structuredClone(snapshot);
  bound.pages[0].sections.push({ ...createSection('contact'), applicationFormBinding: { operation: 'create', tableId: 'records', fields: [{ formFieldId: 'missing', tableFieldId: 'missing' }] } });
  await assert.rejects(() => render(bound), /form does not match/);
  const validBound = structuredClone(snapshot);
  const form = createSection('contact');
  validBound.application.tables = [{ id: 'records', key: 'records', name: 'Records', permissions: [{ operation: 'create', access: 'owner' }],
    fields: form.formFields.map((field, index) => ({ id: `db_${index}`, key: field.name, name: field.label, type: 'text', required: true })) }];
  form.applicationFormBinding = { operation: 'create', tableId: 'records', fields: form.formFields.map((field, index) => ({ formFieldId: field.id, tableFieldId: `db_${index}` })) };
  validBound.pages[0].sections.push(form);
  const boundHtml = (await render(validBound))[0].content;
  assert.match(boundHtml, /data-tayar-lead-form/);
  assert.match(boundHtml, /data-form-id="[^"]+"/);
  assert.match(boundHtml, /type="submit"[^>]* disabled/);
  assert.doesNotMatch(boundHtml, /website-form-submit|DO_NOT_EMBED_PLATFORM/);
  form.applicationFormBinding = null;
  await assert.rejects(() => render(validBound), /form does not match/);
  for (const invalid of [duplicate, missingHome, cms, { ...snapshot, pages: [] }]) await assert.rejects(() => render(invalid));
  console.log('PASS trusted saved-project HTML export: immutable input, canonical routes, private page mapping, language isolation, RTL and no platform identity');
} finally { await rm(dir, { recursive: true, force: true }); }
