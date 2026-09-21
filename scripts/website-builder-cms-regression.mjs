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
  check('reference fields resolve values from related entries', () => {
    const related = cms.normalizeWebsiteCms({ collections: [
      { id: 'authors', name: 'Authors', entries: [{ id: 'ada', draft: false, values: { title: 'Ada', slug: 'ada' } }] },
      { id: 'posts', name: 'Posts', fields: [
        { id: 'post-title', name: 'Title', key: 'title', type: 'text' },
        { id: 'post-slug', name: 'Slug', key: 'slug', type: 'text' },
        { id: 'post-author', name: 'Author', key: 'author', type: 'reference', referenceCollectionId: 'authors' },
      ], entries: [{ id: 'post', draft: false, values: { title: 'Post', slug: 'post', author: 'ada' } }] },
    ] });
    assert.equal(cms.resolveWebsiteCmsValue(related, { collectionId: 'posts', fieldKey: 'author', referenceFieldKey: 'title', entryId: 'post', target: 'content' }), 'Ada');
  });
  check('scheduled entries publish only inside their window', () => {
    const scheduled = structuredClone(state);
    scheduled.collections[0].entries[0].publishAt = '2030-01-01T00:00:00.000Z';
    assert.equal(cms.expandWebsiteCmsPages([page], scheduled, '2029-12-31T23:59:59.000Z').length, 0);
    assert.equal(cms.expandWebsiteCmsPages([page], scheduled, '2030-01-01T00:00:00.000Z').length, 1);
    scheduled.collections[0].entries[0].unpublishAt = '2030-01-02T00:00:00.000Z';
    assert.equal(cms.expandWebsiteCmsPages([page], scheduled, '2030-01-02T00:00:00.000Z').length, 0);
  });
  check('reusable views filter sort and limit dynamic entries', () => {
    const viewed = structuredClone(state);
    viewed.collections[0].entries.push({ id: 'second', draft: false, values: { title: 'Second story', slug: 'second-story', featured: true } });
    viewed.collections[0].fields.push({ id: 'featured', name: 'Featured', key: 'featured', type: 'boolean', required: false });
    viewed.collections[0].views = [{ id: 'featured', name: 'Featured', filters: [{ fieldKey: 'featured', operator: 'truthy' }], sortField: 'title', sortDirection: 'desc', limit: 1 }];
    const dynamic = structuredClone(page);
    dynamic.cmsTemplate.viewId = 'featured';
    const output = cms.expandWebsiteCmsPages([dynamic], viewed);
    assert.equal(output.length, 1);
    assert.equal(output[0].name, 'Second story');
  });
  check('route patterns create deterministic dynamic slugs', () => {
    const routed = structuredClone(page);
    routed.cmsTemplate.routePattern = 'story-{slug}-{id}';
    assert.equal(cms.expandWebsiteCmsPages([routed], state)[0].slug, 'story-first-story-first');
  });
  check('invalid relations and publishing windows block release', () => {
    const invalid = cms.normalizeWebsiteCms({ collections: [{
      id: 'posts', name: 'Posts', fields: [{ id: 'author', name: 'Author', key: 'author', type: 'reference', referenceCollectionId: 'missing' }],
      entries: [{ id: 'post', draft: false, publishAt: '2030-02-01T00:00:00Z', unpublishAt: '2030-01-01T00:00:00Z', values: { author: 'nobody' } }],
    }] });
    const issues = cms.validateWebsiteCms(invalid);
    assert.ok(issues.some((issue) => issue.message.includes('publishing window')));
    assert.ok(issues.some((issue) => issue.message.includes('missing collection')));
  });
  console.log(`CMS regression: ${passed} behavioral scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
