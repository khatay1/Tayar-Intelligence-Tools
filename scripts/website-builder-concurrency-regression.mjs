import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

const temp = await mkdtemp(join(tmpdir(), 'tayar-concurrency-'));
const row = { id: 'project', user_id: 'owner', type: 'website-builder', deleted_at: null, updated_at: 'v1', content: { text: 'original' } };
let writes = 0;
globalThis.__concurrencyClient = createClient('https://test.supabase.co', 'test-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, options) => {
    writes++;
    const url = new URL(input);
    assert.equal(options.method, 'PATCH');
    const matches = [...url.searchParams].filter(([key]) => key !== 'select').every(([key, filter]) =>
      filter === 'is.null' ? row[key] === null : String(row[key]) === filter.slice(3));
    if (!matches) return Response.json({ code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' }, { status: 406 });
    Object.assign(row, JSON.parse(options.body));
    return Response.json({ id: row.id, updated_at: row.updated_at });
  } },
});
try {
  const outfile = join(temp, 'subject.mjs');
  await build({ stdin: { contents: `export * from './src/modules/website-builder/services/projectCloudService'; export * from './src/modules/website-builder/core/latest-async-request';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', outfile,
    plugins: [{ name: 'client', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'client', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const supabase = globalThis.__concurrencyClient;' }));
    } }],
  });
  const subject = await import(pathToFileURL(outfile));
  const save = (version, text) => subject.updateWebsiteProjectInCloud({ projectId: row.id, title: 'Site', content: { text }, published: false, expectedUpdatedAt: version, updatedAt: 'v2' });
  const publish = (version, published = true) => subject.updateWebsiteProjectPublicationState({ projectId: row.id, userId: 'owner', content: { text: 'stale publish' }, published, expectedUpdatedAt: version, updatedAt: 'v3' });
  const [first, second] = await Promise.all([save('v1', 'teammate'), publish('v1')]);
  assert.equal([first, second].filter((result) => !result.error).length, 1, 'exactly one competing write succeeds');
  assert.match((first.error || second.error).message, /newer version/);
  row.updated_at = 'v1';
  assert.equal((await save('v1', 'teammate')).error, null);
  assert.ok((await publish('v1')).error);
  assert.equal(row.content.text, 'teammate');
  assert.ok((await publish('v1', false)).error, 'stale unpublish cannot overwrite a teammate');
  assert.equal(row.content.text, 'teammate');
  const before = writes;
  assert.ok((await publish(undefined)).error);
  assert.equal(writes, before, 'missing revisions fail before sending a write');
  assert.equal((await publish('v2')).error, null, 'freshly saved revision can publish without a false conflict');
  row.deleted_at = 'deleted';
  assert.ok((await publish('v3')).error, 'deleted projects cannot be republished');
  row.deleted_at = null;
  row.user_id = 'other';
  assert.ok((await publish('v3')).error, 'non-owner cannot publish');
  console.log('PASS concurrent draft/publish, stale unpublish, missing revision, owner and deleted-project guards');

  const values = [], errors = [];
  const request = subject.createLatestAsyncRequest((value) => values.push(value), (error) => errors.push(error));
  let resolveOld;
  const old = request.run(() => new Promise((resolve) => { resolveOld = resolve; }));
  await request.run(() => Promise.resolve('new filter'));
  resolveOld('old filter'); await old;
  assert.deepEqual(values, ['new filter']);
  let rejectOld;
  const stale = request.run(() => new Promise((_, reject) => { rejectOld = reject; }));
  request.invalidate();
  rejectOld(new Error('old project')); await stale;
  assert.equal(errors.length, 0);
  await request.run(() => Promise.reject(new Error('current request')));
  assert.equal(errors.length, 1);
  await request.run(() => Promise.resolve('recovered'));
  assert.equal(values.at(-1), 'recovered');
  console.log('PASS out-of-order responses, project invalidation, thrown request failures and recovery');
} finally {
  delete globalThis.__concurrencyClient;
  await rm(temp, { recursive: true, force: true });
}
