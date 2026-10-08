import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-counter-')), require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const row = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', request = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const originalFetch = globalThis.fetch;
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-model', 'application-validation', 'application-schema-sql', 'application-counter', 'application-counter-sql', 'application-form-runtime', 'application-data-runtime', 'application-data-view-controller']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n') + `\nexport * from ${JSON.stringify(resolve('server/website-owned-counter-catalog'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'counter.cjs') });
  const { compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate, readApplicationDefinition: validate,
    applicationCounterInfrastructure: infrastructure, compileApplicationCounterSchema: counterSql, parseApplicationCounterDelta: delta,
    createOwnedApplicationDataRuntime: runtimeFor, createApplicationDataViewController: controllerFor, verifyOwnedCounterCatalog: verify } = require(join(dir, 'counter.cjs'));
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, tables: [
    { id: 'products', key: 'products', name: 'Products', fields: [{ id: 'product_name', key: 'name', name: 'Name', type: 'text', required: true },
      { id: 'stock', key: 'quantity', name: 'Stock', type: 'number', required: true, defaultValue: 0 }],
      permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })), counter: { fieldId: 'stock', minimum: 0, maximum: 100, integer: true } },
  ] };
  const table = app.tables[0], sql = compile(app).join('\n');
  assert.match(sql, /for update/); assert.match(sql, /on conflict on constraint app_counter_requests_pkey/);
  assert.match(sql, /atomic adjustment/); assert.match(sql, /security invoker/);
  for (const rule of [{ ...table.counter, fieldId: 'product_name' }, { ...table.counter, minimum: 1 }, { ...table.counter, maximum: -1 }, { ...table.counter, integer: 'yes' }, { ...table.counter, secret: 'no' }]) assert.throws(() => validate({ ...app, tables: [{ ...table, counter: rule }] }));
  for (const invalid of [0, NaN, Infinity, '', 0.5, 1e13]) assert.throws(() => delta(table, invalid));
  assert.equal(delta(table, '-5'), -5);
  const before = { ...app, tables: [{ ...table, counter: undefined }] };
  assert.match(migrate(before, app).join('\n'), /app_counter_guard/);
  assert.throws(() => migrate(app, before), /reviewed/);
  const reduced = { ...app, tables: [{ ...table, permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'authenticated' }] }] };
  const permissionUpgrade = migrate(app, reduced).join('\n');
  assert.match(permissionUpgrade, /create or replace function private.app_adjust_counter_0/);
  assert.doesNotMatch(permissionUpgrade, /create trigger app_counter_guard/);
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_counter_fixture' };
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  let balance = 0, calls = 0, lost = false, identity = owner;
  const receipts = new Map();
  globalThis.fetch = async (resourceUrl, init) => {
    const url = new URL(String(resourceUrl)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: identity, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: identity, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/rpc/app_adjust_counter_0'); calls++;
    const args = JSON.parse(init.body); assert.equal(args.record_id, row); assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    if (receipts.has(args.request_id)) return Response.json('already-adjusted');
    if (balance + args.adjustment < 0 || balance + args.adjustment > 100) return Response.json({ code: 'P0001', message: 'Counter adjustment exceeds allowed bounds' }, { status: 400 });
    balance += args.adjustment; receipts.set(args.request_id, args); if (lost) throw new TypeError('Lost response after commit'); return Response.json('adjusted');
  };
  const runtime = runtimeFor(app, backend, backend.projectRef), storage = new Map();
  const scope = { keyPrefix: 'tayar-app-form:counter:project:page:data:products', crypto: webcrypto,
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  try {
    await runtime.auth.signIn('test@example.com', 'test-password');
    const binding = { tableId: 'products', columns: ['product_name', 'stock'], actions: ['adjust'], pageSize: 10 };
    const controller = controllerFor(app, binding, runtime, () => request, scope);
    await controller.adjust(row, 10); assert.equal(balance, 10);
    await assert.rejects(controller.adjust(row, -11), /allowed bounds/); assert.equal(storage.size, 0);
    await controller.adjust(row, -5); assert.equal(balance, 5);
    lost = true; await assert.rejects(controller.adjust(row, 2), /uncertain/); assert.equal(balance, 7);
    const pending = [...storage.values()][0]; assert.doesNotMatch(pending, /recordId|delta|products/);
    controller.dispose(); lost = false;
    const replay = controllerFor(app, binding, runtime, () => request, scope); await replay.adjust(row, 2);
    assert.equal(balance, 7); assert.equal(storage.size, 0);
    identity = other; const beforeWrong = calls;
    await assert.rejects(runtime.adjustCounter('products', row, 1, request, owner), /identity changed/); assert.equal(calls, beforeWrong);
    replay.dispose();
  } finally { runtime.dispose(); }
  console.log('PASS generic counters: definitions, permission-safe migrations, actual isolated SDK atomic RPC, bounds and durable no-duplicate replay');

  const probeTable = 'create temporary table app_products(id uuid primary key, owner_id uuid not null default auth.uid(), name text not null, quantity numeric not null default 0);';
  const probeStatements = [...infrastructure(), ...counterSql(app, 0)].map(statement => statement.replaceAll('private.', 'tayar_counter_private.').replaceAll('schema private', 'schema tayar_counter_private').replaceAll('public.', 'tayar_counter_public.').replaceAll('tayar_counter_public."app_products"', 'pg_temp."app_products"'));
  const probe = `begin; create schema tayar_counter_private; create schema tayar_counter_public; grant usage on schema tayar_counter_public to authenticated;
${probeTable}\n${probeStatements.join('\n')}
grant select,insert,update,delete on pg_temp.app_products to authenticated;
select set_config('request.jwt.claim.sub','${owner}',true),set_config('request.jwt.claims','{"sub":"${owner}","is_anonymous":false}',true);
set local role authenticated; insert into pg_temp.app_products(id,name) values ('${row}','Product');
select tayar_counter_public.app_adjust_counter_0('${row}',10,'${request}');
select tayar_counter_public.app_adjust_counter_0('${row}',10,'${request}');
do $test$ begin
 if (select quantity from pg_temp.app_products where id='${row}') <> 10 then raise exception 'Duplicate adjustment'; end if;
 begin update pg_temp.app_products set quantity=99; raise exception 'Direct overwrite accepted'; exception when raise_exception then if SQLERRM <> 'Counter changes require an atomic adjustment' then raise; end if; end;
 begin perform tayar_counter_public.app_adjust_counter_0('${row}',-11,gen_random_uuid()); raise exception 'Underflow accepted'; exception when raise_exception then if SQLERRM <> 'Counter adjustment exceeds allowed bounds' then raise; end if; end;
end $test$;
select 'counter real database RPC, bounds, overwrite guard and replay passed' as result; rollback;`;
  if (process.env.TAYAR_COUNTER_PROBE_SQL) await writeFile(process.env.TAYAR_COUNTER_PROBE_SQL, probe);
  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tayar_booking_test') throw Error('Isolated local fixture database required.');
    const query = text => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject);
      child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(text);
    });
    // The booking regression created auth/roles/private in this isolated service.
    await query('drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;');
    await query(sql); await query(probe);
    const asUser = user => `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`;
    await query(`${asUser(owner)} insert into public.app_products(id,name) values ('${row}','Product'); select public.app_adjust_counter_0('${row}',10,'${request}');`);
    const results = await Promise.allSettled([1, 2].map(() => query(`${asUser(owner)} select public.app_adjust_counter_0('${row}',-7,gen_random_uuid());`)));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(await query(`select quantity from public.app_products where id='${row}';`), '3');
    await assert.rejects(query(`${asUser(other)} select public.app_adjust_counter_0('${row}',1,gen_random_uuid());`), /unavailable/);
    await assert.rejects(query(`${asUser(owner)} update public.app_products set quantity=30;`), /atomic adjustment/);
    await assert.rejects(query(`${asUser(owner)} insert into private.app_counter_requests values ('${owner}',gen_random_uuid(),'app_products','${row}',1);`), /permission denied/);
    const replayId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const same = await Promise.all([1, 2].map(() => query(`${asUser(owner)} select public.app_adjust_counter_0('${row}',1,'${replayId}');`)));
    assert.ok(same.some(result => result.endsWith('already-adjusted'))); assert.equal(await query(`select quantity from public.app_products where id='${row}';`), '4');
    const catalogRows = [];
    const valid = await verify(app, async text => {
      const rows = JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${text}) x;`));
      catalogRows.push(rows);
      return rows;
    });
    if (!valid) console.error('Counter fixture catalog diagnostics:', JSON.stringify(catalogRows));
    assert.equal(valid, true, 'Actual counter functions, private ledger and guards match strict catalog');
    await query('alter table public.app_products disable trigger app_counter_guard;');
    assert.equal(await verify(app, async text => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${text}) x;`))), false);
    console.log('PASS actual PostgreSQL generic counters: competing deductions, idempotent concurrent retry, owner denial, direct-write/receipt denial and catalog drift');
  }
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
