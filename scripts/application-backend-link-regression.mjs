import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

const dir = await mkdtemp(join(tmpdir(), 'tayar-backend-link-'));
const originalFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'link.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationBackendLinkService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { handleWebsiteApplicationBackendLink, createStoredApplicationRevisionReader } = (await import(pathToFileURL(outfile))).default;
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [] };
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
  const expectedRevision = createHash('sha256').update(canonical(app)).digest('hex');
  const serviceKey = 'sb_secret_dedicated_backend_fixture';
  const token = 'a.b.c';
  let requests = [];
  let project = { content: { application: app } };
  let remoteApp = app;
  let authSettings = { external: { email: true, anonymous_users: false }, disable_signup: false, mailer_autoconfirm: false };
  let user = { id: ownerId, is_anonymous: false };
  let commitStatus = 204;
  let credential = serviceKey;
  globalThis.fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(init.body) : null;
    requests.push({ url, headers, body });
    let result;
    if (url.origin === platformUrl) {
      if (url.pathname === '/auth/v1/user') {
        assert.equal(headers.get('authorization'), `Bearer ${token}`);
        result = user;
      } else if (url.pathname === '/rest/v1/projects') {
        assert.equal(url.searchParams.get('id'), `eq.${projectId}`);
        assert.equal(url.searchParams.get('user_id'), `eq.${ownerId}`);
        assert.equal(url.searchParams.get('type'), 'eq.website-builder');
        assert.equal(url.searchParams.get('deleted_at'), 'is.null');
        result = project ? [project] : [];
      } else if (url.pathname === '/rest/v1/rpc/website_link_application_backend') {
        assert.deepEqual(body, { p_project_id: projectId, p_owner_id: ownerId, p_backend_ref: backend.projectRef, p_publishable_key: backend.publishableKey, p_deployed_definition: app, p_service_key: serviceKey });
        return new Response(commitStatus === 204 ? null : JSON.stringify({ message: serviceKey }), { status: commitStatus });
      } else if (url.pathname === '/rest/v1/rpc/website_application_backend_credential') {
        assert.deepEqual(body, { p_project_id: projectId, p_backend_ref: backend.projectRef });
        result = credential;
      } else throw new Error(`Unexpected platform request ${url.pathname}`);
    } else {
      assert.equal(url.origin, backend.url);
      const isSettings = url.pathname === '/auth/v1/settings';
      if (!isSettings) assert.equal(url.pathname, '/rest/v1/rpc/app_deployed_definition');
      assert.equal(headers.get('apikey'), isSettings ? backend.publishableKey : serviceKey);
      assert.equal(init.redirect, 'error');
      result = isSettings ? authSettings : remoteApp;
    }
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
  };
  const platform = createClient(platformUrl, 'sb_secret_platform_fixture', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const context = { platform, platformUrl };
  const run = (body = { projectId, backend, serviceKey, expectedRevision }, options = {}) => handleWebsiteApplicationBackendLink(new Request('https://tayar.example/link', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), ...options }), context);
  let response = await run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'linked', backend });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(requests.length, 5, 'Authenticate owner, read saved schema, verify remote revision, atomically commit');
  requests = [];
  assert.equal((await run(undefined, { headers: { 'content-type': 'application/json' } })).status, 401);
  assert.equal(requests.length, 0);
  for (const body of [
    { projectId, backend, serviceKey, ownerId },
    { projectId, backend: { ...backend, url: platformUrl }, serviceKey },
    { projectId, backend, serviceKey: 'short' },
    { projectId, backend, serviceKey: 'a'.repeat(33000) },
  ]) assert.equal((await run(body)).status, 400);
  assert.ok(requests.every(request => request.url.pathname === '/auth/v1/user'), 'Invalid input never reads project or sends service credentials');
  requests = [];
  assert.equal((await run({ projectId, backend, serviceKey, expectedRevision: '0'.repeat(64) })).status, 409);
  assert.equal(requests.length, 2, 'Unsaved local definition never reaches the dedicated backend');
  requests = [];
  user = { ...user, is_anonymous: true };
  assert.equal((await run()).status, 401);
  assert.equal(requests.length, 1);
  user = { ...user, is_anonymous: false };
  project = null;
  requests = [];
  assert.equal((await run()).status, 404);
  assert.equal(requests.length, 2, 'Foreign/deleted/missing project never contacts supplied backend');
  project = { content: {} };
  assert.equal((await run()).status, 409);
  project = { content: { application: app } };
  remoteApp = { ...app, auth: { ...app.auth, signUpEnabled: false } };
  requests = [];
  assert.equal((await run()).status, 409);
  assert.equal(requests.length, 4, 'Schema drift never stores binding or credential');
  remoteApp = app;
  requests = [];
  authSettings.mailer_autoconfirm = true;
  assert.equal((await run()).status, 409);
  assert.ok(!requests.some(request => request.url.pathname.endsWith('/website_link_application_backend')), 'Unsafe Auth settings never commit a binding');
  authSettings.mailer_autoconfirm = false;
  commitStatus = 409;
  response = await run();
  assert.equal(response.status, 409);
  assert.doesNotMatch(await response.text(), /sb_secret/);
  commitStatus = 204;
  const reader = await createStoredApplicationRevisionReader({ platform, platformUrl, projectId, backend });
  assert.deepEqual(await reader.readDeployedDefinition(), app);
  credential = null;
  await assert.rejects(() => createStoredApplicationRevisionReader({ platform, platformUrl, projectId, backend }), /credential is unavailable/);
  const edgeOutfile = join(dir, 'edge.cjs');
  await build({ entryPoints: ['supabase/functions/website-application-backend-link/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: edgeOutfile,
    plugins: [{ name: 'node-supabase', setup(builder) {
      builder.onResolve({ filter: /^npm:@supabase\/supabase-js@/ }, () => builder.resolve('@supabase/supabase-js', { resolveDir: process.cwd(), kind: 'import-statement' }));
    } }],
  });
  let edgeHandler;
  const env = { SUPABASE_URL: platformUrl, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_platform_fixture' };
  globalThis.Deno = { env: { get: key => env[key] }, serve: handler => { edgeHandler = handler; } };
  try {
    await import(pathToFileURL(edgeOutfile));
    requests = [];
    response = await edgeHandler(new Request('https://platform.example/link', { method: 'OPTIONS', headers: { origin: 'https://tayar.se' } }));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://tayar.se');
    response = await edgeHandler(new Request('https://platform.example/link', { method: 'POST', headers: { origin: 'https://untrusted.example' } }));
    assert.equal(response.status, 403);
    assert.equal(requests.length, 0, 'Disallowed origin never reaches authentication or credentials');
    response = await edgeHandler(new Request('https://platform.example/link', { method: 'POST', headers: { origin: 'https://tayar.se', authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ projectId, backend, serviceKey, expectedRevision }) }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://tayar.se');
    assert.equal(response.headers.get('vary'), 'Origin');
    assert.doesNotMatch(await response.text(), /sb_secret/);
    assert.equal(requests.length, 5, 'Generated Edge entrypoint executes the same verified linking flow');
  } finally { delete globalThis.Deno; }
  console.log('PASS backend link HTTP flow: owner isolation, saved definition, actual revision request, atomic credential commit, safe public response and scoped credential retrieval');
} finally {
  globalThis.fetch = originalFetch;
  await rm(dir, { recursive: true, force: true });
}
