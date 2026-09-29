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
  const { createIsolatedApplicationClient, createApplicationDataRuntime, createOwnedApplicationDataRuntime,
    validateOwnedApplicationPublicBackend, canAccessApplicationPage } = (await import(pathToFileURL(outfile))).default;
  const platform = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const config = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const app = {
    version: 1, roles: [], pageAccess: [], auth: { enabled: false, signUpEnabled: false, emailVerificationRequired: true },
    tables: [{ id: 'vehicles', key: 'vehicles', name: 'Vehicles', fields: [{ id: 'plate', key: 'plate', name: 'Plate', type: 'text', required: true }], permissions: [{ operation: 'read', access: 'public' }] }],
  };
  const legacyAnon = `a.${Buffer.from(JSON.stringify({ iss: 'supabase', ref: config.projectRef, role: 'anon' })).toString('base64url')}.signature`;
  const serviceRole = `a.${Buffer.from(JSON.stringify({ iss: 'supabase', ref: config.projectRef, role: 'service_role' })).toString('base64url')}.signature`;
  assert.ok(createIsolatedApplicationClient({ ...config, publishableKey: legacyAnon }, platform));
  const platformAnon = `a.${Buffer.from(JSON.stringify({ iss: 'supabase', ref: 'pnbllxdlskljcakyaylt', role: 'anon' })).toString('base64url')}.signature`;
  assert.throws(() => createIsolatedApplicationClient({ ...config, publishableKey: platformAnon }, platform), /public anon/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, publishableKey: serviceRole }, platform), /public anon/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, publishableKey: 'sb_secret_private' }, platform), /public anon/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, url: platform }, platform), /identity/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, projectRef: 'aaaaaaaaaaaaaaaaaaaa' }, platform), /identity/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, url: 'http://sgewokeojtzsqjaeluan.supabase.co' }, platform), /HTTPS/);
  assert.throws(() => createIsolatedApplicationClient({ ...config, url: 'https://sgewokeojtzsqjaeluan.supabase.co.evil.invalid' }, platform), /HTTPS/);

  const requests = [];
  let denyCreate = false, recoveredPlate = 'ABC', omitRecoveredField = false, switchUserAfterInsert = false;
  const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const otherUserId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  let currentUserId = userId;
  const token = `a.${Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    requests.push({ url, init });
    if (url.includes('/auth/v1/token')) return Response.json({ access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600,
      user: { id: userId, is_anonymous: false } });
    if (url.includes('/auth/v1/user')) return Response.json({ id: currentUserId, is_anonymous: false });
    if (url.includes('/rpc/app_set_user_role')) return new Response(null, { status: 204 });
    if (init?.method === 'POST' && url.includes('/rest/v1/app_vehicles')) {
      if (switchUserAfterInsert) currentUserId = otherUserId;
      return denyCreate ? Response.json({ message: 'SECRET_DATABASE_ERROR' }, { status: 403 }) : new Response(null, { status: 201 });
    }
    if (url.includes('/rest/v1/app_vehicles') && new URL(url).searchParams.has('_tayar_request_id')) {
      return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', ...(omitRecoveredField ? {} : { plate: recoveredPlate }) });
    }
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
    await runtime.list('vehicles', { sort: { field: 'plate', direction: 'asc' }, filters: [{ field: 'plate', operator: 'eq', value: 'ABC' }] });
    assert.match(requests.at(-1).url, /plate=eq\.ABC/);
    assert.match(requests.at(-1).url, /plate\.asc/);
    await assert.rejects(() => runtime.list('vehicles', { filters: [{ field: 'platform_users', operator: 'eq', value: 'x' }] }), /Invalid query filter/);
    await assert.rejects(() => runtime.list('vehicles', { sort: { field: 'owner_id;drop table', direction: 'asc' } }), /Invalid sort/);
    await assert.rejects(() => runtime.list('vehicles', { filters: [{ field: 'plate', operator: 'ilike', value: 'A'.repeat(501) }] }), /Invalid query filter/);
    await assert.rejects(() => runtime.list('vehicles', { filters: Array.from({ length: 11 }, () => ({ field: 'plate', operator: 'eq', value: 'A' })) }), /Invalid query filters/);
    assert.deepEqual(await runtime.auth.currentRoles(), []);
    assert.equal(await runtime.auth.canAccessPage('landing'), true);
    const roleApp = structuredClone(app);
    roleApp.auth.enabled = true;
    roleApp.roles = [{ id: 'staff', name: 'Staff' }];
    roleApp.pageAccess = [{ pageId: 'dashboard', access: 'authenticated' }, { pageId: 'staff-area', access: 'role', roleId: 'staff' }];
    assert.equal(canAccessApplicationPage(roleApp, 'landing', null), true);
    assert.equal(canAccessApplicationPage(roleApp, 'dashboard', null), false);
    assert.equal(canAccessApplicationPage(roleApp, 'dashboard', { is_anonymous: true }), false);
    assert.equal(canAccessApplicationPage(roleApp, 'dashboard', { is_anonymous: false }), true);
    assert.equal(canAccessApplicationPage(roleApp, 'staff-area', { is_anonymous: false }, ['staff']), true);
    assert.equal(canAccessApplicationPage(roleApp, 'staff-area', { is_anonymous: false }, []), false);
    const roleRuntime = createApplicationDataRuntime(roleApp, config, platform);
    assert.equal(await roleRuntime.auth.canAccessPage('dashboard'), false);
    await assert.rejects(() => roleRuntime.auth.setUserRole('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'invented', true), /Unknown application role/);
    await assert.rejects(() => roleRuntime.auth.setUserRole('bad-id', 'staff', true), /valid record ID/);
    await roleRuntime.auth.setUserRole('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'staff', true);
    assert.match(requests.at(-1).url, /^https:\/\/sgewokeojtzsqjaeluan\.supabase\.co\/rest\/v1\/rpc\/app_set_user_role/);
    const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const createApp = structuredClone(roleApp);
    createApp.tables[0].permissions.push({ operation: 'create', access: 'owner' });
    const once = createApplicationDataRuntime(createApp, config, platform);
    const beforeSignIn = requests.length;
    await assert.rejects(() => once.createOnce('vehicles', { plate: 'ABC' }, requestId), /identity is unavailable/);
    assert.ok(!requests.slice(beforeSignIn).some(item => item.init?.method === 'POST' && item.url.includes('/rest/v1/app_vehicles')));
    await once.auth.signIn('owner@example.invalid', 'fixture-password');
    assert.equal(await once.createOnce('vehicles', { plate: 'ABC' }, requestId), 'created');
    const inserted = requests.findLast(item => item.init?.method === 'POST' && item.url.includes('/rest/v1/app_vehicles'));
    assert.equal(new URL(inserted.url).pathname, '/rest/v1/app_vehicles');
    assert.deepEqual(JSON.parse(inserted.init.body), { plate: 'ABC', _tayar_request_id: requestId });
    assert.equal(new Headers(inserted.init.headers).get('apikey'), config.publishableKey);
    const beforeInvalid = requests.length;
    await assert.rejects(() => once.createOnce('vehicles', { owner_id: 'forged' }, requestId));
    await assert.rejects(() => once.createOnce('vehicles', { plate: 'ABC' }, 'not-a-uuid'));
    assert.equal(requests.length, beforeInvalid);
    denyCreate = true;
    assert.equal(await once.createOnce('vehicles', { plate: 'ABC' }, requestId), 'already-created');
    const lookup = requests.at(-1);
    assert.equal(new URL(lookup.url).searchParams.get('select'), 'id,plate');
    assert.equal(new URL(lookup.url).searchParams.get('owner_id'), `eq.${userId}`);
    recoveredPlate = 'OTHER';
    await assert.rejects(() => once.createOnce('vehicles', { plate: 'ABC' }, requestId), /outcome is uncertain/);
    omitRecoveredField = true;
    await assert.rejects(() => once.createOnce('vehicles', { plate: 'ABC' }, requestId), /outcome is uncertain/);
    omitRecoveredField = false; recoveredPlate = 'ABC'; switchUserAfterInsert = true;
    const beforeSwitch = requests.length;
    await assert.rejects(() => once.createOnce('vehicles', { plate: 'ABC' }, requestId), /outcome is uncertain/);
    assert.ok(!requests.slice(beforeSwitch).some(item => new URL(item.url).searchParams.has('_tayar_request_id')),
      'A switched user cannot reconcile the previous owner request');
    assert.doesNotThrow(() => validateOwnedApplicationPublicBackend(config, config.projectRef));
    for (const invalid of [{ ...config, publishableKey: serviceRole },
      { ...config, publishableKey: 'sb_secret_private' },
      { ...config, projectRef: 'aaaaaaaaaaaaaaaaaaaa' },
      { ...config, url: platform }]) {
      assert.throws(() => createOwnedApplicationDataRuntime(app, invalid, config.projectRef), /backend identity|HTTPS/);
    }
    const owned = createOwnedApplicationDataRuntime(app, config, config.projectRef);
    const ownedRows = await owned.list('vehicles', { limit: 1 });
    assert.equal(ownedRows.length, 1);
    assert.match(requests.at(-1).url, /^https:\/\/sgewokeojtzsqjaeluan\.supabase\.co\/rest\/v1\/app_vehicles/);
    assert.ok(!requests.at(-1).url.includes('pnbllxdlskljcakyaylt'));
    owned.dispose();
    once.dispose();
  } finally { globalThis.fetch = previousFetch; }
  console.log('PASS isolated/owned application client: public-only keys, project boundary, shared CRUD whitelist and dedicated endpoint');
} finally { await rm(dir, { recursive: true, force: true }); }
