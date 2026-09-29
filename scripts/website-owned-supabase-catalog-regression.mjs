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
      assert.match(JSON.parse(init.body).query, /pg_catalog\.pg_policy/);
      return Response.json([row], { status: 201 });
    } });
  assert.equal(await verify(definition, query), true); assert.equal(calls, 1);
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
  assert.equal(await verify(ownerDefinition, async () => [ownerRow]), true);
  assert.equal(await verify(ownerDefinition, async () => [{ ...ownerRow,
    using_expression: ownerExpression.replace('owner_id', 'id') }]), false);
  assert.equal(await verify({ ...definition, roles: [{ id: 'admin', name: 'Admin' }] }, async () => [row]), false);
  assert.equal(await verify(definition, async () => ({ rows: [row] })), false);
  await assert.rejects(createOwnedSupabaseReadOnlyQuery({ projectRef: 'abcdefghijklmnopqrst', accessToken: 'token',
    fetcher: async () => Response.json({ message: 'secret remote detail' }, { status: 403 }) })('select 1'),
  error => !String(error).includes('secret remote detail'));
  assert.throws(() => createOwnedSupabaseReadOnlyQuery({ projectRef: 'wrong', accessToken: 'token' }), /unavailable/);
  console.log('PASS owned Supabase read-only catalog: exact scope, RLS, grants, policy semantics and fail-closed responses (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
