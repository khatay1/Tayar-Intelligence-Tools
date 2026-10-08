import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-transaction-')), require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const itemA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', itemB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const request = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const originalFetch = globalThis.fetch;
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-model', 'application-validation', 'application-schema-sql', 'application-transaction', 'application-transaction-sql', 'application-form-runtime', 'application-data-runtime', 'application-data-view-controller']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n') + `\nexport * from ${JSON.stringify(resolve('server/website-owned-transaction-catalog'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'transaction.cjs') });
  const { compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate, readApplicationDefinition: validate,
    parseApplicationTransactionLines: parseLines, createOwnedApplicationDataRuntime: runtimeFor,
    createApplicationDataViewController: controllerFor, verifyOwnedTransactionCatalog: verify } = require(join(dir, 'transaction.cjs'));
  const products = { id: 'products', key: 'products', name: 'Products', fields: [
    { id: 'product_name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'product_stock', key: 'quantity', name: 'Stock', type: 'number', required: true, defaultValue: 0 },
  ], permissions: [{ operation: 'read', access: 'authenticated' }, { operation: 'update', access: 'authenticated' }], counter: { fieldId: 'product_stock', minimum: 0, maximum: 100, integer: true } };
  const orders = { id: 'orders', key: 'orders', name: 'Orders', fields: [{ id: 'order_note', key: 'note', name: 'Note', type: 'text', required: true }],
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
    transaction: { itemTableId: 'products', lineTableId: 'order_lines', lineTransactionFieldId: 'line_order', lineItemFieldId: 'line_item', lineQuantityFieldId: 'line_quantity', counterDirection: 'decrement' } };
  const lines = { id: 'order_lines', key: 'order_lines', name: 'Order lines', fields: [
    { id: 'line_order', key: 'order_id', name: 'Order', type: 'reference', required: true, referenceTableId: 'orders' },
    { id: 'line_item', key: 'product_id', name: 'Product', type: 'reference', required: true, referenceTableId: 'products' },
    { id: 'line_quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true },
  ], permissions: [{ operation: 'read', access: 'owner' }] };
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, tables: [products, orders, lines] };
  const sql = compile(app).join('\n'); validate(app);
  assert.match(sql, /app_create_transaction_1/); assert.match(sql, /order by "itemId"/); assert.match(sql, /app_transaction_requests_pkey/);
  assert.match(sql, /Application transaction exceeds allowed bounds/); assert.match(sql, /security invoker/);
  assert.deepEqual(parseLines(orders, products, [{ itemId: itemA, quantity: '2' }]), [{ itemId: itemA, quantity: 2 }]);
  for (const invalid of [[], [{ itemId: itemA, quantity: 0 }], [{ itemId: itemA, quantity: 1 }, { itemId: itemA, quantity: 2 }], [{ itemId: 'bad', quantity: 1 }]]) assert.throws(() => parseLines(orders, products, invalid));
  for (const transaction of [{ ...orders.transaction, lineTableId: 'orders' }, { ...orders.transaction, counterDirection: 'sideways' }, { ...orders.transaction, lineQuantityFieldId: 'line_item' }, { ...orders.transaction, secret: 'no' }]) {
    assert.throws(() => validate({ ...app, tables: [products, { ...orders, transaction }, lines] }));
  }
  const before = { ...app, tables: [products, { ...orders, transaction: undefined }, lines] };
  assert.match(migrate(before, app).join('\n'), /app_create_transaction_1/);
  assert.throws(() => migrate(app, before), /reviewed/);
  const changedProducts = { ...products, permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }] };
  assert.match(migrate(app, { ...app, tables: [changedProducts, orders, lines] }).join('\n'), /create or replace function private.app_create_transaction_1/);

  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_transaction_fixture' };
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  let identity = owner, lost = false, calls = 0, balances = new Map([[itemA, 10], [itemB, 8]]); const receipts = new Map();
  globalThis.fetch = async (resourceUrl, init) => {
    const url = new URL(String(resourceUrl)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: identity, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: identity, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/rpc/app_create_transaction_1'); calls++;
    const args = JSON.parse(init.body); assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    if (receipts.has(args.request_id)) return Response.json(receipts.get(args.request_id));
    if (args.lines.some(line => balances.get(line.itemId) < line.quantity)) return Response.json({ code: 'P0001', message: 'Application transaction exceeds allowed bounds' }, { status: 400 });
    for (const line of args.lines) balances.set(line.itemId, balances.get(line.itemId) - line.quantity);
    const result = { status: 'created', id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }; receipts.set(args.request_id, { ...result, status: 'already-created' });
    if (lost) throw new TypeError('Lost response after commit'); return Response.json(result);
  };
  const runtime = runtimeFor(app, backend, backend.projectRef), storage = new Map();
  const scope = { keyPrefix: 'tayar-app-form:transaction:project:page:data:orders', crypto: webcrypto,
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  try {
    await runtime.auth.signIn('test@example.com', 'test-password');
    const binding = { tableId: 'orders', columns: ['order_note'], actions: ['transact'], pageSize: 10 };
    const controller = controllerFor(app, binding, runtime, () => request, scope);
    await controller.transact({ note: 'First' }, [{ itemId: itemA, quantity: 2 }, { itemId: itemB, quantity: 3 }]); assert.deepEqual([...balances.values()], [8, 5]);
    await assert.rejects(controller.transact({ note: 'Too much' }, [{ itemId: itemA, quantity: 9 }]), /allowed bounds/); assert.equal(storage.size, 0);
    lost = true; await assert.rejects(controller.transact({ note: 'Retry' }, [{ itemId: itemA, quantity: 1 }]), /uncertain/); assert.equal(balances.get(itemA), 7);
    assert.doesNotMatch([...storage.values()][0], /First|Retry|itemId|quantity|orders/); controller.dispose(); lost = false;
    const replay = controllerFor(app, binding, runtime, () => request, scope); await replay.transact({ note: 'Retry' }, [{ itemId: itemA, quantity: 1 }]);
    assert.equal(balances.get(itemA), 7); assert.equal(storage.size, 0); identity = other; const beforeWrong = calls;
    await assert.rejects(runtime.createTransaction('orders', { note: 'Wrong user' }, [{ itemId: itemA, quantity: 1 }], request, owner), /identity changed/); assert.equal(calls, beforeWrong); replay.dispose();
  } finally { runtime.dispose(); }
  console.log('PASS generic transactions: strict definitions, permission-safe migrations, isolated SDK, atomic bounds and durable replay');

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tayar_booking_test') throw Error('Isolated local fixture database required.');
    const query = text => new Promise((resolveQuery, reject) => { const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject); child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(text); });
    await query('drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;'); await query(sql);
    const asUser = user => `set role authenticated; set request.jwt.claim.sub to '${user}';`;
    await query(`insert into public.app_products(id,owner_id,name) values ('${itemA}','${owner}','A'),('${itemB}','${owner}','B');`);
    await query(`${asUser(owner)} select public.app_adjust_counter_0('${itemA}',10,gen_random_uuid()); select public.app_adjust_counter_0('${itemB}',10,gen_random_uuid());`);
    const created = JSON.parse(await query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"First"}'::jsonb,'[{"itemId":"${itemA}","quantity":2},{"itemId":"${itemB}","quantity":3}]'::jsonb,'${request}');`));
    assert.equal(created.status, 'created'); assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`), '8');
    const replay = JSON.parse(await query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"First"}'::jsonb,'[{"quantity":3,"itemId":"${itemB}"},{"quantity":2,"itemId":"${itemA}"}]'::jsonb,'${request}');`));
    assert.equal(replay.status, 'already-created'); assert.equal(replay.id, created.id); assert.equal(await query('select count(*) from public.app_orders;'), '1'); assert.equal(await query('select count(*) from public.app_order_lines;'), '2');
    const beforeA = await query(`select quantity from public.app_products where id='${itemA}';`), beforeB = await query(`select quantity from public.app_products where id='${itemB}';`);
    await assert.rejects(query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Fail all"}'::jsonb,'[{"itemId":"${itemA}","quantity":1},{"itemId":"${itemB}","quantity":99}]'::jsonb,gen_random_uuid());`), /exceeds allowed bounds/);
    assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`), beforeA); assert.equal(await query(`select quantity from public.app_products where id='${itemB}';`), beforeB);
    const competing = await Promise.allSettled([1, 2].map(n => query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Race ${n}"}'::jsonb,'[{"itemId":"${itemA}","quantity":5}]'::jsonb,gen_random_uuid());`)));
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1); assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`), '3');
    await assert.rejects(query(`${asUser(owner)} insert into public.app_order_lines(order_id,product_id,quantity) values ('${created.id}','${itemA}',1);`), /permission denied/);
    const catalogRows = []; const valid = await verify(app, async text => { const rows = JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${text}) x;`)); catalogRows.push(rows); return rows; });
    if (!valid) console.error('Transaction fixture catalog diagnostics:', JSON.stringify(catalogRows)); assert.equal(valid, true, 'Actual transaction functions, ledger and constraints match strict catalog');
    await query('alter table public.app_order_lines drop constraint app_transaction_quantity_1;');
    assert.equal(await verify(app, async text => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${text}) x;`))), false);
    console.log('PASS actual PostgreSQL generic transactions: multi-row rollback, deterministic locks, concurrency, replay, line denial and catalog drift');
  }
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
