import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-catalog-'));
try {
  const outfile = join(dir, 'catalog.cjs');
  await build({ entryPoints: ['server/website-owned-supabase-catalog.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { createOwnedSupabaseReadOnlyQuery, verifyOwnedSupabaseCatalogSecurity: verify } =
    (await import(pathToFileURL(outfile))).default;
  const manifestFile = join(dir, 'manifest.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-schema-sql.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: manifestFile });
  const { applicationRoleFunctionManifest, applicationSecurityPolicies } = (await import(pathToFileURL(manifestFile))).default;
  const organizationManifestFile = join(dir, 'organization-manifest.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-organization-sql.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: organizationManifestFile });
  const { applicationOrganizationFunctionManifest } = (await import(pathToFileURL(organizationManifestFile))).default;
  const stockTransportFile = join(dir, 'stock-transport.cjs');
  await build({ entryPoints: ['server/website-owned-stock-reservation-catalog-transport.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile: stockTransportFile });
  const { createBoundedOwnedStockCatalogFetcher: boundedStockTransport } =
    (await import(pathToFileURL(stockTransportFile))).default;
  const definition = { version: 1, auth: { enabled: false, signUpEnabled: false, emailVerificationRequired: false },
    roles: [], pageAccess: [], tables: [{ id: 'notes', key: 'notes', name: 'Notes', fields: [],
      permissions: [{ operation: 'read', access: 'public' }] }] };
  const row = { table_name: 'app_notes', relation_kind: 'r', rls: true,
    anon_read: true, anon_create: false, anon_update: false, anon_delete: false,
    anon_column_read: true, anon_column_create: false, anon_column_update: false,
    authenticated_read: true, authenticated_create: false, authenticated_update: false, authenticated_delete: false,
    authenticated_column_read: true, authenticated_column_create: false, authenticated_column_update: false,
    policy_name: 'app_p_0_read', command: 'r', permissive: true,
    roles: ['anon', 'authenticated'], using_expression: 'true', check_expression: null };
  let calls = 0;
  const query = createOwnedSupabaseReadOnlyQuery({ projectRef: 'abcdefghijklmnopqrst', accessToken: 'customer_oauth_token',
    fetcher: async (url, init) => {
      calls++;
      assert.equal(url, 'https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/database/query/read-only');
      assert.equal(init.headers.Authorization, 'Bearer customer_oauth_token');
      assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
      const sql = JSON.parse(init.body).query;
      assert.match(sql, /pg_catalog\.(pg_policy|pg_attribute)/);
      if (sql.includes('pg_catalog.pg_policy')) assert.match(sql, /c\.relkind in \('r', 'p', 'v', 'm', 'f'\)/);
      return Response.json(sql.includes('a.attgenerated') ? [] : [row], { status: 201 });
    } });
  assert.equal(await verify(definition, query), true); assert.equal(calls, 2);
  assert.equal(await verify(definition, async sql => sql.includes('a.attgenerated')
    ? [{ table_name: 'app_notes', column_name: 'undeclared', generated: 's', required: true, type: 'numeric', expression: '1' }] : [row]), false);
  for (const mutation of [
    { rls: false }, { anon_create: true }, { anon_column_create: true }, { authenticated_read: false },
    { policy_name: 'unrelated' }, { command: '*' }, { permissive: false },
    { roles: ['authenticated'] }, { using_expression: 'true or true' },
    { relation_kind: 'v' }, { table_name: 'app_other' },
  ]) assert.equal(await verify(definition, async () => [{ ...row, ...mutation }]), false, JSON.stringify(mutation));
  assert.equal(await verify(definition, async () => []), false);
  assert.equal(await verify(definition, async () => [row, row]), false);
  assert.equal(await verify(definition, async () => [row, { ...row, table_name: 'app_other' }]), false);
  const ownerDefinition = { ...definition, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: false },
    tables: [{ ...definition.tables[0],
    permissions: [{ operation: 'read', access: 'owner' }] }] };
  const ownerExpression = "(((select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true) and (select auth.uid()) = owner_id)";
  const ownerRow = { ...row, anon_read: false, anon_column_read: false,
    roles: ['authenticated'], using_expression: ownerExpression };
  assert.equal(await verify(ownerDefinition, async sql => sql.includes('a.attgenerated') ? [] : [ownerRow]), true);
  assert.equal(await verify(ownerDefinition, async () => [{ ...ownerRow,
    using_expression: ownerExpression.replace('owner_id', 'id') }]), false);
  const ownerCatalog = "((( SELECT auth.uid() AS uid) IS NOT NULL) AND (((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean IS NOT TRUE) AND (( SELECT auth.uid() AS uid) = owner_id))";
  assert.equal(await verify(ownerDefinition, async sql => sql.includes('a.attgenerated') ? [] : [{...ownerRow,using_expression:ownerCatalog}]),true);
  for(const changed of [ownerCatalog.replace('owner_id','id'),ownerCatalog.replace('IS NOT TRUE','IS TRUE'),ownerCatalog.replace("'is_anonymous'","'IS_ANONYMOUS'"),ownerCatalog+' OR true']) {
    assert.equal(await verify(ownerDefinition,async()=>[{...ownerRow,using_expression:changed}]),false,'Deparsed policy drift must remain denied');
  }
  const ownerCreateCatalog = "((( SELECT auth.uid() AS uid) IS NOT NULL) AND (((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean IS NOT TRUE) AND (( SELECT auth.uid() AS uid) = owner_id) AND (owner_id = ( SELECT auth.uid() AS uid)))";
  const createOwnerDefinition=structuredClone(ownerDefinition);createOwnerDefinition.tables[0].permissions.push({operation:'create',access:'owner'});
  const createOwnerRead={...ownerRow,authenticated_create:true,authenticated_column_create:true,using_expression:ownerCatalog};
  const createOwnerWrite={...createOwnerRead,policy_name:'app_p_0_create',command:'a',using_expression:null,check_expression:ownerCreateCatalog};
  const checkCreate=expression=>verify(createOwnerDefinition,async sql=>sql.includes('a.attgenerated')?[]:[createOwnerRead,{...createOwnerWrite,check_expression:expression}]);
  assert.equal(await checkCreate(ownerCreateCatalog),true,'Exact owner INSERT deparse retains the new-owner check');
  for(const changed of [ownerCreateCatalog.replace('AND','OR'),ownerCreateCatalog.replace('IS NOT TRUE','IS TRUE'),ownerCreateCatalog.replace('owner_id = ( SELECT','id = ( SELECT'),ownerCreateCatalog+' OR true',ownerCatalog]) {
    assert.equal(await checkCreate(changed),false,'Owner INSERT policy drift remains denied');
  }
  const roleDefinition = { ...definition, auth: { enabled: true, signUpEnabled: true,
    emailVerificationRequired: false }, roles: [{ id: 'admin', name: 'Admin' }] };
  const roleTables = ['app_role_administrators', 'app_user_roles'].map(table_name => ({
    table_name, relation_kind: 'r', rls: true, anon_all: false, authenticated_all: false,
    anon_columns: false, authenticated_columns: false,
  }));
  const roleFunctions = applicationRoleFunctionManifest().map(item => ({
    schema_name: item.schema, function_name: item.name, arguments: item.arguments,
    result: item.result, language: item.language, kind: 'f', security_definer: item.securityDefiner,
    volatility: item.stable ? 's' : 'v', source: item.source, owner_name: 'postgres',
    configuration: ['search_path='], anon_execute: false,
    authenticated_execute: item.name !== 'app_bootstrap_role_admin', service_execute: true,
  }));
  assert.equal(roleFunctions.length, 8);
  const roleQuery = async sql => sql.includes('a.attgenerated') ? [] : sql.includes('pg_catalog.pg_proc') ? roleFunctions
    : sql.includes('app_user_roles') ? roleTables
      : sql.includes('has_schema_privilege') ? [{ anon_usage: false, authenticated_usage: true }] : [row];
  assert.equal(await verify(roleDefinition, roleQuery), true);
  for (const mutation of [{ source: 'select true' }, { owner_name: 'anon' },
    { authenticated_execute: false }, { configuration: ['search_path=public'] },
    { anon_execute: true }]) assert.equal(await verify(roleDefinition, async sql =>
    sql.includes('pg_catalog.pg_proc') ? [{ ...roleFunctions[0], ...mutation }, ...roleFunctions.slice(1)]
      : roleQuery(sql)), false, JSON.stringify(mutation));
  assert.equal(await verify(roleDefinition, async sql => sql.includes('app_user_roles')
    ? [{ ...roleTables[0], authenticated_all: true }, roleTables[1]] : roleQuery(sql)), false);
  assert.equal(await verify(roleDefinition, async sql => sql.includes('has_schema_privilege')
    ? [{ anon_usage: true, authenticated_usage: true }] : roleQuery(sql)), false);
  const organizationDefinition = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    roles: [], pageAccess: [], tenancy: { mode: 'organizations', organizationTableId: 'organizations' }, tables: [
      { id: 'organizations', key: 'organizations', name: 'Organizations', fields: [{ id: 'organization-name', key: 'name', name: 'Name', type: 'text', required: true }],
        permissions: [{ operation: 'create', access: 'authenticated' }, { operation: 'read', access: 'organization' }, { operation: 'update', access: 'owner' }, { operation: 'delete', access: 'owner' }] },
      { id: 'projects', key: 'projects', name: 'Projects', organizationFieldId: 'project-organization',
        fields: [{ id: 'project-organization', key: 'organization_id', name: 'Organization', type: 'reference', required: true, referenceTableId: 'organizations' }],
        permissions: ['create', 'read', 'update', 'delete'].map(operation => ({ operation, access: 'organization' })) },
    ] };
  const organizationRows = applicationSecurityPolicies(organizationDefinition).map(policy => {
    const table = organizationDefinition.tables.find(item => `app_${item.key}` === policy.table);
    const operation = policy.name.split('_').at(-1);
    return { table_name: policy.table, relation_kind: 'r', rls: true,
      anon_read: false, anon_create: false, anon_update: false, anon_delete: false,
      anon_column_read: false, anon_column_create: false, anon_column_update: false,
      authenticated_read: table.permissions.some(item => item.operation === 'read'),
      authenticated_create: table.permissions.some(item => item.operation === 'create'),
      authenticated_update: table.permissions.some(item => item.operation === 'update'),
      authenticated_delete: table.permissions.some(item => item.operation === 'delete'),
      authenticated_column_read: table.permissions.some(item => item.operation === 'read'),
      authenticated_column_create: table.permissions.some(item => item.operation === 'create'),
      authenticated_column_update: table.permissions.some(item => item.operation === 'update'),
      policy_name: policy.name, command: policy.command, permissive: true, roles: policy.roles,
      using_expression: policy.using, check_expression: policy.check, operation };
  });
  const organizationFunctions = applicationOrganizationFunctionManifest(organizationDefinition).map(item => ({
    schema_name: item.schema, function_name: item.name, arguments: item.arguments, result: item.result,
    language: item.language, kind: 'f', security_definer: item.securityDefiner,
    volatility: item.stable ? 's' : 'v', source: item.source, owner_name: 'postgres',
    configuration: ['search_path='], anon_execute: false, authenticated_execute: item.authenticatedExecute,
  }));
  const organizationTable = [{ table_name: 'app_organization_members', relation_kind: 'r', rls: true,
    anon_all: false, authenticated_all: false, anon_columns: false, authenticated_columns: false,
    fields: { organization_id: { required: true, type: 'uuid' }, user_id: { required: true, type: 'uuid' },
      administrator: { required: true, type: 'boolean' }, created_at: { required: true, type: 'timestamp with time zone' } },
    primary_keys: 1, foreign_keys: 2 }];
  const organizationTriggers = [
    { table_name: 'app_organizations', trigger_name: 'app_add_organization_owner', function_name: 'app_add_organization_owner', function_schema: 'private', enabled: 'O', argument_hex: '' },
    { table_name: 'app_projects', trigger_name: 'app_guard_organization_scope', function_name: 'app_guard_organization_scope', function_schema: 'public', enabled: 'O', argument_hex: Buffer.from('organization_id\0').toString('hex') },
  ];
  const organizationQuery = async sql => sql.includes('a.attgenerated') ? []
    : sql.includes("c.relname = 'app_organization_members'") ? organizationTable
    : sql.includes("t.tgname in ('app_add_organization_owner'") ? organizationTriggers
    : sql.includes("'app_guard_organization_scope'") ? organizationFunctions
    : sql.includes('has_schema_privilege') ? [{ anon_usage: false, authenticated_usage: true }]
    : organizationRows;
  assert.equal(await verify(organizationDefinition, organizationQuery), true);
  for (const mutation of [{ rls: false }, { authenticated_all: true }, { foreign_keys: 1 }]) {
    assert.equal(await verify(organizationDefinition, async sql => sql.includes("c.relname = 'app_organization_members'")
      ? [{ ...organizationTable[0], ...mutation }] : organizationQuery(sql)), false, JSON.stringify(mutation));
  }
  assert.equal(await verify(organizationDefinition, async sql => sql.includes("'app_guard_organization_scope'")
    ? [{ ...organizationFunctions[0], source: 'begin return new; end' }, ...organizationFunctions.slice(1)] : organizationQuery(sql)), false);
  assert.equal(await verify(organizationDefinition, async sql => sql.includes("t.tgname in ('app_add_organization_owner'")
    ? [{ ...organizationTriggers[0], function_schema: 'public' }, organizationTriggers[1]] : organizationQuery(sql)), false);
  assert.equal(await verify(definition, async () => ({ rows: [row] })), false);
  await assert.rejects(createOwnedSupabaseReadOnlyQuery({ projectRef: 'abcdefghijklmnopqrst', accessToken: 'token',
    fetcher: async () => Response.json({ message: 'secret remote detail' }, { status: 403 }) })('select 1'),
  error => !String(error).includes('secret remote detail'));
  assert.throws(() => createOwnedSupabaseReadOnlyQuery({ projectRef: 'wrong', accessToken: 'token' }), /unavailable/);

  assert.throws(() => createOwnedSupabaseReadOnlyQuery({ projectRef: 'abcdefghijklmnopqrst',
    accessToken: 'token\nforged' }), /unavailable/);
  const testRef = 'abcdefghijklmnopqrst';
  const read = (fetcher) => createOwnedSupabaseReadOnlyQuery({
    projectRef: testRef, accessToken: 'fixture-only', fetcher: boundedStockTransport(fetcher),
  });
  let foreignCalls = 0;
  await assert.rejects(boundedStockTransport(async () => { foreignCalls++; })(
    'https://evil.example', { method: 'POST', redirect: 'error', cache: 'no-store',
      body: '{"query":"select 1"}' }), /stock catalog request unavailable/);
  assert.equal(foreignCalls, 0, 'Outbound stock catalog transport must never accept an arbitrary host');
  let requestCount = 0;
  const known = read(async (_url, init) => {
    requestCount++;
    assert.equal(init.signal.aborted, false, 'Deadline covers all network and stream work');
    return Response.json([{ count: 1 }], { status: 201 });
  });
  assert.deepEqual(await known('select 1'), [{ count: 1 }]);
  assert.equal(requestCount, 1);
  await assert.rejects(known('x'.repeat(65_537)), /catalog read failed/);
  assert.equal(requestCount, 1, 'Oversized query fails before sending an OAuth header');

  for (const invalid of [
    () => new Response(null, { status: 201 }),
    () => Response.json({ token: 'unsafe-provider-detail' }, { status: 201 }),
    () => new Response('{bad JSON', { status: 201 }),
    () => new Response(new Uint8Array([255]), { status: 201 }),
    () => new Response('[]', { status: 201, headers: { 'content-length': '1048577' } }),
    () => new Response('[]', { status: 201, headers: { 'content-length': 'unknown' } }),
  ]) await assert.rejects(read(async () => invalid())('select 1'),
    error => error.message === 'Customer Supabase catalog read failed.'
      && !String(error).includes('unsafe-provider-detail'));

  let cancelled = false;
  const excessive = read(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1_048_577)); },
    cancel() { cancelled = true; },
  }), { status: 201 }));
  await assert.rejects(excessive('select 1'), /catalog read failed/);
  assert.equal(cancelled, true, 'Oversized streamed catalog evidence is cancelled');

  const savedTimer = globalThis.setTimeout;
  try {
    globalThis.setTimeout = (callback, ms, ...args) => {
      assert.equal(ms, 8000, 'Catalog read has one 8s deadline');
      return savedTimer(callback, 2, ...args);
    };
    let aborted = false;
    const hanging = read(async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('oauth-secret-not-visible')); }, { once: true });
    }));
    await assert.rejects(hanging('select 1'), error =>
      error.message === 'Customer Supabase catalog read failed.' && !String(error).includes('oauth-secret-not-visible'));
    assert.equal(aborted, true, 'Read-only HTTP request aborts on the enforced deadline');
  } finally {
    globalThis.setTimeout = savedTimer;
  }
  console.log('PASS owned Supabase read-only catalog: exact scope, RLS, grants, policy semantics and fail-closed responses (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
