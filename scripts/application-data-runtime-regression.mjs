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
    assert.deepEqual(JSON.parse(inserted.init.body), { plate: 'ABC', owner_id: userId, _tayar_request_id: requestId });
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
    // Exercise stock through the REAL Supabase SDK transport and the existing
    // owned runtime, rather than a hand-written RPC bridge. PostgreSQL semantics
    // remain covered by application-inventory-reservation-postgres-regression.
    const stockApp = { ...structuredClone(app), auth: { ...app.auth, enabled: true }, tables: [{
      id: 'items', key: 'items', name: 'Items',
      fields: [{ id: 'quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 }],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      counter: { fieldId: 'quantity', minimum: 0, integer: true },
    }] };
    assert.equal(owned.stockReservations, undefined);
    assert.equal(createApplicationDataRuntime(stockApp, config, platform).stockReservations, undefined);
    for (const invalid of [[], ['missing'], ['items', 'items'], ['vehicles'], 'items']) {
      assert.throws(() => createOwnedApplicationDataRuntime(stockApp, config, config.projectRef, undefined, invalid),
        /Customer inventory action unavailable/);
    }
    const selection = ['items'];
    let stockRuntime;
    let stockCalls = 0, switchOnStock = false, closeOnStock = false, providerError = false, anonymous = false;
    const previousStockFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: currentUserId, is_anonymous: anonymous });
      if (!url.includes('/rpc/app_stock_')) return previousStockFetch(input, init);
      stockCalls++;
      assert.equal(new URL(url).origin, config.url);
      assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
      assert.equal(new Headers(init.headers).get('apikey'), config.publishableKey);
      const args = JSON.parse(init.body);
      assert.ok(!Object.hasOwn(args, 'owner_id'), 'The user cannot supply the database actor');
      if (switchOnStock) currentUserId = otherUserId;
      if (closeOnStock) stockRuntime.dispose();
      if (providerError) return Response.json({ message: 'SECRET_STOCK_SQL' }, { status: 403 });
      if (url.endsWith('/app_stock_available_0')) return Response.json(3);
      if (url.endsWith('/app_stock_reserve_0')) {
        assert.deepEqual(args, { item_id: userId, location_id: otherUserId, reservation_id: requestId, amount: 2 });
        return Response.json('reserved');
      }
      assert.equal(url.endsWith('/app_stock_finalize_0'), true);
      return Response.json(args.decision === 'release' ? 'released' : 'fulfilled');
    };
    stockRuntime = createOwnedApplicationDataRuntime(stockApp, config, config.projectRef, undefined, selection);
    selection[0] = 'injected';
    assert.throws(() => stockRuntime.stockReservations('injected', userId), /inventory action unavailable/);
    assert.throws(() => stockRuntime.stockReservations('items', undefined), /inventory action unavailable/);
    const stock = stockRuntime.stockReservations('items', userId);
    try {
      currentUserId = userId;
      await assert.rejects(stock.available(userId), /inventory action unavailable/);
      assert.equal(stockCalls, 0, 'No stock request before sign-in');
      await stockRuntime.auth.signIn('stock-owner@example.invalid', 'fixture-password');
      assert.equal(await stock.available(userId), 3);
      assert.equal(await stock.reserve(userId, otherUserId, requestId, 2), 'reserved');
      assert.equal(await stock.settle(requestId, 'release'), 'released');
      assert.equal(await stock.settle(requestId, 'fulfill'), 'fulfilled');
      const beforeStockInvalid = stockCalls;
      await assert.rejects(stock.reserve(userId, otherUserId, requestId, 0), /inventory action unavailable/);
      currentUserId = otherUserId;
      await assert.rejects(stock.available(userId), /inventory action unavailable/);
      currentUserId = userId; anonymous = true;
      await assert.rejects(stock.available(userId), /inventory action unavailable/);
      assert.equal(stockCalls, beforeStockInvalid, 'Invalid input, anonymous and changed actors must never invoke stock RPC');
      anonymous = false; providerError = true;
      await assert.rejects(stock.available(userId), error => !String(error).includes('SECRET_STOCK_SQL') && /inventory action unavailable/.test(String(error)));
      providerError = false; switchOnStock = true;
      await assert.rejects(stock.available(userId), /inventory action unavailable/);
      currentUserId = userId; switchOnStock = false; closeOnStock = true;
      await assert.rejects(stock.reserve(userId, otherUserId, requestId, 2), /inventory action unavailable/);
      const closedCount = stockCalls;
      await assert.rejects(stock.available(userId), /inventory action unavailable/);
      assert.equal(stockCalls, closedCount, 'A retained stock handle cannot outlive runtime disposal');
    } finally { stockRuntime.dispose(); globalThis.fetch = previousStockFetch; }
    owned.dispose();
    once.dispose();
  } finally { globalThis.fetch = previousFetch; }
  console.log('PASS isolated/owned application client: public-only keys, project boundary, shared CRUD whitelist and dedicated endpoint');
} finally { await rm(dir, { recursive: true, force: true }); }
