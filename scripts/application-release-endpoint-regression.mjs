import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-release-endpoint-'));
const originalFetch = globalThis.fetch;
const originalDeno = globalThis.Deno;
try {
  const outfile = join(dir, 'edge.cjs');
  await build({ entryPoints: ['supabase/functions/website-application-release/index.ts'], bundle: true, platform: 'node', format: 'cjs', outfile,
    plugins: [{ name: 'node-supabase', setup(builder) { builder.onResolve({ filter: /^npm:@supabase\/supabase-js@/ }, () => builder.resolve('@supabase/supabase-js', { resolveDir: process.cwd(), kind: 'import-statement' })); } }],
  });
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const versionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const application = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [] };
  const snapshot = { application, siteName: 'PRIVATE_MARKER', homePageId: 'home', pages: [{ id: 'home', name: 'Home', slug: 'home', sections: [] }] };
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
  const digest = createHash('sha256').update(canonical(snapshot)).digest('hex');
  const env = { SUPABASE_URL: platformUrl, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_platform_fixture' };
  let edge, calls = [], foreign = false, commitFailure = false, statusFailure = false, userAnonymous = false;
  let statusData = null;
  globalThis.Deno = { env: { get: key => env[key] }, serve: handler => { edge = handler; } };
  globalThis.fetch = async (resource, init) => {
    const url = new URL(resource instanceof Request ? resource.url : String(resource));
    calls.push({ url, method: init.method, body: init.body });
    assert.equal(init.redirect, 'error');
    if (url.origin === backend.url) {
      if (url.pathname === '/auth/v1/settings') return Response.json({ external: { email: true, anonymous_users: false }, disable_signup: false, mailer_autoconfirm: false });
      assert.equal(url.pathname, '/rest/v1/rpc/app_deployed_definition');
      return Response.json(application);
    }
    assert.equal(url.origin, platformUrl);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: ownerId, is_anonymous: userAnonymous });
    if (url.pathname === '/rest/v1/projects') {
      assert.equal(url.searchParams.get('user_id'), `eq.${ownerId}`);
      assert.equal(url.searchParams.get('id'), `eq.${projectId}`);
      assert.equal(url.searchParams.get('deleted_at'), 'is.null');
      return Response.json(foreign ? [] : [{ id: projectId, content: snapshot }]);
    }
    if (url.pathname.endsWith('/website_application_published_release')) return statusFailure ? Response.json({ message: 'sb_secret_MUST_NOT_ESCAPE' }, { status: 500 }) : Response.json(statusData);
    if (url.pathname.endsWith('/website_application_release_outcome')) return Response.json('recorded');
    if (url.pathname.endsWith('/website_application_backend_record')) return Response.json({ ...backend, deployedDefinition: application });
    if (url.pathname.endsWith('/website_application_backend_credential')) return Response.json('sb_secret_dedicated_fixture');
    if (url.pathname === '/storage/v1/object/list/published-sites') return Response.json([]);
    if (url.pathname.startsWith('/storage/v1/object/website-application-releases/')) {
      assert.match(init.body, /^<!doctype html>/i);
      return Response.json({ Key: url.pathname, Id: versionId });
    }
    if (url.pathname.endsWith('/website_commit_application_release')) {
      const body = JSON.parse(init.body);
      assert.deepEqual(body.p_snapshot, snapshot);
      assert.deepEqual(body.p_backend, backend);
      assert.equal(body.p_owner_id, ownerId);
      assert.equal(body.p_published_url, `https://${projectId}.apps.tayar.example/site/${ownerId}/${projectId}/`);
      return commitFailure ? Response.json({ message: 'sb_secret_MUST_NOT_ESCAPE' }, { status: 500 }) : Response.json(body.p_version_id);
    }
    throw new Error(`Unexpected endpoint ${url.pathname}`);
  };
  await import(pathToFileURL(outfile));
  const run = (body = { operation: 'status', projectId }, options = {}) => {
    calls = [];
    return edge(new Request('https://platform.example/release', { method: 'POST', headers: { origin: 'https://tayar.se', authorization: 'Bearer a.b.c', 'content-type': 'application/json' }, body: JSON.stringify(body), ...options }));
  };
  let response = await run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { projectId, operation: 'status', privateMode: false, versionId: null, publishingAvailable: false });
  assert.equal(response.headers.get('vary'), 'Authorization, Origin');
  assert.match(response.headers.get('cache-control'), /no-store/);
  statusData = { enabled: true, release: { id: versionId, project_id: projectId, user_id: ownerId, secret: 'sb_secret_MUST_NOT_ESCAPE', snapshot } };
  response = await run();
  assert.deepEqual(await response.json(), { projectId, operation: 'status', privateMode: true, versionId, publishingAvailable: false });
  const publish = { operation: 'publish', projectId, expectedSnapshotDigest: digest };
  assert.equal((await run(publish)).status, 503);
  assert.ok(calls.every(call => !call.url.pathname.includes('/storage/') && !call.url.pathname.includes('/rpc/')));
  env.WEBSITE_APPLICATION_RELEASES_ENABLED = 'true';
  assert.equal((await run(publish)).status, 503, 'Both release and runtime flags required');
  env.WEBSITE_APPLICATION_RUNTIME_ENABLED = 'true';
  env.WEBSITE_APPLICATION_HOST_SUFFIX = 'apps.tayar.example';
  assert.equal((await run(publish)).status, 503, 'Browser session flag is also required');
  env.WEBSITE_APPLICATION_SESSIONS_ENABLED = 'true';
  for (const suffix of ['', 'tayar.se', 'https://apps.tayar.example', 'evil.invalid/path', 'supabase.co']) {
    env.WEBSITE_APPLICATION_HOST_SUFFIX = suffix;
    assert.equal((await run(publish)).status, 503);
    assert.ok(calls.every(call => !call.url.pathname.includes('/storage/') && !call.url.pathname.includes('/rpc/')), 'Invalid host fails before mutation/backend access');
    assert.equal((await (await run()).json()).publishingAvailable, false, 'Read-only status works when host configuration is unavailable');
  }
  env.WEBSITE_APPLICATION_HOST_SUFFIX = 'apps.tayar.example';
  env.WEBSITE_APPLICATION_PUBLISH_ORIGIN = 'https://ignored-untrusted.example';
  assert.equal((await (await run()).json()).publishingAvailable, true);
  response = await run(publish);
  assert.equal(response.status, 201);
  const active = await response.json();
  assert.equal(active.status, 'active');
  assert.equal(active.projectId, projectId);
  assert.match(active.versionId, /^[a-f0-9-]{36}$/);
  response = await run({ ...publish, expectedSnapshotDigest: '0'.repeat(64) });
  assert.equal(response.status, 422);
  assert.ok(calls.every(call => call.url.origin === platformUrl && !call.url.pathname.includes('/storage/') && !call.url.pathname.includes('/rpc/')), 'Wrong whole-project digest stops before remote backend/file access');
  commitFailure = true;
  response = await run(publish);
  assert.equal(response.status, 202);
  assert.equal((await response.json()).status, 'recovery-required');
  assert.ok(calls.every(call => call.method !== 'DELETE'));
  commitFailure = false;
  for (const extra of [{ ownerId }, { html: '<html>forged</html>' }, { backend }, { publishedUrl: 'https://other.example' }]) {
    assert.equal((await run({ ...publish, ...extra })).status, 400);
    assert.equal(calls.length, 0);
  }
  assert.equal((await run({ ...publish, releaseNote: 'x'.repeat(5000) })).status, 400);
  foreign = true;
  assert.equal((await run()).status, 404);
  assert.equal(calls.length, 2);
  foreign = false;
  userAnonymous = true;
  assert.equal((await run()).status, 401);
  assert.equal(calls.length, 1);
  userAnonymous = false;
  response = await run({ operation: 'outcome', projectId, versionId });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { operation: 'outcome', projectId, versionId, status: 'recorded' });
  statusFailure = true;
  response = await run();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /sb_secret/);
  statusFailure = false;
  assert.equal((await run(undefined, { headers: { origin: 'https://untrusted.example' } })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await run(undefined, { headers: { origin: 'https://tayar.se', 'content-type': 'application/json' } })).status, 401);
  assert.equal(calls.length, 0);
  response = await edge(new Request('https://platform.example/release', { method: 'OPTIONS', headers: { origin: 'https://tayar.se' } }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://tayar.se');
  console.log('PASS generated release endpoint: owner scope, closed flags, trusted rendering/upload, whole-project digest, safe status/outcome, uncertain commit, CORS and input denial');
} finally { globalThis.fetch = originalFetch; if (originalDeno === undefined) delete globalThis.Deno; else globalThis.Deno = originalDeno; await rm(dir, { recursive: true, force: true }); }
