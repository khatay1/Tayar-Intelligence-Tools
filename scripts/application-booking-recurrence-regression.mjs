import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-recurrence-')), require = createRequire(import.meta.url), previousFetch = globalThis.fetch;
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', resource = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-booking-recurrence', 'application-validation', 'application-data-runtime', 'application-data-view-controller']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n'));
  await build({ entryPoints: [entry], outfile: join(dir, 'test.cjs'), platform: 'node', format: 'cjs', bundle: true });
  const { expandApplicationBookingRecurrence: expand, applicationBookingOccurrenceIds: ids,
    readApplicationDefinition: validate, createOwnedApplicationDataRuntime: runtimeFor, createApplicationDataViewController: controllerFor } = require(join(dir, 'test.cjs'));
  const table = { id: 'appointments', key: 'appointments', name: 'Appointments', fields: [
    { id: 'resource', key: 'resource_id', name: 'Resource', type: 'uuid', required: true },
    { id: 'start', key: 'starts_at', name: 'Start', type: 'datetime', required: true },
    { id: 'end', key: 'ends_at', name: 'End', type: 'datetime', required: true },
  ], booking: { resourceFieldId: 'resource', startFieldId: 'start', endFieldId: 'end', recurrence: { timeZone: 'Europe/Stockholm', maxOccurrences: 12 } },
  permissions: ['read', 'create', 'update'].map(operation => ({ operation, access: 'owner' })) };
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], pageAccess: [], tables: [table] };
  validate(app);
  const values = { resource_id: resource, starts_at: '2026-10-24T08:00:00Z', ends_at: '2026-10-24T09:00:00Z' };
  const repeat = { frequency: 'weekly', interval: 1, count: 3 }, occurrences = expand(table, values, repeat);
  assert.equal(occurrences[1].starts_at, '2026-10-31T09:00:00.000Z', '10 AM local survives DST');
  assert.equal(occurrences[2].starts_at, '2026-11-07T09:00:00.000Z');
  assert.equal(occurrences[0].resource_id, resource); assert.equal(values.starts_at, '2026-10-24T08:00:00Z');
  for (const bad of [{ ...repeat, count: 1 }, { ...repeat, count: 13 }, { ...repeat, interval: 0 }, { ...repeat, frequency: 'monthly' }, { ...repeat, count: 12, interval: 12 }, { ...repeat, amount: 10 }]) assert.throws(() => expand(table, values, bad));
  for (const recurrence of [{ timeZone: 'invalid/zone', maxOccurrences: 12 }, { timeZone: 'UTC', maxOccurrences: 53 }, { timeZone: 'UTC', maxOccurrences: 1 }])
    assert.throws(() => validate({ ...app, tables: [{ ...table, booking: { ...table.booking, recurrence } }] }));
  assert.throws(() => expand(table, { ...values, starts_at: '2026-03-22T01:30Z', ends_at: '2026-03-22T02:30Z' }, { ...repeat, count: 2 }), /ambiguous or does not exist/);
  assert.throws(() => expand(table, { ...values, starts_at: '2026-10-18T00:30Z', ends_at: '2026-10-18T01:30Z' }, { ...repeat, count: 2 }), /ambiguous or does not exist/);
  const requestIds = await ids(table.id, owner, requestId, 3, webcrypto);
  assert.equal(new Set(requestIds).size, 3); assert.deepEqual(await ids(table.id, owner, requestId, 3, webcrypto), requestIds);
  assert.notDeepEqual(await ids(table.id, other, requestId, 3, webcrypto), requestIds);
  const backend = { projectRef: 'sgewokeojtzsqjaeluan', url: 'https://sgewokeojtzsqjaeluan.supabase.co', publishableKey: 'sb_publishable_recurrence_fixture' };
  const token = 'fixture.session.token123456789';
  let identity = owner, loseResponse = false, lookupDown = false, conflict = false, requests = 0;
  const committed = new Map();
  globalThis.fetch = async (resourceUrl, init) => {
    const url = new URL(String(resourceUrl)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: { id: identity, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: identity, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/app_appointments'); assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    if (init.method === 'POST') {
      requests++; const rows = JSON.parse(init.body); assert(Array.isArray(rows)); assert.equal(rows.length, 3);
      assert(rows.every(row => row.owner_id === owner));
      if (conflict) return Response.json({ code: '23P01', message: 'exclusion violation' }, { status: 409 });
      if (rows.some(row => committed.has(row._tayar_request_id))) return Response.json({ code: '23505', message: 'request already exists' }, { status: 409 });
      for (const row of rows) committed.set(row._tayar_request_id, { ...row, id: row._tayar_request_id });
      if (loseResponse) throw Error('lost response after commit');
      return new Response(null, { status: 201 });
    }
    if (lookupDown) return Response.json({ message: 'temporarily unavailable' }, { status: 503 });
    const lookup = url.searchParams.get('_tayar_request_id'); assert.match(lookup, /^in\.\(/);
    return Response.json([...committed.values()].filter(row => lookup.includes(row._tayar_request_id)));
  };
  const runtime = runtimeFor(app, backend, backend.projectRef);
  try {
    await runtime.auth.signIn('owner@example.com', 'test-password');
    conflict = true; await assert.rejects(runtime.createBookingSeries(table.id, values, repeat, requestId, owner), /already booked/);
    assert.equal(committed.size, 0, 'one rejection leaves no partially committed series'); conflict = false;
    const storage = new Map(), scope = { keyPrefix: 'tayar-app-form:series:project:page', crypto: webcrypto,
      storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
    const binding = { tableId: table.id, columns: ['resource', 'start', 'end'], actions: ['create'], pageSize: 10 };
    let controller = controllerFor(app, binding, runtime, () => requestId, scope);
    loseResponse = true; lookupDown = true;
    await assert.rejects(controller.recur(values, repeat), /uncertain/); assert.equal(committed.size, 3);
    const storedReceipt = [...storage.values()][0]; assert.doesNotMatch(storedReceipt, /resource_id|starts_at|2026/); controller.dispose();
    loseResponse = false; lookupDown = false;
    controller = controllerFor(app, binding, runtime, () => other, scope);
    await controller.recur(values, repeat); assert.equal(committed.size, 3); assert.equal(storage.size, 0);
    identity = other; const beforeChange = requests;
    await assert.rejects(controller.recur(values, repeat), /identity changed/); assert.equal(requests, beforeChange); controller.dispose();
  } finally { runtime.dispose(); }
  console.log('PASS booking recurrence: bounded definitions, local DST calendar, gap/ambiguity denial, one pinned bulk write, all-or-none rejection, lost-response replay and account-change refusal');
} finally { globalThis.fetch = previousFetch; await rm(dir, { recursive: true, force: true }); }
