import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'tayar-reports-')), require = createRequire(import.meta.url), originalFetch = globalThis.fetch;
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let embeddedDatabase;
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-validation', 'application-schema-sql', 'application-reports', 'application-reports-sql', 'application-data-runtime', 'application-data-view-controller']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n')
    + `\nexport * from ${JSON.stringify(resolve('server/website-owned-reports-catalog'))};`);
  await build({ entryPoints: [entry], outfile: join(dir, 'test.cjs'), platform: 'node', format: 'cjs', bundle: true });
  const { readApplicationDefinition: validate, compileInitialApplicationSchema: initial, compileAdditiveApplicationMigration: migrate,
    parseApplicationReports: parse, applicationReportsManifest: manifest, verifyOwnedReportsCatalog: verify,
    createOwnedApplicationDataRuntime: runtimeFor, createApplicationDataViewController: controllerFor,
    applicationReportDifference: difference } = require(join(dir, 'test.cjs'));
  const table = { id: 'orders', key: 'orders', name: 'Orders', fields: [
    { id: 'name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'amount', key: 'amount', name: 'Amount', type: 'number', required: true, defaultValue: 0 },
  ], permissions: [{ operation: 'read', access: 'owner' }], reports: [
    { id: 'record-count', name: 'Orders', operation: 'count' },
    { id: 'amount-total', name: 'Total', operation: 'sum', fieldId: 'amount' },
    { id: 'amount-average', name: 'Average', operation: 'avg', fieldId: 'amount' },
  ] };
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], pageAccess: [], tables: [table] };
  validate(app);
  for (const bad of [
    { ...app, auth: { ...app.auth, enabled: false } },
    { ...app, tables: [{ ...table, reports: [{ id: 'x', name: 'X', operation: 'sum' }] }] },
    { ...app, tables: [{ ...table, reports: [{ id: 'x', name: 'X', operation: 'count', fieldId: 'amount' }] }] },
    { ...app, tables: [{ ...table, reports: [{ id: 'x', name: 'X', operation: 'min', fieldId: 'name' }] }] },
  ]) assert.throws(() => validate(bad));
  const schema = initial(app).join('\n');
  assert.match(schema, /function public\.app_reports_0\(\) returns jsonb language sql stable security invoker/);
  assert.match(schema, /revoke all on function public\.app_reports_0\(\) from public,anon,authenticated,service_role/);
  assert.match(schema, /grant execute on function public\.app_reports_0\(\) to authenticated/);
  assert.match(schema, /sum\("amount"\)/);
  const reportSql = schema.slice(schema.indexOf('create function public.app_reports_0'));
  assert.doesNotMatch(reportSql, /security definer/);
  const changed = structuredClone(app); changed.tables[0].reports[1].name = 'Revenue';
  assert.match(migrate(app, changed).join('\n'), /create or replace function public\.app_reports_0/);
  const removed = structuredClone(app); delete removed.tables[0].reports;
  assert.match(migrate(app, removed).join('\n'), /drop function public\.app_reports_0\(\)/);
  const exact = [{ id: 'record-count', value: '2' }, { id: 'amount-total', value: '9007199254740993.01' }, { id: 'amount-average', value: null }];
  assert.equal(parse(table, exact)[1].value, '9007199254740993.01');
  for (const bad of [[...exact, { id: 'extra', value: '1' }], exact.slice(1), [{ id: 'record-count', value: '-1' }, ...exact.slice(1)],
    [{ id: 'record-count', value: '2.5' }, ...exact.slice(1)], [{ id: 'record-count', value: '2', extra: true }, ...exact.slice(1)],
    [{ id: 'record-count', value: '2' }, { id: 'amount-total', value: 'NaN' }, exact[2]]]) assert.throws(() => parse(table, bad));
  assert.equal(difference('9007199254740993.01', '0.99'), '9007199254740992.02');
  assert.equal(difference('-1.5', '2.25'), '-3.75'); assert.equal(difference('0', '0.00'), '0.00'); assert.equal(difference(null, '1'), null);
  const advanced = structuredClone(app);
  advanced.tables[0].fields.push({ id: 'category', key: 'category', name: 'Category', type: 'text', required: false },
    { id: 'recorded', key: 'recorded', name: 'Date', type: 'datetime', required: false });
  advanced.tables[0].reports[1].groupByFieldId = 'category';
  advanced.tables[0].reports[1].period = { fieldId: 'recorded', unit: 'month', timeZone: 'Europe/Stockholm', offset: 0, comparePrevious: true };
  advanced.tables[0].reports[2].period = { fieldId: 'recorded', unit: 'month', timeZone: 'Europe/Stockholm', offset: 0, comparePrevious: true };
  validate(advanced);
  for (const patch of [{ groupByFieldId: 'amount' }, { period: { ...advanced.tables[0].reports[1].period, offset: 1 } },
    { period: { ...advanced.tables[0].reports[1].period, timeZone: 'UTC\'); drop table orders; --' } },
    { period: { ...advanced.tables[0].reports[1].period, fieldId: 'name' } }]) {
    const invalid = structuredClone(advanced); Object.assign(invalid.tables[0].reports[1], patch); assert.throws(() => validate(invalid));
  }
  const groupedResponse = [exact[0], { ...exact[1], previousValue: '1.25', groups: [{ key: '<script>bad</script>', value: exact[1].value, previousValue: '1.25' }], truncated: false },
    { ...exact[2], previousValue: null }];
  assert.equal(parse(advanced.tables[0], groupedResponse)[1].groups[0].key, '<script>bad</script>');
  for (const patch of [{ groups: [{ key: 'A', value: '1', previousValue: '0' }, { key: 'A', value: '2', previousValue: '0' }] },
    { truncated: true }, { previousValue: 'NaN' }, { groups: [{ key: {}, value: '1', previousValue: '0' }] }]) {
    const invalid = structuredClone(groupedResponse); Object.assign(invalid[1], patch); assert.throws(() => parse(advanced.tables[0], invalid));
  }
  const expected = manifest(app)[0];
  const goodCatalog = [{ name: expected.name, source: expected.source, security_definer: false, configuration: ['search_path='], volatility: 's', kind: 'f', result: 'jsonb', arguments: expected.arguments, language: 'sql', owner: 'postgres', anon_execute: false, authenticated_execute: true, service_execute: false }];
  assert.equal(await verify(app, async () => goodCatalog), true);
  assert.equal(await verify(app, async () => [{ ...goodCatalog[0], security_definer: true }]), false);
  assert.equal(await verify(app, async () => [{ ...goodCatalog[0], source: `${expected.source} select 1` }]), false);
  assert.equal(await verify(app, async () => [{ ...goodCatalog[0], anon_execute: true }]), false);

  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_reports_fixture' };
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  let identity = owner, switchAfterReport = false, calls = 0, scopedMode = false;
  globalThis.fetch = async (resource, init) => {
    const url = new URL(String(resource)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, user: { id: identity, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: identity, is_anonymous: false });
    assert.equal(url.pathname, scopedMode ? '/rest/v1/rpc/app_reports_1' : '/rest/v1/rpc/app_reports_0'); calls++;
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    if (scopedMode) assert.deepEqual(JSON.parse(init.body), { requested_organization: organizationId });
    if (switchAfterReport) identity = other;
    return Response.json(exact);
  };
  const runtime = runtimeFor(app, backend, backend.projectRef);
  try {
    await runtime.auth.signIn('owner@example.com', 'fixture');
    assert.equal((await runtime.reports(table.id, owner))[1].value, '9007199254740993.01');
    const controller = controllerFor(app, { tableId: table.id, columns: ['name', 'amount'], actions: [], pageSize: 10 }, runtime, crypto.randomUUID);
    assert.equal((await controller.reports())[0].value, '2');
    switchAfterReport = true;
    await assert.rejects(controller.reports(), /identity changed/); assert.equal(controller.closed(), true);
    const before = calls; await assert.rejects(runtime.reports(table.id, owner), /identity changed/); assert.equal(calls, before);
  } finally { runtime.dispose(); }
  const scopedTable = { ...structuredClone(table), organizationFieldId: 'order-organization', fields: [
    { id: 'order-organization', key: 'organization_id', name: 'Organization', type: 'reference', required: true, referenceTableId: 'organizations' },
    ...structuredClone(table.fields)], permissions: ['read', 'create', 'update', 'delete'].map(operation => ({ operation, access: 'organization' })) };
  const scopedApp = { ...structuredClone(app), tenancy: { mode: 'organizations', organizationTableId: 'organizations' }, tables: [
    { id: 'organizations', key: 'organizations', name: 'Organizations', fields: [{ id: 'organization-name', key: 'name', name: 'Name', type: 'text', required: true }], permissions: [
      { operation: 'create', access: 'authenticated' }, { operation: 'read', access: 'organization' }, { operation: 'read', access: 'owner' },
      { operation: 'update', access: 'owner' }, { operation: 'delete', access: 'owner' }] }, scopedTable] };
  validate(scopedApp); scopedMode = true; switchAfterReport = false; identity = owner;
  const scopedRuntime = runtimeFor(scopedApp, backend, backend.projectRef);
  try {
    await scopedRuntime.auth.signIn('owner@example.com', 'fixture');
    await assert.rejects(scopedRuntime.reports(scopedTable.id, owner));
    assert.equal((await scopedRuntime.reports(scopedTable.id, owner, organizationId))[0].value, '2');
  } finally { scopedRuntime.dispose(); scopedMode = false; }
  if (process.argv.includes('--postgres') || process.argv.includes('--pglite')) {
    let query;
    if (process.argv.includes('--pglite')) {
      const { PGlite } = require(process.env.TAYAR_PGLITE_MODULE ?? '@electric-sql/pglite');
      embeddedDatabase = new PGlite();
      query = async input => {
        await embeddedDatabase.exec('reset role;');
        const results = await embeddedDatabase.exec(input);
        return results.flatMap(result => result.rows.map(row => Object.values(row).map(value => typeof value === 'object' ? JSON.stringify(value) : String(value)).join('|'))).join('\n');
      };
    } else {
    const databaseUrl = process.env.TAYAR_REPORTS_TEST_DATABASE_URL;
    const url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/tayar_reports_test') throw Error('An isolated local tayar_reports_test database is required.');
    query = input => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', error = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data);
      child.on('error', reject); child.on('close', code => code === 0 ? resolveQuery(output.trim()) : reject(Error(error))); child.stdin.end(input);
    });
    }
    await query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema auth; create table auth.users(id uuid primary key, is_anonymous boolean default false);
      insert into auth.users values ('${owner}',false),('${other}',false);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous',coalesce(nullif(current_setting('request.jwt.claim.anonymous',true),''),'false')::boolean) $$;
      grant usage on schema public,auth to anon,authenticated,service_role;\n${schema}`);
    await query(`insert into public.app_orders(owner_id,name,amount) values ('${owner}','One',9007199254740993.01),('${owner}','Two',0.99),('${other}','Private',777);`);
    const reportAs = user => `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false); select public.app_reports_0();`;
    const ownerTotals = parse(table, JSON.parse((await query(reportAs(owner))).split('\n').at(-1)));
    assert.equal(ownerTotals[0].value, '2'); assert.equal(ownerTotals[1].value, '9007199254740994.00');
    const otherTotals = parse(table, JSON.parse((await query(reportAs(other))).split('\n').at(-1)));
    assert.equal(otherTotals[0].value, '1'); assert.equal(otherTotals[1].value, '777');
    await assert.rejects(query('set role anon; select public.app_reports_0();'), /permission denied/);
    await assert.rejects(query('set role service_role; select public.app_reports_0();'), /permission denied/);
    const anonymous = JSON.parse((await query(`set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); select set_config('request.jwt.claim.anonymous','true',false); select public.app_reports_0();`)).split('\n').at(-1));
    assert.equal(parse(table, anonymous)[0].value, '0'); assert.equal(parse(table, anonymous)[1].value, '0');
    const catalogQuery = async sql => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${sql}) x;`));
    assert.equal(await verify(app, catalogQuery), true);
    await query('alter function public.app_reports_0() security definer;');
    assert.equal(await verify(app, catalogQuery), false);
    console.log('PASS actual PostgreSQL reports: exact decimals, RLS owner isolation, anonymous and service denial, catalog tamper refusal');
    await query('alter function public.app_reports_0() security invoker;');
    await query(migrate(app, advanced).join('\n'));
    const calendar = "date_trunc('month',timezone('Europe/Stockholm',current_timestamp))";
    const start = `timezone('Europe/Stockholm',${calendar})`, before = `timezone('Europe/Stockholm',${calendar}-interval '1 month')`, after = `timezone('Europe/Stockholm',${calendar}+interval '1 month')`;
    await query(`insert into public.app_orders(owner_id,name,amount,category,recorded) values
      ('${owner}','Current A',9007199254740993.01,'A',${start}),('${owner}','Current null',0.99,null,${start}),
      ('${owner}','Previous A',10,'A',${before}),('${owner}','Previous only',7,'Previous only',${before}),
      ('${owner}','Previous boundary',0.25,'A',${start}-interval '1 microsecond'),
      ('${owner}','Next boundary',99,'Next',${after}),('${other}','Private current',888,'Private',${start});`);
    const analytics = parse(advanced.tables[0], JSON.parse((await query(reportAs(owner))).split('\n').at(-1)));
    assert.equal(analytics[1].value, '9007199254740994.00'); assert.equal(analytics[1].previousValue, '17.25');
    assert.deepEqual(analytics[1].groups, [{ key: 'A', value: '9007199254740993.01', previousValue: '10.25' },
      { key: 'Previous only', value: '0', previousValue: '7' }, { key: null, value: '0.99', previousValue: '0' }]);
    assert.equal(analytics[1].truncated, false); assert.equal(await verify(advanced, catalogQuery), true);
    await query(`insert into public.app_orders(owner_id,name,amount,category,recorded)
      select '${owner}','Many',0,'Group '||g,${start} from generate_series(1,101) g;`);
    const bounded = parse(advanced.tables[0], JSON.parse((await query(reportAs(owner))).split('\n').at(-1)));
    assert.equal(bounded[1].groups.length, 100); assert.equal(bounded[1].truncated, true); assert.equal(bounded[1].value, '9007199254740994.00');
    const privateAnalytics = parse(advanced.tables[0], JSON.parse((await query(reportAs(other))).split('\n').at(-1)));
    assert.deepEqual(privateAnalytics[1].groups, [{ key: 'Private', value: '888', previousValue: '0' }]);
    console.log('PASS PostgreSQL analytics: local calendar boundaries, current/previous/null groups, exact deltas, cross-owner denial and disclosed truncation');
  }
  console.log('PASS reports: strict declarations, invoker SQL and grants, exact numeric text, catalog tamper refusal, pinned SDK RPC and account-change refusal');
} finally { globalThis.fetch = originalFetch; await embeddedDatabase?.close(); await rm(dir, { recursive: true, force: true }); }
