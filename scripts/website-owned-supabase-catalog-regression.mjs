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
  const { applicationRoleFunctionManifest } = (await import(pathToFileURL(manifestFile))).default;
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
  assert.equal(await verify(definition, async () => ({ rows: [row] })), false);
  await assert.rejects(createOwnedSupabaseReadOnlyQuery({ projectRef: 'abcdefghijklmnopqrst', accessToken: 'token',
    fetcher: async () => Response.json({ message: 'secret remote detail' }, { status: 403 }) })('select 1'),
  error => !String(error).includes('secret remote detail'));
  assert.throws(() => createOwnedSupabaseReadOnlyQuery({ projectRef: 'wrong', accessToken: 'token' }), /unavailable/);
  console.log('PASS owned Supabase read-only catalog: exact scope, RLS, grants, policy semantics and fail-closed responses (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
