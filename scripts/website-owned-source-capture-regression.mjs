import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-owned-capture-'));
try {
  const outfile = join(dir, 'capture.cjs');
  await build({ entryPoints: ['server/website-owned-source-capture.ts'], bundle: true,
    plugins: [{ name: 'local-esbuild', setup(plugin) {
      plugin.onResolve({ filter: /^esbuild$/ }, () => ({ path: import.meta.resolve('esbuild').replace(/^file:\/\//, ''), external: true }));
    } }], platform: 'node', format: 'cjs', outfile });
  const { captureWebsiteOwnedApplicationSource: capture } = (await import(pathToFileURL(outfile))).default;
  const defaultsFile = join(dir, 'defaults.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/defaults.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: defaultsFile });
  const { createSection } = (await import(pathToFileURL(defaultsFile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222', ownerId = '11111111-1111-4111-8111-111111111111';
  const githubId = '33333333-3333-4333-8333-333333333333';
  const supabaseId = '44444444-4444-4444-8444-444444444444';
  const vercelId = '55555555-5555-4555-8555-555555555555';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan',
    publishableKey: 'sb_publishable_customer_fixture' };
  let snapshot = { homePageId: 'home', siteName: 'Owned App', application: { version: 1,
    tables: [], roles: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, pageAccess: [] },
    pages: [{ id: 'home', name: 'Home', slug: 'home', language: 'en', sections: [createSection('hero')] }],
    supabaseUrl: 'https://platform.invalid', supabaseAnonKey: 'PLATFORM_SECRET_NEVER_EXPORT' };
  const common = { ownerId, projectId, environment: 'production', permissions: ['read'], status: 'ready', version: 1,
    operationId: null, verifiedAt: '2026-09-29T00:00:00Z', updatedAt: '2026-09-29T00:00:00Z' };
  const records = {
    [githubId]: { ...common, id: githubId, provider: 'github', accountId: '77', targetId: '88',
      status: 'connected', permissions: ['contents:write'] },
    [supabaseId]: { ...common, id: supabaseId, provider: 'supabase', accountId: 'customer-org', targetId: backend.projectRef },
    [vercelId]: { ...common, id: vercelId, provider: 'vercel', accountId: 'team-customer', targetId: 'prj_customer', status: 'connected' },
  };
  let binding = { projectId, ownerId, environment: 'production', supabaseConnectionId: supabaseId,
    vercelConnectionId: vercelId, applicationOrigin: 'https://customer-app.example', backend };
  let verified = true, checks = 0;
  const reader = {
    async readSavedProject() { return { projectId, ownerId, snapshot: structuredClone(snapshot) }; },
    async readConnection(id, project, owner) { assert.equal(project, projectId); assert.equal(owner, ownerId);
      return records[id] ? structuredClone(records[id]) : null; },
    async readOwnedRuntimeBinding(project, owner, environment) {
      assert.deepEqual([project, owner, environment], [projectId, ownerId, 'production']);
      return structuredClone(binding);
    },
  };
  const args = { projectId, ownerId, githubConnectionId: githubId, environment: 'production',
    platformOrigin: 'https://tayar.example', platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co', reader,
    async verifyRuntime(current, supabase, vercel, capabilities) { checks++;
      assert.equal(current.backend.projectRef, backend.projectRef);
      assert.equal(capabilities.definition.auth.enabled, true);
      assert.equal(supabase.provider, 'supabase'); assert.equal(vercel.provider, 'vercel'); return verified; } };
  const source = await capture(args);
  assert.deepEqual(source.files.map(file => file.path), ['api/application.js', 'package.json', 'vercel.json']);
  assert.equal(source.capabilities.needs.auth, true);
  assert(source.files.every(file => !file.content.includes('PLATFORM_SECRET_NEVER_EXPORT')));
  assert.equal(await source.isCurrent(), true);
  assert(checks >= 3);
  source.binding.applicationOrigin = 'https://evil.example';
  assert.equal(await source.isCurrent(), true, 'Returned binding cannot mutate captured identity');
  const original = structuredClone(binding);
  binding = { ...binding, applicationOrigin: 'https://other-owned.example' };
  assert.equal(await source.isCurrent(), false, 'Origin switch invalidates source');
  binding = original;
  records[supabaseId] = { ...records[supabaseId], version: 2, accountId: 'another-org' };
  assert.equal(await source.isCurrent(), false, 'Supabase account switch invalidates source');
  records[supabaseId] = { ...records[supabaseId], version: 1, accountId: 'customer-org' };
  records[vercelId] = { ...records[vercelId], status: 'credentials-revoked' };
  assert.equal(await source.isCurrent(), false, 'Revoked Vercel connection invalidates source');
  records[vercelId] = { ...records[vercelId], status: 'connected' };
  verified = false;
  assert.equal(await source.isCurrent(), false, 'Live verifier failure invalidates source');
  verified = true;
  snapshot = { ...snapshot, siteName: 'Updated' };
  assert.equal(await source.isCurrent(), false, 'Saved project update invalidates source');
  snapshot = { ...snapshot, siteName: 'Owned App' };
  binding = { ...binding, backend: { ...backend, projectRef: 'aaaaaaaaaaaaaaaaaaaa' } };
  await assert.rejects(capture(args));
  binding = original;
  records[supabaseId] = { ...records[supabaseId], status: 'connected' };
  await assert.rejects(capture(args));
  console.log('PASS owned source capture: saved owner and provider scope, compiled package, stale project/account/origin/revoke and verifier denial');
} finally { await rm(dir, { recursive: true, force: true }); }
