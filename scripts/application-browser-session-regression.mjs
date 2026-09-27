import assert from 'node:assert/strict';
import sessionHandler from '../api/application-session.js';
import pageHandler from '../api/published-site.js';
const originalFetch = globalThis.fetch;
const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WEBSITE_APPLICATION_RUNTIME_ENABLED', 'WEBSITE_APPLICATION_SESSIONS_ENABLED', 'WEBSITE_APPLICATION_HOST_SUFFIX', 'WEBSITE_PLATFORM_ORIGIN'];
const originalEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ownerId = '11111111-1111-4111-8111-111111111111';
const versionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
const origin = `https://${projectId}.apps.tayar.example`;
const makeToken = exp => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.fixture_signature`;
const token = makeToken(Math.floor(Date.now() / 1000) + 1800);
const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] };
const release = { id: versionId, project_id: projectId, user_id: ownerId, backend, storage_bucket: 'website-application-releases', storage_prefix: `${ownerId}/${projectId}/versions/${versionId}`,
  snapshot: { application: app, homePageId: 'home', pages: [{ id: 'home', slug: 'home' }, { id: 'dashboard', slug: 'dashboard' }] },
  file_manifest: [{ name: 'index.html', pageId: 'home', contentType: 'text/html' }, { name: 'dashboard.html', pageId: 'dashboard', contentType: 'text/html' }],
};
try {
  Object.assign(process.env, { SUPABASE_URL: platformUrl, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_platform_fixture', WEBSITE_APPLICATION_RUNTIME_ENABLED: 'true', WEBSITE_APPLICATION_SESSIONS_ENABLED: 'true', WEBSITE_APPLICATION_HOST_SUFFIX: 'apps.tayar.example', WEBSITE_PLATFORM_ORIGIN: 'https://tayar.se' });
  let calls = [], revoked = false, anonymous = false, confirmed = true, authFails = false, authThrows = false;
  let live = { enabled: true, release };
  globalThis.fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    calls.push(url.href);
    assert.equal(init.redirect, 'error');
    if (url.origin === platformUrl) {
      if (url.pathname.endsWith('/website_application_published_release')) return Response.json(live);
      if (url.pathname.endsWith('/website_application_release_credential')) return Response.json('sb_secret_backend_fixture');
      if (url.pathname.startsWith('/storage/v1/object/website-application-releases/')) return new Response('<html>Private content</html>');
      throw new Error(`Unexpected platform request ${url.pathname}`);
    }
    assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/settings') return Response.json({ external: { email: true, anonymous_users: false }, disable_signup: false, mailer_autoconfirm: false });
    if (url.pathname === '/rest/v1/rpc/app_deployed_definition') return Response.json(app);
    if (url.pathname === '/auth/v1/logout') { assert.equal(url.searchParams.get('scope'), 'local'); revoked = true; return new Response(null, { status: 204 }); }
    assert.equal(url.pathname, '/auth/v1/user');
    if (authThrows) throw new Error('sb_secret_MUST_NOT_ESCAPE');
    if (revoked || authFails || new Headers(init.headers).get('authorization') === 'Bearer a.b.c') return Response.json({ message: 'Invalid token' }, { status: 401 });
    return Response.json({ id: ownerId, is_anonymous: anonymous, email_confirmed_at: confirmed ? '2026-09-27T00:00:00Z' : null });
  };
  const run = async (handler, { host = new URL(origin).host, path, method = 'POST', headers = {} }) => {
    calls = [];
    const responseHeaders = new Map();
    const res = { statusCode: 200, body: '', setHeader(name, value) { responseHeaders.set(name.toLowerCase(), String(value)); }, end(value) { this.body = value ? String(value) : ''; } };
    await handler({ method, url: path, headers: { host, ...headers } }, res);
    return { ...res, headers: responseHeaders };
  };
  const sync = (overrides = {}) => run(sessionHandler, { path: `/api/application-session?ownerId=${ownerId}&projectId=${projectId}`, headers: { origin, authorization: `Bearer ${token}`, 'sec-fetch-site': 'same-origin' }, ...overrides });
  const page = (cookie, overrides = {}) => run(pageHandler, { method: 'GET', path: `/site/${ownerId}/${projectId}/dashboard.html`, headers: { cookie }, ...overrides });
  let shell = await page('', { headers: { accept: 'text/html' } });
  assert.equal(shell.statusCode, 401);
  assert.match(shell.body, /id="account-form"/);
  assert.match(shell.headers.get('content-type'), /text\/html/);
  assert.match(shell.headers.get('content-security-policy'), /form-action 'none'/);
  assert.ok(!calls.some(url => url.includes('/storage/')), 'Account challenge must not download the private page');
  assert.doesNotMatch(shell.body, /sb_secret_/);
  const embedded = JSON.parse(/<script id="application-auth-config" type="application\/json">(.*?)<\/script>/.exec(shell.body)[1]);
  assert.equal(embedded.backend.url, backend.url);
  assert.equal(embedded.returnPath, `/site/${ownerId}/${projectId}/dashboard.html`);
  shell = await page('', { host: 'tayar.se', headers: { accept: 'text/html' } });
  assert.equal(shell.statusCode, 401);
  assert.doesNotMatch(shell.body, /account-form/);
  shell = await page('', { headers: { accept: 'application/json' } });
  assert.equal(shell.statusCode, 401);
  assert.doesNotMatch(shell.body, /account-form/);
  shell = await page('', { method: 'HEAD', headers: { accept: 'text/html' } });
  assert.equal(shell.statusCode, 401);
  assert.equal(shell.body, '');
  shell = await page('', { path: `/site/${ownerId}/${projectId}/dashboard.html?applicationAuth=1`, headers: { accept: 'text/html' } });
  assert.equal(shell.statusCode, 200);
  assert.match(shell.body, /account-form/);
  assert.ok(!calls.some(url => url.includes('/storage/')));
  let result = await sync();
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).status, 'synchronized');
  const setCookie = result.headers.get('set-cookie');
  assert.match(setCookie, /__Host-tayar-app-session=/);
  assert.match(setCookie, /Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=\d+/);
  assert.doesNotMatch(setCookie, /Domain=/i);
  assert.ok(!result.body.includes(token));
  const cookie = setCookie.split(';')[0];
  result = await page(cookie);
  assert.equal(result.statusCode, 200);
  assert.match(result.body, /Private content/);
  assert.ok(calls.some(url => url.endsWith('/auth/v1/user')), 'Every cookie navigation revalidates with the dedicated Auth server');
  assert.match(result.headers.get('content-security-policy'), /allow-same-origin/);
  assert.match(result.headers.get('cache-control'), /private, no-store/);
  result = await page(cookie, { host: 'tayar.se' });
  assert.equal(result.statusCode, 401);
  assert.doesNotMatch(result.headers.get('content-security-policy'), /allow-same-origin/);
  assert.ok(!calls.some(url => url.includes('/storage/')));
  result = await page(`${cookie}; ${cookie}`);
  assert.equal(result.statusCode, 401, 'Ambiguous duplicate cookies are refused');
  result = await sync({ host: 'tayar.se' });
  assert.equal(result.statusCode, 403);
  assert.equal(calls.length, 0);
  for (const badOrigin of ['null', 'https://other.apps.tayar.example', 'https://tayar.se']) {
    result = await sync({ headers: { origin: badOrigin, authorization: `Bearer ${token}` } });
    assert.equal(result.statusCode, 403);
    assert.equal(calls.length, 0);
    assert.ok(!result.headers.has('set-cookie'));
  }
  assert.equal((await sync({ headers: { origin, authorization: 'Bearer a.b.c' } })).statusCode, 401);
  anonymous = true;
  assert.equal((await sync()).statusCode, 403);
  anonymous = false; confirmed = false;
  assert.equal((await sync()).statusCode, 403);
  confirmed = true;
  const expired = makeToken(Math.floor(Date.now() / 1000) - 30);
  result = await sync({ headers: { origin, authorization: `Bearer ${expired}` } });
  assert.equal(result.statusCode, 401);
  assert.ok(!result.headers.has('set-cookie'));
  authThrows = true;
  result = await sync();
  assert.equal(result.statusCode, 503);
  assert.doesNotMatch(result.body, /sb_secret/);
  authThrows = false;
  result = await sync({ method: 'DELETE', headers: { origin, cookie } });
  assert.equal(result.statusCode, 200);
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
  assert.ok(revoked);
  result = await page(cookie);
  assert.equal(result.statusCode, 401);
  assert.ok(!calls.some(url => url.includes('/storage/')));
  revoked = false; authFails = true;
  assert.equal((await sync()).statusCode, 401);
  authFails = false;
  live = { enabled: true, release: null };
  assert.equal((await sync()).statusCode, 503);
  result = await sync({ method: 'DELETE', headers: { origin, cookie } });
  assert.equal(result.statusCode, 503, 'Unavailable backend must not claim upstream revocation');
  assert.match(result.headers.get('set-cookie'), /Max-Age=0/, 'Unpublish still permits clearing navigation transport');
  assert.ok(!calls.some(url => url.includes('/auth/v1/logout')), 'Never guess the previous backend after unpublish');
  result = await sync({ method: 'DELETE', headers: { origin, cookie, 'sec-fetch-site': 'cross-site' } });
  assert.equal(result.statusCode, 403);
  assert.ok(!result.headers.has('set-cookie'));
  assert.equal(calls.length, 0);
  live = { enabled: true, release };
  delete process.env.WEBSITE_APPLICATION_SESSIONS_ENABLED;
  assert.equal((await sync()).statusCode, 503);
  assert.equal((await page(cookie)).statusCode, 401, 'Cookie transport is opt-in, not globally enabled');
  console.log('PASS actual session/navigation API adapters: host isolation, verified HttpOnly cookie, fresh Auth authorization, scoped CSP, CSRF/duplicate/expired/anonymous denial and logout');
} finally {
  globalThis.fetch = originalFetch;
  for (const key of keys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
}
