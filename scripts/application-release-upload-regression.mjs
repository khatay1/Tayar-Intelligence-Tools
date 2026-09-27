import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-release-upload-'));
const originalFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'upload.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationReleaseService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { publishWebsiteApplicationRelease: publish, inspectWebsiteApplicationReleaseOutcome: inspect } = (await import(pathToFileURL(outfile))).default;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const application = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] };
  const snapshot = { application, homePageId: 'home', pages: [{ id: 'home', name: 'Home', slug: 'home', sections: [] }, { id: 'dashboard', name: 'Dashboard', slug: 'dashboard', sections: [] }] };
  const files = [{ name: 'index.html', contentType: 'text/html', pageId: 'home', content: '<html>Home</html>' }, { name: 'dashboard.html', contentType: 'text/html', pageId: 'dashboard', content: '<html>Private</html>' }];
  let options, events, payload;
  globalThis.fetch = async resource => {
    const url = String(resource);
    if (url === `${backend.url}/auth/v1/settings`) return Response.json({ external: { email: true, anonymous_users: false }, disable_signup: false, mailer_autoconfirm: false });
    assert.equal(url, `${backend.url}/rest/v1/rpc/app_deployed_definition`);
    return Response.json(application);
  };
  const platform = {
    auth: { async getUser(token) { assert.equal(token, 'owner-token'); events.push('identity'); return options.unauthorized ? { data: { user: null }, error: {} } : { data: { user: { id: ownerId } }, error: null }; } },
    from(table) {
      assert.equal(table, 'projects');
      const query = { select() { return query; }, eq(key, value) { events.push([key, value]); return query; }, is(key, value) { assert.equal(key, 'deleted_at'); assert.equal(value, null); return query; },
        async maybeSingle() { return { data: options.foreign ? null : { content: snapshot }, error: null }; } };
      return query;
    },
    async rpc(name, args) {
      events.push(name);
      if (name === 'website_application_backend_record') return { data: { ...backend, deployedDefinition: options.backendDrift && events.filter(event => event === name).length > 2 ? { ...application, auth: { ...application.auth, signUpEnabled: false } } : application }, error: null };
      if (name === 'website_application_backend_credential') return { data: 'sb_secret_dedicated_fixture', error: null };
      if (name === 'website_application_release_outcome') { assert.equal(args.p_owner_id, ownerId); return { data: options.outcome, error: null }; }
      assert.equal(name, 'website_commit_application_release');
      payload = args;
      if (options.commitThrow) throw new Error('SECRET credential must not escape');
      if (options.commitError) return { error: { message: 'SECRET credential must not escape' }, data: null };
      return { data: args.p_version_id, error: null };
    },
    storage: { from(bucket) { return {
      async list(prefix, opts) { assert.equal(bucket, 'published-sites'); assert.equal(prefix, `${ownerId}/${projectId}`); assert.equal(opts.limit, 1); return { data: options.publicCopies ? [{ name: 'staging' }] : [], error: null }; },
      async upload(path, content, opts) {
        assert.equal(bucket, 'website-application-releases'); assert.equal(opts.upsert, false);
        assert.ok(path.startsWith(`${ownerId}/${projectId}/versions/`));
        events.push(['upload', path, content]);
        if (options.uploadError && path.endsWith('dashboard.html')) return { error: { message: 'SECRET' } };
        return { error: null };
      },
      async remove(paths) { assert.equal(bucket, 'website-application-releases'); events.push(['remove', paths]); return { error: options.cleanupError ? {} : null }; },
    }; } },
  };
  const run = async (overrides = {}) => {
    options = overrides; events = []; payload = undefined;
    const request = { platform, platformUrl, accessToken: 'owner-token', projectId, publishedUrl: `https://tayar.se/site/${ownerId}/${projectId}/`, async renderSnapshot(saved, config) {
      assert.deepEqual(saved, snapshot); assert.deepEqual(config, backend);
      saved.pages[0].slug = 'renderer-mutated-copy';
      if (options.rendererError) throw new Error('SECRET renderer error');
      const output = structuredClone(files);
      if (options.badPage) output[1].pageId = 'home';
      return output;
    } };
    if (options.defaultRenderer) delete request.renderSnapshot;
    return publish(request);
  };
  let result = await run();
  assert.equal(result.status, 'active');
  assert.deepEqual(payload.p_snapshot, snapshot, 'Renderer mutations cannot alter committed snapshot');
  assert.deepEqual(payload.p_backend, backend);
  assert.equal(payload.p_owner_id, ownerId);
  assert.equal(payload.p_version_id, result.versionId);
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'user_id' && event[1] === ownerId));
  assert.equal(events.at(-1), 'website_commit_application_release');
  assert.equal(events.filter(event => event === 'website_application_backend_credential').length, 2, 'Backend reverified after upload');
  result = await run({ defaultRenderer: true });
  assert.equal(result.status, 'active');
  assert.equal(events.filter(event => Array.isArray(event) && event[0] === 'upload').length, 2);
  for (const event of events.filter(event => Array.isArray(event) && event[0] === 'upload')) assert.match(event[2], /^<!doctype html>/i);
  for (const denied of [{ unauthorized: true }, { foreign: true }, { publicCopies: true }, { badPage: true }, { rendererError: true }]) {
    result = await run(denied);
    assert.equal(result.status, 'failed');
    assert.ok(!events.some(event => Array.isArray(event) && event[0] === 'upload'));
    assert.ok(!payload);
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
  result = await run({ uploadError: true });
  assert.deepEqual({ status: result.status, cleanupRequired: result.cleanupRequired }, { status: 'failed', cleanupRequired: false });
  assert.equal(events.at(-1)[0], 'remove');
  assert.equal(events.at(-1)[1].length, 2, 'Includes ambiguous failing upload path in precommit cleanup');
  assert.ok(!payload);
  result = await run({ backendDrift: true });
  assert.equal(result.status, 'failed');
  assert.equal(events.at(-1)[0], 'remove');
  assert.ok(!payload, 'Backend drift after upload must prevent activation');
  result = await run({ uploadError: true, cleanupError: true });
  assert.equal(result.cleanupRequired, true);
  for (const uncertain of [{ commitThrow: true }, { commitError: true }]) {
    result = await run(uncertain);
    assert.equal(result.status, 'recovery-required');
    assert.ok(result.versionId);
    assert.ok(!events.some(event => Array.isArray(event) && event[0] === 'remove'), 'Never delete artifacts after ambiguous activation');
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
  for (const outcome of ['selected', 'recorded', 'unresolved', 'SECRET invalid response']) {
    options = { outcome }; events = [];
    assert.equal(await inspect({ platform, projectId, versionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accessToken: 'owner-token' }), outcome.startsWith('SECRET') ? 'unavailable' : outcome);
    assert.ok(!events.some(event => Array.isArray(event) && event[0] === 'remove'));
  }
  options = { unauthorized: true }; events = [];
  assert.equal(await inspect({ platform, projectId, versionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', accessToken: 'owner-token' }), 'unavailable');
  assert.deepEqual(events, ['identity']);
  console.log('PASS private release owner authorization, scoped upload, manifest guard, recheck, compensation and ambiguous commit preservation');
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
