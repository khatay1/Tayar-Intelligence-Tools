import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-page-authorization-'));
const originalFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'page.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationPageService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { serveWebsiteApplicationPage } = (await import(pathToFileURL(outfile))).default;
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const definition = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [{ id: 'staff', name: 'Staff' }], tables: [], pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }, { pageId: 'admin', access: 'role', roleId: 'staff' }] };
  const pageIds = new Set(['home', 'dashboard', 'admin']);
  let contentReads = 0;
  let requests = [];
  let user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email_confirmed_at: '2026-09-27T00:00:00Z', is_anonymous: false, user_metadata: { roles: ['staff'] } };
  let roles = [];
  let authStatus = 200;
  let roleStatus = 200;
  const token = 'header.payload.signature';
  globalThis.fetch = async (resource, init) => {
    const url = resource instanceof Request ? resource.url : String(resource);
    requests.push(url);
    assert.ok(url.startsWith(backend.url));
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    const auth = url.endsWith('/auth/v1/user');
    return new Response(JSON.stringify(auth ? user : roles), { status: auth ? authStatus : roleStatus, headers: { 'content-type': 'application/json' } });
  };
  const run = async (pageId, authorization, options = {}) => serveWebsiteApplicationPage({
    request: new Request('https://application.example/page', { method: options.method ?? 'GET', headers: authorization ? { authorization } : {} }),
    pageId, pageIds, definition, backend, platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co',
    async loadPage() { contentReads += 1; return new Response('private-page-content', { headers: { 'cache-control': 'public, max-age=3600', 'content-type': 'text/html' } }); },
    ...options,
  });
  assert.equal((await run('home')).status, 200);
  assert.equal(requests.length, 0, 'Public pages need no auth request');
  assert.equal((await run('missing', `Bearer ${token}`)).status, 404);
  assert.equal((await run('dashboard', undefined, { method: 'POST' })).status, 405);
  for (const authorization of [undefined, 'Bearer invalid', 'Basic abc', `Bearer ${'a'.repeat(17000)}.b.c`]) {
    assert.equal((await run('dashboard', authorization)).status, 401);
  }
  assert.equal(contentReads, 1, 'Missing auth, unknown route and invalid methods must not load private HTML');
  assert.equal(requests.length, 0);
  let response = await run('dashboard', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'private-page-content');
  for (const name of ['cache-control', 'cdn-cache-control', 'vercel-cdn-cache-control']) assert.match(response.headers.get(name), /no-store/);
  assert.match(response.headers.get('vary'), /Authorization/);
  assert.equal(requests.length, 1, 'Signed-in pages validate the user without role lookup');
  assert.equal((await run('admin', `Bearer ${token}`)).status, 403, 'User-editable metadata cannot grant a role');
  roles = ['staff'];
  assert.equal((await run('admin', `Bearer ${token}`)).status, 200);
  roles = [];
  assert.equal((await run('admin', `Bearer ${token}`)).status, 403, 'Role removal takes effect on the next request');
  const allowedReads = contentReads;
  user = { ...user, is_anonymous: true };
  assert.equal((await run('dashboard', `Bearer ${token}`)).status, 401);
  user = { ...user, is_anonymous: false, email_confirmed_at: null };
  assert.equal((await run('dashboard', `Bearer ${token}`)).status, 403);
  user = { ...user, email_confirmed_at: '2026-09-27T00:00:00Z' };
  authStatus = 401;
  assert.equal((await run('dashboard', `Bearer ${token}`)).status, 401, 'Expired or foreign-app token is rejected by the dedicated auth server');
  authStatus = 200;
  roleStatus = 503;
  assert.equal((await run('admin', `Bearer ${token}`)).status, 503);
  roleStatus = 200;
  roles = { staff: true };
  assert.equal((await run('admin', `Bearer ${token}`)).status, 503);
  assert.equal(contentReads, allowedReads);
  response = await run('dashboard', `Bearer ${token}`, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
  response = await run('dashboard', `Bearer ${token}`, { loadPage: async () => { throw new Error('private-storage-secret'); } });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-storage-secret/);
  globalThis.fetch = async () => { throw new Error('private-transport-secret'); };
  response = await run('dashboard', `Bearer ${token}`);
  assert.ok([401, 503].includes(response.status));
  assert.doesNotMatch(await response.text(), /private-transport-secret/);
  assert.equal((await run('dashboard', `Bearer ${token}`, { backend: { ...backend, url: 'https://pnbllxdlskljcakyaylt.supabase.co', projectRef: 'pnbllxdlskljcakyaylt' } })).status, 503);
  assert.equal((await run('dashboard', `Bearer ${token}`, { pageIds: new Set(['dashboard']) })).status, 503, 'Malformed manifest denies even if requested page exists');
  console.log('PASS server page authorization: private content gate, authenticated/role/anonymous/email denial, dedicated identity, fresh roles and no shared cache');
} finally {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
}
