import assert from 'node:assert/strict';
import handler from '../api/published-site.js';
const originalFetch = globalThis.fetch;
const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WEBSITE_APPLICATION_RUNTIME_ENABLED'];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ownerId = '11111111-1111-4111-8111-111111111111';
const versionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const definition = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] };
const release = { id: versionId, project_id: projectId, user_id: ownerId, backend,
  storage_bucket: 'website-application-releases', storage_prefix: `${ownerId}/${projectId}/versions/${versionId}`,
  snapshot: { application: definition, homePageId: 'home', pages: [{ id: 'home', slug: 'home' }, { id: 'dashboard', slug: 'dashboard' }] },
  file_manifest: [{ name: 'index.html', contentType: 'text/html', pageId: 'home' }, { name: 'dashboard.html', contentType: 'text/html', pageId: 'dashboard' }],
};
try {
  process.env.SUPABASE_URL = platformUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_platform_fixture';
  process.env.WEBSITE_APPLICATION_RUNTIME_ENABLED = 'true';
  let live = { enabled: true, release };
  let settings = { external: { email: true, anonymous_users: false }, disable_signup: false, mailer_autoconfirm: false };
  let calls = [];
  let reads = 0;
  let changedAfterAuthorization = false;
  const fetchImpl = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    calls.push(url.href);
    if (url.origin === platformUrl) {
      if (url.pathname.endsWith('/website_application_published_release')) {
        assert.deepEqual(JSON.parse(init.body), { p_project_id: projectId, p_owner_id: ownerId });
        reads += 1;
        return Response.json(changedAfterAuthorization && reads > 1 ? { enabled: true, release: null } : live);
      }
      if (url.pathname.endsWith('/website_application_release_credential')) {
        assert.deepEqual(JSON.parse(init.body), { p_project_id: projectId, p_version_id: versionId });
        return Response.json('sb_secret_dedicated_fixture');
      }
      if (url.pathname.startsWith('/storage/v1/object/website-application-releases/')) {
        assert.ok(live.release.file_manifest.some(item => decodeURIComponent(url.pathname).endsWith(`${live.release.storage_prefix}/${item.name}`)));
        return new Response('<html>private release page</html>');
      }
      if (url.pathname.startsWith('/storage/v1/object/public/published-sites/')) return new Response('<html>ordinary static site</html>');
      throw new Error(`Unexpected platform request ${url.pathname}`);
    }
    assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/settings') return Response.json(settings);
    if (url.pathname === '/rest/v1/rpc/app_deployed_definition') return Response.json(definition);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: '22222222-2222-4222-8222-222222222222', is_anonymous: false, email_confirmed_at: '2026-09-27T00:00:00Z' });
    throw new Error(`Unexpected app request ${url.pathname}`);
  };
  globalThis.fetch = fetchImpl;
  const run = async ({ file = 'dashboard.html', token, method = 'GET', preview = false } = {}) => {
    calls = []; reads = 0;
    const headers = new Map();
    const res = { statusCode: 200, body: '', setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); }, end(body) { this.body = body ? String(body) : ''; } };
    const url = preview ? `/preview/${ownerId}/${projectId}/test-token/${file}` : `/site/${ownerId}/${projectId}/${file}`;
    await handler({ method, url, headers: { host: 'tayar.se', ...(token ? { authorization: `Bearer ${token}` } : {}) } }, res);
    return { ...res, headers };
  };
  let result = await run();
  assert.equal(result.statusCode, 401);
  assert.ok(!calls.some(url => url.includes('/storage/')), 'Unauthorized request never downloads private or public content');
  result = await run({ token: 'a.b.c' });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /private release page/);
  assert.ok(!calls.some(url => url.includes('/object/public/')));
  assert.match(result.headers.get('cache-control'), /private, no-store/);
  assert.match(result.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.equal(result.headers.get('vary'), 'Authorization, Cookie');
  result = await run({ token: 'a.b.c', method: 'HEAD' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body, '');
  result = await run({ file: 'index.html' });
  assert.equal(result.statusCode, 200);
  assert.ok(!calls.some(url => url.endsWith('/auth/v1/user')), 'Public page skips visitor login while still verifying the release');
  const arabicRelease = structuredClone(release);
  arabicRelease.snapshot.pages[1].slug = 'لوحة';
  arabicRelease.file_manifest[1].name = 'لوحة.html';
  live = { enabled: true, release: arabicRelease };
  assert.equal((await run({ file: encodeURIComponent('لوحة.html'), token: 'a.b.c' })).statusCode, 200);
  live = { enabled: true, release };
  result = await run({ file: 'unknown.html', token: 'a.b.c' });
  assert.equal(result.statusCode, 404);
  assert.equal(calls.length, 1, 'No manifest match means no credential or file lookup');
  result = await run({ preview: true, token: 'a.b.c' });
  assert.equal(result.statusCode, 404);
  assert.equal(calls.length, 1, 'Public preview token cannot bypass private release routing');
  changedAfterAuthorization = true;
  result = await run({ token: 'a.b.c' });
  assert.equal(result.statusCode, 503);
  assert.ok(!calls.some(url => url.includes('/storage/')), 'Unpublish during authorization blocks download');
  changedAfterAuthorization = false;
  live = { enabled: true, release: null };
  assert.equal((await run({ token: 'a.b.c' })).statusCode, 404);
  assert.ok(!calls.some(url => url.includes('/storage/')), 'Unpublished application never falls back to an old public file');
  for (const invalid of [
    { ...release, storage_bucket: 'published-sites' },
    { ...release, file_manifest: [...release.file_manifest, { name: 'hidden.json', pageId: 'home', contentType: 'text/html' }] },
    { ...release, storage_prefix: `${ownerId}/another-project/versions/${versionId}` },
    { ...release, file_manifest: [release.file_manifest[0], { ...release.file_manifest[1], pageId: 'home' }] },
    { ...release, file_manifest: [release.file_manifest[0], { name: '../secret.html', pageId: 'home', contentType: 'text/html' }] },
  ]) {
    live = { enabled: true, release: invalid };
    assert.equal((await run({ token: 'a.b.c' })).statusCode, 503);
    assert.ok(!calls.some(url => url.includes('/storage/')));
  }
  live = { enabled: true, release };
  settings = { ...settings, mailer_autoconfirm: true };
  assert.equal((await run({ token: 'a.b.c' })).statusCode, 503);
  assert.ok(!calls.some(url => url.includes('/storage/')), 'Auth drift blocks serving before private content is read');
  live = null;
  result = await run({ file: 'index.html' });
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /ordinary static site/);
  console.log('PASS actual published route: immutable private manifest, auth before download, no public fallback, release changes, safe HEAD, legacy static compatibility and Auth drift denial');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of keys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
}
