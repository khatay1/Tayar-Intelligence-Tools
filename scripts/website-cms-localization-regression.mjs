import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-cms-localization-'));
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

try {
  const cmsOut = join(temp, 'cms.mjs');
  const transferOut = join(temp, 'transfer.mjs');
  await build({ entryPoints: ['src/modules/website-builder/core/website-cms.ts'], bundle: true, platform: 'node', format: 'esm', outfile: cmsOut });
  await build({ entryPoints: ['src/modules/website-builder/core/website-cms-transfer.ts'], bundle: true, platform: 'node', format: 'esm', outfile: transferOut });
  const cms = await import(`${pathToFileURL(cmsOut).href}?cms=${Date.now()}`);
  const transfer = await import(`${pathToFileURL(transferOut).href}?transfer=${Date.now()}`);

  const state = cms.normalizeWebsiteCms({ collections: [{
    id: 'articles', name: 'Articles', slug: 'articles', slugField: 'slug',
    fields: [
      { id: 'title', name: 'Title', key: 'title', type: 'text', required: true },
      { id: 'slug', name: 'Slug', key: 'slug', type: 'text', required: true },
    ],
    entries: [{
      id: 'one', draft: false,
      values: { title: 'Default title', slug: 'default-title' },
      localizedValues: {
        ar: { title: 'عنوان عربي', slug: 'عنوان-عربي' },
        sv: { title: 'Svensk titel', slug: 'svensk-titel' },
      },
    }],
  }] });

  check('normalization preserves bounded localized values', () => {
    assert.equal(state.collections[0].entries[0].localizedValues.ar.title, 'عنوان عربي');
    assert.equal(state.collections[0].entries[0].localizedValues.sv.slug, 'svensk-titel');
  });
  check('localized entry resolution falls back to default values', () => {
    const entry = state.collections[0].entries[0];
    assert.equal(cms.resolveWebsiteCmsEntryValue(entry, 'title', 'ar', 'en'), 'عنوان عربي');
    assert.equal(cms.resolveWebsiteCmsEntryValue(entry, 'title', 'en', 'en'), 'Default title');
    assert.equal(cms.resolveWebsiteCmsEntryValue(entry, 'missing', 'sv', 'en'), undefined);
  });
  check('dynamic CMS pages materialize localized content and slugs', () => {
    const page = {
      id: 'article-ar', name: 'Article', slug: 'article', language: 'ar', showInNavigation: false,
      cmsTemplate: { collectionId: 'articles', routePattern: 'article-{slug}' },
      sections: [{ id: 'hero', type: 'hero', elements: [{ id: 'heading', type: 'heading', content: 'Fallback', style: {}, cmsBinding: { collectionId: 'articles', fieldKey: 'title', target: 'content' } }] }],
    };
    const output = cms.expandWebsiteCmsPages([page], state, Date.now(), 'en');
    assert.equal(output.length, 1);
    assert.equal(output[0].name, 'عنوان عربي');
    assert.equal(output[0].sections[0].elements[0].content, 'عنوان عربي');
    assert.notEqual(output[0].slug, 'article-default-title');
  });
  check('localized duplicate slugs block release', () => {
    const invalid = structuredClone(state);
    invalid.collections[0].entries.push({
      id: 'two', draft: false,
      values: { title: 'Two', slug: 'two' },
      localizedValues: { sv: { title: 'Två', slug: 'svensk-titel' } },
    });
    assert.ok(cms.validateWebsiteCms(invalid).some((issue) => issue.message.includes('duplicate SV published slug')));
  });
  check('CSV transfer preserves localized columns and values', () => {
    const csv = transfer.exportWebsiteCmsCollectionCsv(state.collections[0]);
    assert.match(csv, /title__ar/);
    assert.match(csv, /slug__sv/);
    const preview = transfer.previewWebsiteCmsCsvImport(csv, 'Imported');
    assert.equal(preview.collection.entries[0].localizedValues.ar.title, 'عنوان عربي');
    assert.equal(preview.collection.entries[0].localizedValues.sv.slug, 'svensk-titel');
  });
  check('JSON transfer preserves localized values', () => {
    const json = transfer.exportWebsiteCmsCollectionJson(state.collections[0]);
    const preview = transfer.previewWebsiteCmsJsonImport(json, 'Imported');
    assert.equal(preview.collection.entries[0].localizedValues.ar.title, 'عنوان عربي');
  });

  const localizationPanel = await readFile('src/modules/website-builder/v2-ui/BuilderCmsLocalizationPanel.tsx', 'utf8');
  const cmsPanel = await readFile('src/modules/website-builder/v2-ui/BuilderCmsPanel.tsx', 'utf8');
  const outputSource = await readFile('src/modules/website-builder/core/website-builder-output.ts', 'utf8');
  const translations = await readFile('src/lib/ui-localization-cms.ts', 'utf8');
  check('multilingual CMS editor is reachable from the CMS MAX panel', () => {
    assert.match(cmsPanel, /BuilderCmsLocalizationPanel/);
    assert.match(localizationPanel, /localizedValues/);
    assert.match(localizationPanel, /Localized slug/);
    assert.match(localizationPanel, /Use fallback/);
  });
  check('published output passes site locale context into CMS expansion', () => {
    assert.match(outputSource, /expandWebsiteCmsPages\(sourcePages, cms, Date\.now\(\), normalizedLocalization\.defaultLanguage\)/);
    assert.match(outputSource, /normalizePageLanguage\(page\.language, normalizedLocalization\.defaultLanguage\)/);
  });
  check('CMS localization controls include Arabic and Swedish translations', () => {
    assert.match(translations, /'Multilingual CMS content': 'محتوى CMS متعدد اللغات'/);
    assert.match(translations, /'Multilingual CMS content': 'Flerspråkigt CMS-innehåll'/);
    assert.match(translations, /'Content language'/);
  });

  console.log(`CMS localization regression: ${passed} scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
