import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-workflow-')), originalFetch = globalThis.fetch;
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const row = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', request = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stock = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', supplier = '12121212-1212-4121-8121-121212121212';
const otherRow = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', otherStock = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const otherSupplier = '13131313-1313-4131-8131-131313131313';
const otherRequest = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-validation', 'application-schema-sql', 'application-workflow', 'application-data-runtime', 'application-data-view-controller']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n') + `\nexport * from ${JSON.stringify(resolve('server/website-owned-workflow-catalog'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'test.cjs') });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate,
    availableApplicationWorkflowTransitions: available, createOwnedApplicationDataRuntime: runtimeFor,
    createApplicationDataViewController: controllerFor, verifyOwnedWorkflowCatalog: verify } = createRequire(import.meta.url)(join(dir, 'test.cjs'));
  const table = { id: 'orders', key: 'orders', name: 'Orders', fields: [
    { id: 'name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'attempts', key: 'attempts', name: 'Attempts', type: 'number', required: true, defaultValue: 0 },
    { id: 'approved-at', key: 'approved_at', name: 'Approved at', type: 'datetime', required: false },
    { id: 'stock-ref', key: 'stock_id', name: 'Stock', type: 'reference', required: true, referenceTableId: 'stock' },
    { id: 'supplier-ref', key: 'supplier_id', name: 'Supplier', type: 'reference', required: true, referenceTableId: 'supplier' },
    { id: 'state', key: 'state', name: 'State', type: 'enum', required: true, options: ['pending', 'approved', 'done'], defaultValue: 'pending' }],
    permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })),
    workflow: { fieldId: 'state', transitions: [{ id: 'approve', label: 'Approve', from: ['pending'], to: 'approved', access: 'owner', effects: [
      { operation: 'set', fieldId: 'name', value: 'Approved order' }, { operation: 'increment', fieldId: 'attempts', amount: 2 },
      { operation: 'timestamp', fieldId: 'approved-at' },
      { operation: 'related', referenceFieldId: 'stock-ref', fieldId: 'stock-quantity', change: { operation: 'increment', amount: -2 } },
      { operation: 'related', referenceFieldId: 'supplier-ref', fieldId: 'supplier-code', change: { operation: 'set', value: 'supplier-complete' } }] },
      { id: 'finish', label: 'Finish', from: ['approved'], to: 'done', access: 'owner' }] } };
  const stockTable = { id: 'stock', key: 'stock', name: 'Stock', fields: [
    { id: 'stock-name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'stock-quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 100 }],
    permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })) };
  const supplierTable = { id: 'supplier', key: 'supplier', name: 'Suppliers', fields: [
    { id: 'supplier-name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'supplier-credit', key: 'credit', name: 'Credit', type: 'number', required: true, defaultValue: 100 },
    { id: 'supplier-code', key: 'code', name: 'Code', type: 'text', required: true, unique: true }],
    permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })) };
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, tables: [table, stockTable, supplierTable] };
  validate(app);
  assert.deepEqual(available(table, 'pending').map(item => item.id), ['approve']);
  assert.deepEqual(available(table, 'done'), []);
  for (const workflow of [{ ...table.workflow, fieldId: 'name' }, { ...table.workflow, transitions: [] },
    ...[{ from: ['missing'] }, { from: ['pending', 'pending'] }, { to: 'pending' }, { access: 'public' }, { access: 'role', roleId: 'missing' }]
      .map(change => ({ ...table.workflow, transitions: [{ ...table.workflow.transitions[0], ...change }] }))]) {
    assert.throws(() => validate({ ...app, tables: [{ ...table, workflow }, stockTable] }));
  }
  for (const effects of [[], [{ operation: 'increment', fieldId: 'attempts', amount: 0 }],
    [{ operation: 'timestamp', fieldId: 'name' }], [{ operation: 'set', fieldId: 'attempts', value: 'two' }],
    [{ operation: 'set', fieldId: 'state', value: 'done' }], [{ operation: 'set', fieldId: 'missing', value: 'x' }],
    [{ operation: 'set', fieldId: 'name', value: 'x', secret: 'no' }],
    [{ operation: 'set', fieldId: 'name', value: 'x' }, { operation: 'set', fieldId: 'name', value: 'y' }]]) {
    const workflow = { ...table.workflow, transitions: [{ ...table.workflow.transitions[0], effects }] };
    assert.throws(() => validate({ ...app, tables: [{ ...table, workflow }, stockTable] }));
  }
  for (const effect of [
    { operation: 'related', referenceFieldId: 'missing', fieldId: 'stock-quantity', change: { operation: 'increment', amount: 1 } },
    { operation: 'related', referenceFieldId: 'stock-ref', fieldId: 'stock-quantity', change: { operation: 'increment', amount: 0 } },
  ]) {
    const workflow = { ...table.workflow, transitions: [{ ...table.workflow.transitions[0], effects: [effect] }] };
    assert.throws(() => validate({ ...app, tables: [{ ...table, workflow }, stockTable] }));
  }
  const duplicateTarget = structuredClone(app);
  duplicateTarget.tables[0].workflow.transitions[0].effects.push({ operation: 'related', referenceFieldId: 'supplier-ref', fieldId: 'supplier-credit', change: { operation: 'increment', amount: 1 } });
  assert.throws(() => validate(duplicateTarget), /one row per related table/i);
  const overLimit = structuredClone(app);
  for (const id of ['warehouse', 'carrier', 'account']) {
    overLimit.tables[0].fields.push({ id: `${id}-ref`, key: `${id}_id`, name: id, type: 'reference', required: true, referenceTableId: id });
    overLimit.tables.push({ id, key: id, name: id, fields: [{ id: `${id}-quantity`, key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 }],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }] });
    overLimit.tables[0].workflow.transitions[0].effects.push({ operation: 'related', referenceFieldId: `${id}-ref`, fieldId: `${id}-quantity`, change: { operation: 'increment', amount: 1 } });
  }
  assert.throws(() => validate(overLimit), /at most four related tables/i);
  const noTargetUpdate = { ...stockTable, permissions: stockTable.permissions.filter(rule => rule.operation !== 'update') };
  assert.throws(() => validate({ ...app, tables: [table, noTargetUpdate] }), /Related effects require/);
  const before = { ...app, tables: [{ ...table, workflow: undefined }, stockTable, supplierTable] };
  assert.match(migrate(before, app).join('\n'), /create trigger app_workflow_guard/);
  const changedEffect = structuredClone(app);
  changedEffect.tables[0].workflow.transitions[0].effects[3].change.amount = -3;
  assert.throws(() => migrate(app, changedEffect), /workflow rules/);
  const changedTargetPermissions = structuredClone(app);
  changedTargetPermissions.tables[1].permissions = changedTargetPermissions.tables[1].permissions.map(rule => ({ ...rule, access: 'authenticated' }));
  assert.match(migrate(app, changedTargetPermissions).join('\n'), /create or replace function public\.app_transition_workflow_0/);
  const schema = compile(app).join('\n');
  assert.match(schema, /set "state"=requested_to,"name"='Approved order',"attempts"="attempts"\+2,"approved_at"=pg_catalog\.transaction_timestamp\(\)/);
  assert.match(schema, /created_at timestamptz not null default pg_catalog\.transaction_timestamp\(\)/);
  assert.match(schema, /app_workflow_requests_record_created_idx/);
  assert.match(schema, /app_workflow_request_immutable/);
    assert.doesNotMatch(schema.match(/update public\."app_orders" set[^;]+;/)?.[0] ?? '', /,,/);
  assert.match(schema, /select id,owner_id into related_record_0,related_owner_0 from public\."app_stock"/);
  assert.match(schema, /select id,owner_id into related_record_1,related_owner_1 from public\."app_supplier"/);
  assert.ok(schema.indexOf('from public."app_stock"') < schema.indexOf('from public."app_supplier"'), 'related records lock in stable table-key order');
  assert.match(schema, /if not found or not \(related_owner_0 = actor\) or not \(related_owner_0 = actor\)/);
  assert.match(schema, /update public\."app_stock" set "quantity"="quantity"\+-2 where id=related_record_0/);
  assert.match(schema, /update public\."app_supplier" set "code"='supplier-complete' where id=related_record_1/);
  assert.throws(() => migrate(app, before), /reviewed/);
  const permissions = migrate(app, { ...app, tables: [{ ...table, permissions: table.permissions.map(item => ({ ...item, access: 'authenticated' })) }, stockTable, supplierTable] }).join('\n');
  assert.match(permissions, /create or replace function public.app_transition_workflow_0/);
  assert.doesNotMatch(permissions, /create trigger app_workflow_guard/);
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_workflow_fixture' };
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  let state = 'pending', lost = true, identity = owner, calls = 0;
  const receipts = new Map();
  globalThis.fetch = async (resource, init) => {
    const url = new URL(String(resource)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, user: { id: identity, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: identity, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/rpc/app_transition_workflow_0'); calls++;
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    const args = JSON.parse(init.body); assert.equal(args.record_id, row);
    if (receipts.has(args.request_id)) return Response.json('already-transitioned');
    const transition = available(table, state).find(item => item.id === args.transition_id);
    if (!transition) return Response.json({ code: 'P0001', message: 'Application workflow transition unavailable' }, { status: 400 });
    state = transition.to; receipts.set(args.request_id, args);
    if (lost) throw new TypeError('Lost response after commit');
    return Response.json('transitioned');
  };
  const runtime = runtimeFor(app, backend, backend.projectRef), storage = new Map();
  const scope = { keyPrefix: 'tayar-app-form:workflow:project:page:data:orders', crypto: webcrypto, storage: { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  const binding = { tableId: 'orders', columns: ['name', 'state'], actions: ['transition'], pageSize: 10 };
  try {
    await runtime.auth.signIn('test@example.com', 'fixture');
    const first = controllerFor(app, binding, runtime, () => request, scope);
    await assert.rejects(first.transition(row, 'approve'), /uncertain/); assert.equal(state, 'approved');
    assert.doesNotMatch([...storage.values()][0], /recordId|transitionId|approve/);
    first.dispose(); lost = false;
    const retry = controllerFor(app, binding, runtime, () => request, scope);
    await retry.transition(row, 'approve'); assert.equal(receipts.size, 1); assert.equal(storage.size, 0);
    await assert.rejects(retry.transition(row, 'approve'), /unavailable/); assert.equal(storage.size, 0);
    await assert.rejects(runtime.update('orders', row, { state: 'done' }, owner), /declared application fields/);
    identity = other; const count = calls;
    await assert.rejects(runtime.transitionWorkflow('orders', row, 'finish', request, owner), /identity changed/); assert.equal(calls, count);
    retry.dispose();
  } finally { runtime.dispose(); }
  console.log('PASS workflows: validation, migrations, actual SDK, durable lost-response replay, rejected state writes and identity switch');
  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tayar_booking_test') throw Error('Isolated local fixture database required');
    const query = sql => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject);
      child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(sql);
    });
    await query('drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;');
    await query(compile(app).join('\n'));
    const asUser = user => `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`;
    await query(`${asUser(owner)} insert into public.app_stock(id,name) values ('${stock}','Stock'); insert into public.app_supplier(id,name,code) values ('${supplier}','Supplier','supplier-original'); insert into public.app_orders(id,name,stock_id,supplier_id) values ('${row}','Order','${stock}','${supplier}');`);
    await query(`insert into public.app_stock(id,owner_id,name) values ('${otherStock}','${other}','Other owner stock'); insert into public.app_supplier(id,owner_id,name,code) values ('${otherSupplier}','${other}','Other owner supplier','supplier-complete'); insert into public.app_orders(id,owner_id,name,stock_id,supplier_id) values ('${otherRow}','${owner}','Order with inaccessible records','${otherStock}','${otherSupplier}');`);
    await assert.rejects(query(`${asUser(owner)} select public.app_transition_workflow_0('${otherRow}','approve','${otherRequest}');`), /unavailable/);
    assert.equal(await query(`select state from public.app_orders where id='${otherRow}';`), 'pending', 'Related authorization failure rolls back the source transition');
    assert.equal(await query(`select quantity from public.app_stock where id='${otherStock}';`), '100', 'Related authorization failure leaves target data unchanged');
    await assert.rejects(query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','approve','${request}');`), /duplicate key value violates unique constraint/);
    assert.equal(await query(`select state||':'||attempts::text from public.app_orders where id='${row}';`), 'pending:0', 'A later target constraint rolls back the source update');
    assert.equal(await query(`select quantity from public.app_stock where id='${stock}';`), '100', 'A later target constraint rolls back the earlier related update');
    assert.equal(await query(`select code from public.app_supplier where id='${supplier}';`), 'supplier-original', 'A later target constraint leaves the failing target unchanged');
    await query(`update public.app_supplier set code='collision-cleared' where id='${otherSupplier}';`);
    await assert.rejects(query(`${asUser(other)} select public.app_transition_workflow_0('${row}','approve','${request}');`), /unavailable/);
    await assert.rejects(query(`${asUser(owner)} update public.app_orders set state='approved';`), /atomic transition/);
    await assert.rejects(query(`${asUser(owner)} insert into public.app_orders(id,name,state) values(gen_random_uuid(),'Bad','done');`), /initial state/);
    const replies = await Promise.all([1, 2].map(() => query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','approve','${request}');`)));
    assert.ok(replies.some(reply => reply.endsWith('already-transitioned')));
    assert.equal(await query(`select state from public.app_orders where id='${row}';`), 'approved');
    assert.equal(await query(`select name||':'||attempts::text||':'||(approved_at is not null)::text from public.app_orders where id='${row}';`), 'Approved order:2:true');
    assert.equal(await query(`select quantity from public.app_stock where id='${stock}';`), '98');
    assert.equal(await query(`select code from public.app_supplier where id='${supplier}';`), 'supplier-complete');
    assert.equal(await query(`select count(*)||':'||(bool_and(created_at is not null))::text from private.app_workflow_requests where table_name='app_orders' and record_id='${row}';`), '1:true');
    await assert.rejects(query(`update private.app_workflow_requests set to_state='tampered' where actor_id='${owner}' and request_id='${request}';`), /Workflow audit records are immutable/);
    await assert.rejects(query(`delete from private.app_workflow_requests where actor_id='${owner}' and request_id='${request}';`), /Workflow audit records are immutable/);
    await assert.rejects(query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','approve',gen_random_uuid());`), /unavailable/);
    await assert.rejects(query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','finish','${request}');`), /identity mismatch/);
    const competing = await Promise.allSettled([1, 2].map(() => query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','finish',gen_random_uuid());`)));
    assert.equal(competing.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(await query('select count(*) from private.app_workflow_context;'), '0');
    await assert.rejects(query(`${asUser(owner)} select * from private.app_workflow_requests;`), /permission denied/);
    const catalogQuery = async sql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${sql}) x;`));
    assert.equal(await verify(app, catalogQuery), true, 'Actual function, receipt and trigger catalog matches');
    await query('alter table private.app_workflow_requests disable trigger app_workflow_request_immutable;');
    assert.equal(await verify(app, catalogQuery), false, 'Disabled audit immutability trigger blocks readiness');
    await query('alter table public.app_orders disable trigger app_workflow_guard;');
    assert.equal(await verify(app, catalogQuery), false);
    console.log('PASS PostgreSQL workflows: multi-record atomic effects, stable locks, permissions, constraint rollback, idempotency, immutable audit and catalog drift');
  }
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
