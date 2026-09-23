import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-cms-ai-'));
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

try {
  const outfile = join(temp, 'cms-ai.mjs');
  await build({ entryPoints: ['src/modules/website-builder/core/editor-ai-cms.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
  const ai = await import(`${pathToFileURL(outfile).href}?run=${Date.now()}`);

  const cms = {
    version: 2,
    collections: [
      {
        id: 'authors', name: 'Authors', slug: 'authors', slugField: 'slug',
        fields: [
          { id: 'a-title', name: 'Title', key: 'title', type: 'text', required: true },
          { id: 'a-slug', name: 'Slug', key: 'slug', type: 'text', required: true },
        ],
        entries: [{ id: 'author-1', draft: false, values: { title: 'Ada', slug: 'ada' } }],
        views: [],
      },
      {
        id: 'posts', name: 'Posts', slug: 'posts', slugField: 'slug',
        fields: [
          { id: 'p-title', name: 'Title', key: 'title', type: 'text', required: true },
          { id: 'p-slug', name: 'Slug', key: 'slug', type: 'text', required: true },
          { id: 'p-category', name: 'Category', key: 'category', type: 'text', required: false },
        ],
        entries: [{ id: 'post-1', draft: true, values: { title: 'Existing', slug: 'existing', category: 'news' } }],
        views: [],
      },
    ],
  };

  check('normalizer drops unsupported destructive actions', () => {
    const plan = ai.normalizeWebsiteCmsAIPlan({ operations: [
      { action: 'delete_collection', collectionId: 'posts' },
      { action: 'update_collection', collectionId: 'posts', name: 'Stories' },
    ] });
    assert.deepEqual(plan.operations.map((operation) => operation.action), ['update_collection']);
  });

  check('AI can add a bounded collection without touching existing ones', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'Add FAQ', warnings: [], operations: [{ action: 'add_collection', name: 'FAQ', slug: 'faq' }] });
    assert.equal(result.applied, 1);
    assert.equal(result.cms.collections.length, 3);
    assert.equal(result.cms.collections[0].id, 'authors');
    assert.equal(result.cms.collections[2].slug, 'faq');
  });

  check('AI add-entry always remains a draft and preserves unrelated entries', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'Draft post', warnings: [], operations: [{ action: 'add_entry', collectionId: 'posts', values: { title: 'New post', slug: 'new-post', category: 'docs', unknown: 'drop' } }] });
    const posts = result.cms.collections.find((collection) => collection.id === 'posts');
    assert.equal(posts.entries.length, 2);
    assert.equal(posts.entries[1].draft, true);
    assert.equal(posts.entries[1].values.title, 'New post');
    assert.equal('unknown' in posts.entries[1].values, false);
  });

  check('AI entry update preserves fields not included in the plan', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'Edit title', warnings: [], operations: [{ action: 'update_entry', collectionId: 'posts', entryId: 'post-1', values: { title: 'Updated' } }] });
    const entry = result.cms.collections.find((collection) => collection.id === 'posts').entries[0];
    assert.equal(entry.values.title, 'Updated');
    assert.equal(entry.values.slug, 'existing');
    assert.equal(entry.values.category, 'news');
  });

  check('AI translation writes locale overrides without replacing base values', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'Translate', warnings: [], operations: [{ action: 'translate_entry', collectionId: 'posts', entryId: 'post-1', language: 'sv', values: { title: 'Svensk titel', slug: 'svensk-titel', category: 'kategori' } }] });
    const entry = result.cms.collections.find((collection) => collection.id === 'posts').entries[0];
    assert.equal(entry.values.title, 'Existing');
    assert.equal(entry.localizedValues.sv.title, 'Svensk titel');
    assert.equal(entry.localizedValues.sv.slug, 'svensk-titel');
  });

  check('AI rejects invalid reference targets instead of creating broken schema', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'Bad relation', warnings: [], operations: [{ action: 'add_field', collectionId: 'posts', field: { name: 'Author', type: 'reference', referenceCollectionId: 'missing' } }] });
    assert.equal(result.applied, 0);
    assert.ok(result.warnings.some((warning) => warning.includes('target collection is invalid')));
  });

  check('AI can add a safe relation to an existing collection', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'Relation', warnings: [], operations: [{ action: 'add_field', collectionId: 'posts', field: { name: 'Author', key: 'author', type: 'reference', referenceCollectionId: 'authors' } }] });
    const field = result.cms.collections.find((collection) => collection.id === 'posts').fields.find((candidate) => candidate.key === 'author');
    assert.equal(field.referenceCollectionId, 'authors');
  });

  check('AI views keep only valid collection fields', () => {
    const result = ai.applyWebsiteCmsAIPlan(cms, { summary: 'View', warnings: [], operations: [{ action: 'add_view', collectionId: 'posts', name: 'News', filters: [{ fieldKey: 'category', operator: 'equals', value: 'news' }, { fieldKey: 'missing', operator: 'equals', value: 'x' }], sortField: 'title', sortDirection: 'asc', limit: 25 }] });
    const view = result.cms.collections.find((collection) => collection.id === 'posts').views[0];
    assert.equal(view.filters.length, 1);
    assert.equal(view.filters[0].fieldKey, 'category');
    assert.equal(view.sortField, 'title');
  });

  const service = await readFile('src/modules/website-builder/services/websiteCmsAIService.ts', 'utf8');
  const panel = await readFile('src/modules/website-builder/v2-ui/BuilderCmsAiPanel.tsx', 'utf8');
  const wrapper = await readFile('src/modules/website-builder/v2-ui/BuilderCmsPanel.tsx', 'utf8');
  const translations = await readFile('src/lib/ui-localization-cms.ts', 'utf8');

  check('CMS AI service uses authenticated website-builder AI engine in JSON mode', () => {
    assert.match(service, /functions\.invoke\('ai-engine'/);
    assert.match(service, /tool: 'website-builder'/);
    assert.match(service, /jsonMode: true/);
    assert.match(service, /maximum 30 operations/);
    assert.doesNotMatch(service, /delete_collection/);
  });

  check('CMS AI UI requires review before applying native CMS operations', () => {
    assert.match(panel, /cms-ai-plan-review/);
    assert.match(panel, /Apply reviewed plan/);
    assert.match(panel, /applyWebsiteCmsAIPlan/);
    assert.match(panel, /planWebsiteCmsWithAI/);
    assert.match(wrapper, /BuilderCmsAiPanel/);
  });

  check('CMS AI review UI has Arabic and Swedish coverage', () => {
    assert.match(translations, /'AI CMS assistant': 'مساعد CMS بالذكاء الاصطناعي'/);
    assert.match(translations, /'AI CMS assistant': 'AI-assistent för CMS'/);
    assert.match(translations, /'Apply reviewed plan'/);
  });

  console.log(`CMS AI regression: ${passed} scenarios passed.`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
