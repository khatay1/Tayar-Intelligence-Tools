import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-app-runtime-'));
try {
  const outfile = join(dir, 'runtime.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-data-runtime.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createIsolatedApplicationClient, createApplicationDataRuntime } = (await import(pathToFileURL(outfile))).default;
  const platform = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const config = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const app = {
    version: 1, roles: [], pageAccess: [], auth: { enabled: false, signUpEnabled: false, emailVerificationRequired: true },
    tables: [{ id: 'vehicles', key: 'vehicles', name: 'Vehicles', fields: [{ id: 'plate', key: 'plate', name: 'Plate', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'public' }] }],
  };
  const legacyAnon = `a.${Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url')}.signature`;
  const serviceRole = `a.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
  assert.ok(createIsolatedApplicationClient({ ...config, publishableKey: legacyAnon }, platform));
  assert.throws(() => createIsolatedApplicationClient({ ...config, publishableKey: serviceRole }, platform), /public anon/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, publishableKey: 'sb_secret_private' }, platform), /public anon/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, url: platform }, platform), /identity/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, projectRef: 'aaaaaaaaaaaaaaaaaaaa' }, platform), /identity/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, url: 'http://sgewokeojtzsqjaeluan.supabase.co' }, platform), /HTTPS/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, url: 'https://sgewokeojtzsqjaeluan.supabase.co.evil.invalid' }, platform), /HTTPS/);

  const requests = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({ url: input instanceof Request ? input.url : String(input), init });
    return new Response(JSON.stringify([{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', plate: 'ABC' }]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const runtime = createApplicationDataRuntime(app, config, platform);
    await assert.rejects(() => runtime.auth.signUp('x@example.invalid', 'password'), /disabled/);
    await assert.rejects(() => runtime.list('platform_users'), /Unknown application table/);
    await assert.rejects(() => runtime.list('vehicles', { limit: 500 }), /Invalid pagination/);
    await assert.rejects(() => runtime.create('vehicles', { owner_id: 'someone' }), /Only declared/);
    await assert.rejects(() => runtime.update('vehicles', 'not-a-uuid', { plate: 'ABC' }), /valid record ID/);
    const rows = await runtime.list('vehicles', { limit: 10, offset: 5 });
    assert.equal(rows.length, 1);
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /^https:\/\/sgewokeojtzsqjaeluan\.supabase\.co\/rest\/v1\/app_vehicles\?/);
    assert.match(requests[0].url, /offset=5|limit=10/);
    assert.doesNotMatch(requests[0].url, /pnbllxdlskljcakyaylt/);
  } finally { globalThis.fetch = previousFetch; }
  console.log('PASS isolated application client: public-only keys, project boundary, CRUD whitelist and dedicated endpoint');
} finally { await rm(dir, { recursive: true, force: true }); }
