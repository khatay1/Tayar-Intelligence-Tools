import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-owned-project-'));
try {
  const outfile = join(dir, 'project.cjs');
  await build({ entryPoints: ['server/website-owned-supabase-project.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { verifyOwnedSupabaseProject: verify, createOwnedSupabaseLiveSecurityVerifier: live } =
    (await import(pathToFileURL(outfile))).default;
  const input = { projectRef: 'abcdefghijklmnopqrst', organizationId: 'customer-org',
    organizationSlug: 'customer', accountUserId: 'user-1', platformOrganizationId: 'tayar-org',
    accessToken: 'customer_oauth' };
  const project = { ref: input.projectRef, organization_id: input.organizationId,
    organization_slug: input.organizationSlug, status: 'ACTIVE_HEALTHY' };
  const members = [{ user_id: 'user-1', role_name: 'Owner' }];
  const sequence = (overrides = {}) => {
    const calls = [];
    const values = { profile: { gotrue_id: 'user-1' }, [`projects/${input.projectRef}`]: project,
      [`organizations/${input.organizationSlug}/members`]: members, ...overrides };
    return { calls, async fetcher(url, init) {
      const path = url.replace('https://api.supabase.com/v1/', ''); calls.push(path);
      assert.equal(init.headers.Authorization, 'Bearer customer_oauth');
      assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
      return Response.json(values[path] ?? {}, { status: 200 });
    } };
  };
  const valid = sequence();
  assert.equal(await verify({ ...input, fetcher: valid.fetcher }), true);
  assert.deepEqual(valid.calls, ['profile', `projects/${input.projectRef}`,
    `organizations/${input.organizationSlug}/members`, `projects/${input.projectRef}`]);
  for (const change of [
    { profile: { gotrue_id: 'another' } },
    { [`projects/${input.projectRef}`]: { ...project, organization_id: 'tayar-org' } },
    { [`projects/${input.projectRef}`]: { ...project, status: 'INACTIVE' } },
    { [`organizations/${input.organizationSlug}/members`]: [{ user_id: 'user-1', role_name: 'Developer' }] },
    { [`organizations/${input.organizationSlug}/members`]: [...members, ...members] },
  ]) assert.equal(await verify({ ...input, fetcher: sequence(change).fetcher }), false);
  assert.equal(await verify({ ...input, organizationId: 'tayar-org', fetcher: sequence().fetcher }), false);
  let reads = 0;
  assert.equal(await verify({ ...input, fetcher: async () => { reads++;
    return Response.json(reads === 4 ? { ...project, organization_id: 'other' }
      : reads === 1 ? { gotrue_id: 'user-1' } : reads === 3 ? members : project);
  } }), false, 'Transfer during proof is rejected');
  assert.equal(await verify({ ...input, fetcher: async () => Response.json({ secret: 'remote details' }, { status: 403 }) }), false);
  const definition = { version: 1, auth: { enabled: false, signUpEnabled: false,
    emailVerificationRequired: false }, roles: [], pageAccess: [], tables: [{
      id: 'notes', key: 'notes', name: 'Notes', fields: [], permissions: [{ operation: 'read', access: 'public' }],
    }] };
  const catalogRow = { table_name: 'app_notes', relation_kind: 'r', rls: true,
    anon_read: true, anon_create: false, anon_update: false, anon_delete: false,
    anon_column_read: true, anon_column_create: false, anon_column_update: false,
    authenticated_read: true, authenticated_create: false, authenticated_update: false,
    authenticated_delete: false, authenticated_column_read: true,
    authenticated_column_create: false, authenticated_column_update: false,
    policy_name: 'app_p_0_read', command: 'r', permissive: true,
    roles: ['anon', 'authenticated'], using_expression: 'true', check_expression: null };
  let checks = 0, catalogReads = 0;
  const scoped = sequence();
  const proof = live({ ...input, isCurrent: async () => { checks++; return true; },
    fetcher: async (url, init) => {
      if (url.endsWith('/database/query/read-only')) { catalogReads++;
        const sql = JSON.parse(init.body).query;
        assert.match(sql, /pg_catalog\.(pg_policy|pg_attribute)/);
        return Response.json(sql.includes('a.attgenerated') ? [] : [catalogRow], { status: 201 }); }
      return scoped.fetcher(url, init);
    } });
  assert.equal(await proof(definition), true);
  assert.equal(checks, 2); assert.equal(catalogReads, 2);
  assert.equal(scoped.calls.length, 8, 'Ownership is checked around the catalog read');
  assert.equal(await live({ ...input, isCurrent: async () => false,
    fetcher: async () => { throw new Error('stale connection must not call provider'); } })(definition), false);
  console.log('PASS customer Supabase project: OAuth profile, exact owner organization, project health and transfer recheck (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
