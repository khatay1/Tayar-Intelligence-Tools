import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
let handler;
let project = { id: 'project', content: {} }, databaseError = null, downloads = [];
const owner = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
const admin = {
  from(name) {
    assert.equal(name, 'projects');
    const builder = { select() { return this; }, eq(key, value) { if (key === 'user_id') assert.equal(value, owner); return this; }, is(key, value) { assert.equal(key, 'deleted_at'); assert.equal(value, null); return this; }, async maybeSingle() { return { data: project, error: databaseError }; } };
    return builder;
  },
  storage: { from(bucket) { assert.equal(bucket, 'published-sites'); return { async download(path) { downloads.push(path); return { data: new Blob(['<html>public</html>'], { type: 'text/html' }), error: null }; } }; } },
};
const source = (await readFile('supabase/functions/published-site-storage/index.ts', 'utf8')).replace(/^import .*;\n/gm, '');
const compiled = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
new Function('Deno', 'createAdminClient', compiled)({ serve(fn) { handler = fn; } }, () => admin);
const run = (file = 'index.html', token = '', method = 'GET') => handler(new Request(`https://edge.test/?${new URLSearchParams({ ownerId: owner, projectId, file, previewToken: token })}`, { method }));
let response = await run();
assert.equal(response.status, 200); assert.equal(await response.text(), '<html>public</html>');
assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts/);
assert.doesNotMatch(response.headers.get('content-security-policy'), /allow-same-origin/);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal(downloads[0], `${owner}/${projectId}/index.html`);
for (const file of ['versions/release/index.html', 'staging/index.html', 'previews/token/index.html', 'release/index.html', '../index.html', 'folder/../index.html']) assert.equal((await run(file)).status, 404);
assert.equal(downloads.length, 1, 'Invalid paths never reach service-role storage');
assert.equal((await run('index.html', 'short')).status, 404);
response = await run('index.html', 'opaque_preview_token'); assert.equal(response.status, 200); assert.match(response.headers.get('x-robots-tag'), /noindex/);
assert.equal(downloads.at(-1), `${owner}/${projectId}/previews/opaque_preview_token/index.html`);
const before = downloads.length;
project.content.application = { auth: { enabled: true } }; assert.equal((await run()).status, 404);
project = null; assert.equal((await run()).status, 404);
databaseError = Error('unavailable'); assert.equal((await run()).status, 503);
assert.equal(downloads.length, before, 'Private apps, deleted/missing projects and uncertain reads never expose storage');
assert.equal((await run('index.html', '', 'POST')).status, 405);
console.log('PASS actual Edge static gateway: owner/project binding, deleted/private app denial, archive/traversal/token checks and sandbox/no-cache');
