import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-supabase-binding-'));
try {
  const outfile = join(dir, 'binding.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteSupabaseProjectBindingService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { encodeSupabaseOAuthHandoff: encode, listWebsiteSupabaseProjectChoices: list,
    bindWebsiteSupabaseProject: bind } = (await import(pathToFileURL(outfile))).default;
  const sql = await readFile('supabase/migrations/20260929223000_website_byo_supabase_project_binding.sql', 'utf8');
  assert.match(sql, /website_record_infrastructure_connection/);
  assert.match(sql, /website_store_supabase_oauth_custody/);
  assert.match(sql, /c\.status='connected'/);
  assert.doesNotMatch(sql, /'ready'/);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  const grant = { accessToken: 'customer-access-token-fixture',
    refreshToken: 'customer-refresh-token-fixture', expiresIn: 3600,
    receivedAt: new Date().toISOString() };
  const payload = encode(grant);
  let consumed = false, committed = false, lost = false, owner = true;
  const client = { async rpc(name, args) {
    if (name === 'website_peek_connection_handoff') return { data: { environment: 'production', userToken: payload }, error: null };
    if (name === 'website_consume_connection_handoff') {
      if (consumed) return { data: null, error: null };
      consumed = true; return { data: { environment: 'production', userToken: payload }, error: null };
    }
    if (name === 'website_reconcile_supabase_project_binding')
      return { data: committed && args.p_operation_id === handoffId ? 1 : null, error: null };
    assert.equal(name, 'website_bind_supabase_project');
    assert.equal(args.p_owner_id, ownerId); assert.equal(args.p_account_id, 'user-1');
    assert.equal(args.p_project_ref, 'abcdefghijklmnopqrst');
    assert.equal(args.p_access_token, grant.accessToken);
    committed = true;
    return lost ? { data: null, error: Error('response lost') } : { data: 1, error: null };
  } };
  const organization = { id: 'customer-org', slug: 'customer', name: 'Customer Org' };
  const providerProject = { ref: 'abcdefghijklmnopqrst', name: 'Booking',
    organization_id: organization.id, organization_slug: organization.slug, status: 'ACTIVE_HEALTHY' };
  const fetcher = async (url, init) => {
    assert.equal(init.headers.Authorization, `Bearer ${grant.accessToken}`);
    const path = url.replace('https://api.supabase.com/v1/', '');
    if (path === 'profile') return Response.json({ gotrue_id: 'user-1' });
    if (path === 'organizations') return Response.json([organization,
      { id: 'tayar-org', slug: 'tayar', name: 'Tayar' },
      { id: 'developer-org', slug: 'developer', name: 'Developer Org' }]);
    if (path === 'projects') return Response.json([providerProject,
      { ...providerProject, ref: 'bbbbbbbbbbbbbbbbbbbb', organization_id: 'tayar-org' },
      { ...providerProject, ref: 'cccccccccccccccccccc', organization_id: 'developer-org' },
      { ...providerProject, ref: 'dddddddddddddddddddd', status: 'INACTIVE' }]);
    if (path === 'organizations/customer/members') return Response.json([{ user_id: 'user-1', role_name: 'Owner' }]);
    if (path === 'organizations/tayar/members') throw Error('platform org must be excluded before membership read');
    if (path === 'organizations/developer/members') return Response.json([{ user_id: 'user-1', role_name: 'Developer' }]);
    if (path === `projects/${providerProject.ref}`) return Response.json(providerProject);
    throw Error(`Unexpected provider path ${path}`);
  };
  const scope = { client, ownerId, projectId, handoffId, platformOrganizationId: 'tayar-org',
    isCurrentOwner: () => owner, fetcher };
  assert.deepEqual(await list(scope), { accountUserId: 'user-1', projects: [{
    projectRef: providerProject.ref, projectName: 'Booking', organizationId: organization.id,
    organizationSlug: organization.slug, organizationName: organization.name }] });
  const binding = { ...scope, projectRef: providerProject.ref, organizationId: organization.id,
    organizationSlug: organization.slug, accountUserId: 'user-1' };
  assert.deepEqual(await bind(binding), { connectionId: handoffId, projectRef: providerProject.ref, version: 1 });
  consumed = false; committed = false; lost = true;
  assert.deepEqual(await bind(binding), { connectionId: handoffId, projectRef: providerProject.ref, version: 1 });
  consumed = false; committed = false; owner = false;
  await assert.rejects(bind(binding), /could not be connected/);
  owner = true;
  await assert.rejects(bind({ ...binding, organizationId: 'tayar-org' }), /could not be connected/);
  assert.deepEqual(await list({ ...scope, fetcher: async (url, init) => url.endsWith('/profile')
    ? Response.json({ gotrue_id: 'another-user' }) : fetcher(url, init) }),
  { accountUserId: 'another-user', projects: [] });
  console.log('PASS Supabase project binding: sanitized owned choices, platform exclusion, atomic bind reconciliation and stale owner (mocked HTTP/RPC/static SQL)');
} finally { await rm(dir, { recursive: true, force: true }); }
