import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

const owner = '11111111-1111-4111-8111-111111111111';
const intruder = '22222222-2222-4222-8222-222222222222';
const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let principal = owner, clock = 1, writes = 0;
const rows = [];
const decode = value => decodeURIComponent(String(value).replace(/^eq[.]/, ''));

globalThis.__projectAcceptanceClient = createClient('https://acceptance.supabase.co', 'sb_publishable_fixture', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET';
    assert.equal(url.pathname, '/rest/v1/projects');
    if (method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.user_id, principal, 'database boundary rejects a foreign owner on create');
      assert.equal(body.type, 'website-builder');
      const row = { id: projectId, user_id: body.user_id, workspace_id: null, title: body.title,
        content: body.content, status: body.status, type: body.type, deleted_at: null, updated_at: `v${clock++}` };
      rows.push(row);
      return Response.json(row);
    }
    if (method === 'GET') {
      assert.equal(url.searchParams.get('type'), 'eq.website-builder');
      assert.equal(url.searchParams.get('deleted_at'), 'is.null');
      return Response.json(rows.filter(row => row.user_id === principal && row.deleted_at === null));
    }
    if (method === 'PATCH') {
      writes++;
      const body = JSON.parse(options.body), id = decode(url.searchParams.get('id'));
      const expected = url.searchParams.has('updated_at') ? decode(url.searchParams.get('updated_at')) : null;
      // Model RLS separately; all other predicates must actually be sent by the client.
      const row = rows.find(item => item.id === id && item.user_id === principal
        && [...url.searchParams].filter(([key]) => key !== 'select').every(([key, filter]) =>
          filter === 'is.null' ? item[key] === null : String(item[key]) === filter.slice(3))
        && (!expected || item.updated_at === expected));
      if (!row) return Response.json(null);
      Object.assign(row, body);
      return Response.json({ id: row.id, updated_at: row.updated_at });
    }
    return new Response(null, { status: 405 });
  } },
});

const temp = await mkdtemp(join(tmpdir(), 'tayar-save-reopen-'));
try {
  const outfile = join(temp, 'subject.mjs');
  await build({
    stdin: { contents: `export * from './src/modules/website-builder/services/projectCloudService';
      export * from './src/modules/website-builder/core/project-normalization';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', outfile, tsconfig: 'tsconfig.app.json',
    plugins: [{ name: 'client', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'client', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () =>
        ({ contents: 'export const supabase = globalThis.__projectAcceptanceClient;' }));
    } }],
  });
  const subject = await import(pathToFileURL(outfile));
  const initial = { version: 6, siteName: 'Synthetic real estate', activePageId: 'properties', homePageId: 'properties',
    pages: [{ id: 'properties', name: 'Properties', slug: 'properties', showInNavigation: true,
      sections: [{ id: 'listing-view', type: 'features', title: 'Listings', elements: [] }] }],
    application: { version: 1, tables: [{ id: 'properties', key: 'properties', name: 'Properties', fields: [] }] } };

  const created = await subject.createWebsiteProjectInCloud({ userId: owner, title: 'Synthetic real estate',
    content: initial, published: false });
  assert.equal(created.error, null);
  assert.equal(created.data.id, projectId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'draft');

  let listed = await subject.listWebsiteProjectsInCloud();
  assert.equal(listed.error, null);
  assert.deepEqual(listed.data.map(row => row.id), [projectId]);
  let reopened = subject.normalizeWebsiteProjectLoad(listed.data[0].content);
  assert.equal(reopened.kind, 'pages');
  assert.equal(reopened.pages[0].sections[0].id, 'listing-view');
  assert.equal(reopened.parsed.application.tables[0].id, 'properties');

  const changed = structuredClone(initial);
  changed.pages[0].sections[0].title = 'Available listings';
  changed.application.tables[0].fields.push({ id: 'status', key: 'status', name: 'Status', type: 'enum', required: true,
    options: ['available', 'sold'] });
  const updated = await subject.updateWebsiteProjectInCloud({ projectId, title: 'Synthetic real estate', content: changed,
    published: false, expectedUpdatedAt: created.data.updated_at, updatedAt: 'v2' });
  assert.equal(updated.error, null);
  assert.equal(updated.data.updated_at, 'v2');

  listed = await subject.listWebsiteProjectsInCloud();
  reopened = subject.normalizeWebsiteProjectLoad(listed.data[0].content);
  assert.equal(reopened.pages[0].sections[0].title, 'Available listings');
  assert.equal(reopened.parsed.application.tables[0].fields[0].key, 'status');

  const stale = await subject.updateWebsiteProjectInCloud({ projectId, title: 'Stale', content: initial,
    published: false, expectedUpdatedAt: created.data.updated_at, updatedAt: 'v3' });
  assert.match(stale.error.message, /newer version/);
  assert.equal(rows[0].content.pages[0].sections[0].title, 'Available listings');

  principal = intruder;
  listed = await subject.listWebsiteProjectsInCloud();
  assert.deepEqual(listed.data, [], 'another signed-in tenant cannot reopen the owner project');
  const foreign = await subject.updateWebsiteProjectInCloud({ projectId, title: 'Foreign', content: initial,
    published: false, expectedUpdatedAt: 'v2', updatedAt: 'v3' });
  assert.match(foreign.error.message, /newer version/);
  assert.equal(rows[0].title, 'Synthetic real estate');

  principal = owner;
  const beforeMissingRevision = writes;
  for (const expectedUpdatedAt of [undefined, null, '']) {
    const missingRevision = await subject.updateWebsiteProjectInCloud({ projectId, title: 'Unversioned',
      content: initial, published: false, expectedUpdatedAt, updatedAt: 'v3' });
    assert.ok(missingRevision.error, 'Unversioned writes must fail before transport');
  }
  assert.equal(writes, beforeMissingRevision, 'Missing revision must not issue any PATCH');
  for (const unsafe of [{ deleted_at: '2026-10-23T00:00:00Z' }, { type: 'coding-assistant' }]) {
    Object.assign(rows[0], { deleted_at: null, type: 'website-builder' }, unsafe);
    const before = structuredClone(rows[0]);
    const refused = await subject.updateWebsiteProjectInCloud({ projectId, title: 'Wrong target',
      content: initial, published: false, expectedUpdatedAt: 'v2', updatedAt: 'v3' });
    assert.ok(refused.error, 'Deleted/non-website projects must not be updated');
    assert.deepEqual(rows[0], before);
  }

  console.log('PASS synthetic signed-in save/reopen/update flow: application payload round-trip, optimistic concurrency and tenant isolation (actual Supabase SDK; isolated mocked transport)');
} finally {
  delete globalThis.__projectAcceptanceClient;
  await rm(temp, { recursive: true, force: true });
}

