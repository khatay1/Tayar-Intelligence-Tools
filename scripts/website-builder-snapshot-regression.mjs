import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/modules/website-builder/core/editor-project-snapshot.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { createEditorProjectSnapshot, fingerprintEditorProject, fingerprintEditableProject } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const values = {
  cloudProjectId: 'cloud-a', siteName: 'Test', siteUrl: 'https://example.com', faviconUrl: 'icon',
  publishedUrl: 'https://live.example.com', publishedAt: '2026-09-24', previewUrl: 'https://preview.example.com',
  previewToken: 'private', previewCreatedAt: '2026-09-23', previewFingerprint: 'preview-hash',
  lastPublishedVersionId: 'version-a', lastPublishedFingerprint: 'published-hash',
  activePageId: 'page-1', homePageId: 'page-1', pages: [{ id: 'page-1', sections: [] }],
  cms: {}, localization: {}, brand: {}, theme: {}, headerConfig: {}, footerConfig: {},
  siteEnhancements: {}, productionConfig: {}, deliveryConfig: {}, symbols: [],
  seo: {}, language: 'en',
};

const snapshot = createEditorProjectSnapshot(values);
assert.deepEqual(Object.keys(snapshot), ['version', ...Object.keys(values), 'updatedAt']);
assert.equal(snapshot.version, 6);
assert.match(snapshot.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

const projectFields = { ...values };
delete projectFields.cloudProjectId;
assert.equal(fingerprintEditorProject(values), JSON.stringify(projectFields), 'autosave fingerprint preserves field order and omits cloud identity');

const editableKeys = [
  'siteName', 'siteUrl', 'faviconUrl', 'homePageId', 'pages', 'cms', 'localization',
  'brand', 'theme', 'headerConfig', 'footerConfig', 'siteEnhancements',
  'productionConfig', 'symbols', 'seo', 'language',
];
assert.equal(
  fingerprintEditableProject(values),
  JSON.stringify(Object.fromEntries(editableKeys.map((key) => [key, values[key]]))),
  'publish fingerprint preserves the original editable fields and order',
);
assert.equal(fingerprintEditableProject({ ...values, publishedUrl: 'new release' }), fingerprintEditableProject(values));
assert.notEqual(fingerprintEditorProject({ ...values, publishedUrl: 'new release' }), fingerprintEditorProject(values));

console.log('PASS Website Builder snapshots preserve autosave and publish fingerprints');
