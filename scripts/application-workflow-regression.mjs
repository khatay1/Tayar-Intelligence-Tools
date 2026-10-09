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
    { id: 'state', key: 'state', name: 'State', type: 'enum', required: true, options: ['pending', 'approved', 'done'], defaultValue: 'pending' }],
    permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'owner' })),
    workflow: { fieldId: 'state', transitions: [{ id: 'approve', label: 'Approve', from: ['pending'], to: 'approved', access: 'owner' },
      { id: 'finish', label: 'Finish', from: ['approved'], to: 'done', access: 'owner' }] } };
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, tables: [table] };
  validate(app);
  assert.deepEqual(available(table, 'pending').map(item => item.id), ['approve']);
  assert.deepEqual(available(table, 'done'), []);
  for (const workflow of [{ ...table.workflow, fieldId: 'name' }, { ...table.workflow, transitions: [] },
    ...[{ from: ['missing'] }, { from: ['pending', 'pending'] }, { to: 'pending' }, { access: 'public' }, { access: 'role', roleId: 'missing' }]
      .map(change => ({ ...table.workflow, transitions: [{ ...table.workflow.transitions[0], ...change }] }))]) {
    assert.throws(() => validate({ ...app, tables: [{ ...table, workflow }] }));
  }
  const before = { ...app, tables: [{ ...table, workflow: undefined }] };
  assert.match(migrate(before, app).join('\n'), /create trigger app_workflow_guard/);
  assert.throws(() => migrate(app, before), /reviewed/);
  const permissions = migrate(app, { ...app, tables: [{ ...table, permissions: table.permissions.map(item => ({ ...item, access: 'authenticated' })) }] }).join('\n');
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
    await query(`${asUser(owner)} insert into public.app_orders(id,name) values ('${row}','Order');`);
    await assert.rejects(query(`${asUser(other)} select public.app_transition_workflow_0('${row}','approve','${request}');`), /unavailable/);
    await assert.rejects(query(`${asUser(owner)} update public.app_orders set state='approved';`), /atomic transition/);
    await assert.rejects(query(`${asUser(owner)} insert into public.app_orders(id,name,state) values(gen_random_uuid(),'Bad','done');`), /initial state/);
    const replies = await Promise.all([1, 2].map(() => query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','approve','${request}');`)));
    assert.ok(replies.some(reply => reply.endsWith('already-transitioned')));
    assert.equal(await query(`select state from public.app_orders where id='${row}';`), 'approved');
    await assert.rejects(query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','approve',gen_random_uuid());`), /unavailable/);
    await assert.rejects(query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','finish','${request}');`), /identity mismatch/);
    const competing = await Promise.allSettled([1, 2].map(() => query(`${asUser(owner)} select public.app_transition_workflow_0('${row}','finish',gen_random_uuid());`)));
    assert.equal(competing.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(await query('select count(*) from private.app_workflow_context;'), '0');
    await assert.rejects(query(`${asUser(owner)} select * from private.app_workflow_requests;`), /permission denied/);
    const catalogQuery = async sql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${sql}) x;`));
    assert.equal(await verify(app, catalogQuery), true, 'Actual function, receipt and trigger catalog matches');
    await query('alter table public.app_orders disable trigger app_workflow_guard;');
    assert.equal(await verify(app, catalogQuery), false);
    console.log('PASS PostgreSQL workflows: permissions, direct-write guard, concurrent retry and transitions, receipt denial and catalog drift');
  }
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
