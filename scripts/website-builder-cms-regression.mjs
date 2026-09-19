import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-cms-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`PASS ${name}`); };

try {
  const outfile = join(temp, 'cms.mjs');
  await build({
    entryPoints: ['src/modules/website-builder/core/website-cms.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  });
  const cms = await import(pathToFileURL(outfile));
  const collection = cms.createWebsiteCmsCollection('Articles', 'articles');
  const state = cms.normalizeWebsiteCms({ collections: [{
    ...collection,
    entries: [
      { id: 'first', draft: false, values: { title: 'First story', slug: 'first-story' } },
      { id: 'draft', draft: true, values: { title: 'Hidden story', slug: 'hidden-story' } },
    ],
  }] });
  const element = { id: 'title', type: 'heading', content: 'Fallback', style: {}, cmsBinding: { collectionId: 'articles', fieldKey: 'title', target: 'content' } };
  const page = { id: 'article-template', name: 'Article', slug: 'article', showInNavigation: true, cmsTemplate: { collectionId: 'articles' }, sections: [{ id: 'hero', type: 'hero', elements: [element] }] };

  check('collection defaults include title and slug fields', () => {
    assert.deepEqual(collection.fields.map((field) => field.key), ['title', 'slug']);
  });
  check('normalization bounds collections, fields and entries', () => {
    const oversized = cms.normalizeWebsiteCms({ collections: Array.from({ length: 25 }, (_, index) => ({ id: `c-${index}`, name: `C ${index}`, fields: Array.from({ length: 35 }, (__, field) => ({ key: `f-${field}` })), entries: Array.from({ length: 510 }, (__, entry) => ({ id: `e-${entry}` })) })) });
    assert.equal(oversized.collections.length, 20);
    assert.equal(oversized.collections[0].fields.length, 30);
    assert.equal(oversized.collections[0].entries.length, 500);
  });
  check('binding resolves typed entry values', () => {
    assert.equal(cms.resolveWebsiteCmsValue(state, { collectionId: 'articles', fieldKey: 'title', entryId: 'first', target: 'content' }), 'First story');
  });
  check('materialization keeps source immutable', () => {
    const rendered = cms.materializeWebsiteCmsSections(page.sections, state, 'first');
    assert.equal(rendered[0].elements[0].content, 'First story');
    assert.equal(page.sections[0].elements[0].content, 'Fallback');
  });
  check('dynamic pages publish one page per non-draft entry', () => {
    const output = cms.expandWebsiteCmsPages([page], state);
    assert.equal(output.length, 1);
    assert.equal(output[0].slug, 'articles-first-story');
    assert.equal(output[0].sections[0].elements[0].content, 'First story');
    assert.equal(output[0].showInNavigation, false);
  });
  check('fixed entry bindings work on regular pages', () => {
    const fixed = structuredClone(page);
    delete fixed.cmsTemplate;
    fixed.sections[0].elements[0].cmsBinding.entryId = 'first';
    assert.equal(cms.expandWebsiteCmsPages([fixed], state)[0].sections[0].elements[0].content, 'First story');
  });
  check('duplicate published slugs block release', () => {
    const invalid = structuredClone(state);
    invalid.collections[0].entries.push({ id: 'second', draft: false, values: { title: 'Second', slug: 'first-story' } });
    assert.ok(cms.validateWebsiteCms(invalid, [page]).some((issue) => issue.severity === 'error' && issue.message.includes('duplicate')));
  });
  check('drafts may be incomplete while published entries require slugs', () => {
    const drafts = structuredClone(state);
    drafts.collections[0].entries[1].values = {};
    assert.equal(cms.validateWebsiteCms(drafts, [page]).filter((issue) => issue.entryId === 'draft').length, 0);
    drafts.collections[0].entries[1].draft = false;
    assert.ok(cms.validateWebsiteCms(drafts, [page]).some((issue) => issue.entryId === 'draft' && issue.message.includes('needs a slug')));
  });
  check('dangling element bindings block release', () => {
    const broken = structuredClone(page);
    broken.sections[0].elements[0].cmsBinding.fieldKey = 'missing';
    assert.ok(cms.validateWebsiteCms(state, [broken]).some((issue) => issue.message.includes('missing CMS field')));
  });
  console.log(`CMS regression: ${passed} behavioral scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
