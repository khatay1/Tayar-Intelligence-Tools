import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-stock-holds-'));
const require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const item = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherItem = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const location = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const reservation = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const repeat = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const concurrent1 = '11111111-2222-4333-8444-555555555555';
const concurrent2 = '11111111-3333-4333-8444-555555555555';

try {
  const entry = join(dir, 'entry.ts'), outfile = join(dir, 'runtime.cjs');
  await writeFile(entry, [
    "export { compileApplicationInventoryReservationSchema } from " + JSON.stringify(resolve('src/modules/website-builder/core/application-inventory-reservation-sql')) + ';',
    "export { applicationCounterInfrastructure, compileApplicationCounterSchema } from " + JSON.stringify(resolve('src/modules/website-builder/core/application-counter-sql')) + ';',
    "export { verifyOwnedStockReservationCatalog } from " + JSON.stringify(resolve('server/website-owned-stock-reservation-catalog')) + ';',
    "export { verifyOwnedStockReservationInstallation } from " + JSON.stringify(resolve('server/website-owned-stock-reservation-installation')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { compileApplicationInventoryReservationSchema: reservations, applicationCounterInfrastructure: infrastructure, compileApplicationCounterSchema: counters, verifyOwnedStockReservationCatalog: verifyCatalog, verifyOwnedStockReservationInstallation: verifyInstallation } = require(outfile);
  const app = {
    version: 1, auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    pageAccess: [], roles: [], tables: [{
      id: 'products', key: 'products', name: 'Products',
      fields: [{ id: 'quantity', key: 'quantity', name: 'Stock', type: 'number', required: true, defaultValue: 0 }],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      counter: { fieldId: 'quantity', minimum: 0, integer: true },
    }],
  };
  const sql = reservations(app, 'products').join('\n');
  assert.match(sql, /for update/);
  assert.match(sql, /app_stock_reservation_floor_0/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /app_adjust_counter_0/);
  assert.throws(() => reservations({ ...app, auth: { ...app.auth, enabled: false } }, 'products'));
  assert.throws(() => reservations(app, 'missing'));
  assert.throws(() => reservations({ ...app, tables: app.tables.map(table => ({ ...table, counter: undefined })) }, 'products'));
  if (!process.argv.includes('--postgres')) {
    console.log('PASS static inventory reservation SQL contract (no database claims)');
    process.exit(0);
  }

  const databaseUrl = process.env.TAYAR_INVENTORY_RESERVATION_TEST_DATABASE_URL;
  const url = new URL(databaseUrl ?? 'https://invalid.invalid');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.pathname !== '/tayar_inventory_reservation_test') throw Error('Dedicated local PostgreSQL fixture required.');
  const query = statement => new Promise((resolveQuery, reject) => {
    const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'],
      { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject);
    child.on('close', status => status === 0 ? resolveQuery(stdout.trim()) : reject(Error(stderr)));
    child.stdin.end(statement);
  });
  const auth = `create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    grant usage on schema auth to authenticated;
    create schema private;
    create table public.app_products (id uuid primary key, owner_id uuid not null, quantity numeric not null default 0);
    alter table public.app_products enable row level security;
    create policy owner_rw on public.app_products for all to authenticated
      using(owner_id = auth.uid()) with check(owner_id = auth.uid());
    grant usage on schema public to authenticated;
    grant select,update on public.app_products to authenticated;`;
  await query([auth, ...infrastructure(), ...counters(app, 0), sql].join('\n'));
  await query(`insert into public.app_products(id,owner_id) values ('${item}','${owner}'),('${otherItem}','${owner}');`);
  const login = who => `set role authenticated;
    select set_config('request.jwt.claim.sub','${who}',false),
      set_config('request.jwt.claims','{"is_anonymous":false}',false);`;
  const reserve = (thing, id, n, who=owner) => query(`${login(who)}
    select public.app_stock_reserve_0('${thing}','${location}','${id}',${n});`);
  const finalize = (id, action, who=owner) => query(`${login(who)}
    select public.app_stock_finalize_0('${id}','${action}');`);
  await query(`${login(owner)} select public.app_adjust_counter_0('${item}',10,gen_random_uuid());
    select public.app_adjust_counter_0('${otherItem}',10,gen_random_uuid());`);
  assert.match(await reserve(item,reservation,7),/reserved$/);
  assert.match(await reserve(item,reservation,7),/already-reserved$/);
  await assert.rejects(reserve(item,reservation,8),/identity mismatch/);
  await assert.rejects(reserve(item,repeat,4),/exceeds availability/);
  await assert.rejects(reserve(item,repeat,1,foreign),/unavailable/);
  await assert.rejects(query(`${login(owner)}
    select public.app_adjust_counter_0('${item}',-4,gen_random_uuid());`),/cross reservations/);
  const results = await Promise.allSettled([concurrent1,concurrent2].map(id => reserve(otherItem,id,7)));
  assert.equal(results.filter(value => value.status === 'fulfilled').length,1,'competing reservations cannot oversell');
  assert.match(await finalize(reservation,'fulfill'),/fulfilled$/);
  assert.match(await finalize(reservation,'fulfill'),/already-fulfilled$/);
  await assert.rejects(finalize(reservation,'release'),/already settled/);
  assert.equal(await query(`select quantity from public.app_products where id='${item}';`),'3');
  assert.match(await reserve(item,repeat,2),/reserved$/);
  await assert.rejects(query(`${login(owner)}
    select public.app_adjust_counter_0('${item}',-2,gen_random_uuid());`),/cross reservations/);
  assert.match(await finalize(repeat,'release'),/released$/);
  assert.equal(await query(`select quantity from public.app_products where id='${item}';`),'3');
  await assert.rejects(query(`${login(owner)}
    update private.app_stock_reservations_0 set status='fulfilled';`),/permission denied/);
  await assert.rejects(query(`set role anon;
    select public.app_stock_reserve_0('${item}','${location}',gen_random_uuid(),1);`),/permission denied/);
  assert.equal(await query(`select count(*) from private.app_stock_reservations_0
    where actor_id='${owner}' and item_id='${item}';`),'2');
  let proofRows = [];
  const verify = () => verifyCatalog(app, 'products', async statement => {
    const rows = JSON.parse(await query(`select coalesce(json_agg(row),'[]') from (${statement}) row;`));
    proofRows.push(rows);
    return rows;
  });
  const verified = await verify();
  if (!verified) {
    const manifest = [...sql.matchAll(/create function (private|public)\.(app_stock_[a-z0-9_]+)\(([^)]*)\) returns (text|trigger) language (plpgsql|sql) security (definer|invoker) set search_path = '' as \$(stock_[a-z]+)\$([\s\S]*?)\$\7\$;/g)]
      .map(x => ({ key: x[1] + '.' + x[2], args: x[3], source: x[8], result: x[4], lang: x[5], definer: x[6] === 'definer' }));
    console.error('Stock proof diagnostics:', JSON.stringify({ manifest: manifest.map(x => x.key), queries: proofRows.map((rows,index) => ({
      index, rows: rows.map(row => index === 0 ? {
        key: row.schema_name + '.' + row.function_name, args:row.arguments, result:row.result, lang:row.language,
        definer:row.security_definer, volatile:row.volatility, owner:row.owner_name, config:row.configuration,
        anon:row.anon_execute, authenticated:row.authenticated_execute,
        matchSource:manifest.find(x => x.key === row.schema_name + '.' + row.function_name)?.source === row.source,
        sourceLength:row.source?.length, expectedLength:manifest.find(x => x.key === row.schema_name + '.' + row.function_name)?.source?.length,
        sourceStart:row.source?.slice(0,90), expectedStart:manifest.find(x => x.key === row.schema_name + '.' + row.function_name)?.source?.slice(0,90),
      } : row),
    })) }));
  }
  assert.equal(verified, true, 'Exact stock functions, private receipt schema and trigger must be verified');
  // Exercise the real read-only Supabase Management API binding against this
  // isolated PostgreSQL catalog. No customer token, account or host is used.
  const connectionId = '99999999-9999-4999-8999-999999999999';
  const projectId = '88888888-8888-4888-8888-888888888888';
  const projectRef = 'abcdefghijklmnopqrst';
  const connection = {
    id: connectionId, ownerId: owner, projectId, provider: 'supabase', environment: 'preview',
    accountId: 'account-owner', targetId: projectRef, permissions: ['database:read'],
    status: 'ready', version: 4, operationId: null,
    verifiedAt: '2026-10-16T12:00:00.000Z', updatedAt: '2026-10-16T12:00:00.000Z',
  };
  let currentConnection = structuredClone(connection);
  let allowed = true, networkCalls = 0, connectionReads = 0;
  const attestation = {
    ownerId: owner, projectId, environment: 'preview', connectionId, connectionVersion: 4,
    definition: app, itemTableId: 'products', accessToken: 'fixture-only-no-customer-credentials',
    async isCurrent() { return allowed; },
    async readConnection() { connectionReads++; return structuredClone(currentConnection); },
    async fetcher(url, init) {
      networkCalls++;
      assert.equal(url, 'https://api.supabase.com/v1/projects/' + projectRef + '/database/query/read-only');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.Authorization, 'Bearer fixture-only-no-customer-credentials');
      const statement = JSON.parse(init.body).query;
      assert.match(statement, /^select /i);
      const rows = JSON.parse(await query(`select coalesce(json_agg(row),'[]') from (${statement}) row;`));
      return Response.json(rows, { status: 201 });
    },
  };
  assert.equal(await verifyInstallation(attestation), true,
    'The live catalog must be attested only via exact owner-owned read-only Supabase project');
  assert.equal(networkCalls, 4, 'Catalog evidence is read-only and bounded to four queries');
  const noNetwork = async (overrides, reason) => {
    const before = networkCalls;
    assert.equal(await verifyInstallation({ ...attestation, ...overrides }), false, reason);
    assert.equal(networkCalls, before, 'Invalid scope must fail before network traffic');
  };
  await noNetwork({ ownerId: foreign }, 'An unrelated owner cannot reuse a connection');
  await noNetwork({ projectId: foreign }, 'A different project cannot reuse connection');
  await noNetwork({ connectionId: foreign }, 'A different connection ID is unavailable');
  await noNetwork({ connectionVersion: 3 }, 'Old connection version is unavailable');
  await noNetwork({ environment: 'production' }, 'Preview proof cannot cross into Production');
  await noNetwork({ itemTableId: 'missing' }, 'Unknown item table blocks evidence');
  await noNetwork({ accessToken: 'token\nmalformed' }, 'Invalid custody token must not be used');
  allowed = false;
  await noNetwork({}, 'Stale source scope cannot reuse catalog evidence');
  allowed = true;
  for (const change of [
    { ownerId: foreign }, { projectId: foreign }, { provider: 'github' },
    { environment: 'production' }, { version: 5 }, { status: 'setup-incomplete' },
    { permissions: [] }, { targetId: null }, { targetId: 'wrong-host' },
  ]) {
    currentConnection = { ...connection, ...change };
    await noNetwork({}, 'Only exact owner-bound ready Supabase connections may supply evidence');
  }
  currentConnection = structuredClone(connection);
  let reads = 0;
  assert.equal(await verifyInstallation({ ...attestation, async readConnection() {
    reads++;
    return reads === 1 ? structuredClone(connection) : { ...connection, version: 5 };
  } }), false, 'Connection rotation during catalog read invalidates attestation');
  currentConnection = structuredClone(connection);
  assert.equal(await verifyInstallation(attestation), true, 'Current connection restores attestation');

  await query('revoke execute on function public.app_stock_reserve_0(uuid,uuid,uuid,numeric) from authenticated;');
  assert.equal(await verify(), false, 'Permission drift must block publication');
  assert.equal(await verifyInstallation(attestation), false, 'Read-only installation check refuses grant drift');
  await query('grant execute on function public.app_stock_reserve_0(uuid,uuid,uuid,numeric) to authenticated;');
  assert.equal(await verify(), true, 'Restored exact grants allow proof');
  await query('alter table public.app_products disable trigger app_stock_reservation_floor_0;');
  assert.equal(await verify(), false, 'Disabled reservation floor prevents proof');
  assert.equal(await verifyInstallation(attestation), false, 'Read-only installation check refuses disabled floor trigger');
    console.log('PASS actual PostgreSQL stock reservation: auth, rollback, concurrent holds, immutable receipts, floor trigger and idempotent fulfillment');
} finally {
  await rm(dir, { recursive: true, force: true });
}
