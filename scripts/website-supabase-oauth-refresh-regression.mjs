import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-supabase-refresh-'));
try {
  const outfile = join(dir, 'refresh.cjs');
  await build({ entryPoints: ['server/website-owned-supabase-oauth-refresh.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { refreshOwnedSupabaseOAuthGrant: refresh } = (await import(pathToFileURL(outfile))).default;
  const connection = { id: '33333333-3333-4333-8333-333333333333', ownerId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222', provider: 'supabase', environment: 'production',
    accountId: 'user_1234', targetId: 'abcdefghijklmnopqrst', permissions: ['projects:read'],
    status: 'connected', version: 7, operationId: null,
    verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const old = { version: 1, accountId: connection.accountId, projectRef: connection.targetId,
    organizationId: 'customer-org', organizationSlug: 'customer',
    environment: connection.environment, accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    custodyExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    grant: { accessToken: 'previous-customer-access-token',
      refreshToken: 'previous-customer-refresh-token' } };
  let writes = 0, exchanges = 0, owner = true, responseLost = false;
  const client = { async rpc(name, args) {
    if (name === 'website_read_supabase_oauth_custody') {
      assert.equal(args.p_expected_connection_version, 7); return { data: old, error: null };
    }
    if (name === 'website_store_supabase_oauth_custody') {
      writes++; assert.equal(args.p_expected_version, 1);
      assert.equal(args.p_refresh_token, 'new-customer-refresh-token');
      assert.equal(args.p_owner_id, connection.ownerId);
      assert.equal(args.p_project_ref, connection.targetId);
      return responseLost ? { data: null, error: Error('lost') } : { data: 2, error: null };
    }
    assert.equal(name, 'website_reconcile_supabase_oauth_custody');
    return { data: responseLost ? 2 : null, error: null };
  } };
  const fetcher = async (url, init) => {
    if (url.endsWith('/oauth/token')) {
      exchanges++;
      assert.equal(init.body.get('grant_type'), 'refresh_token');
      assert.equal(init.body.get('refresh_token'), old.grant.refreshToken);
      assert.equal(init.headers.Authorization, `Basic ${btoa('supabase-client:client-secret')}`);
      return Response.json({ token_type: 'Bearer', access_token: 'new-customer-access-token',
        refresh_token: 'new-customer-refresh-token', expires_in: 3600 }, { status: 201 });
    }
    assert.equal(init.headers.Authorization, 'Bearer new-customer-access-token');
    if (url.endsWith('/profile')) return Response.json({ gotrue_id: connection.accountId });
    if (url.endsWith('/members')) return Response.json([{ user_id: connection.accountId, role_name: 'Owner' }]);
    assert.equal(url, `https://api.supabase.com/v1/projects/${connection.targetId}`);
    return Response.json({ ref: connection.targetId, organization_id: 'customer-org',
      organization_slug: 'customer', status: 'ACTIVE_HEALTHY' });
  };
  const input = { client, connection, organizationId: 'customer-org', organizationSlug: 'customer',
    platformOrganizationId: 'tayar-org', clientId: 'supabase-client',
    clientSecret: 'client-secret', operationId: '44444444-4444-4444-8444-444444444444',
    isCurrentOwner: () => owner, fetcher };
  assert.equal((await refresh(input)).version, 2);
  assert.equal(exchanges, 1); assert.equal(writes, 1);
  responseLost = true;
  assert.equal((await refresh(input)).version, 2);
  assert.equal(exchanges, 2); assert.equal(writes, 2, 'SQL response reconciliation does not repeat provider exchange');
  owner = false;
  await assert.rejects(refresh(input), /scope changed/);
  assert.equal(exchanges, 2);
  owner = true;
  await assert.rejects(refresh({ ...input, fetcher: async url => {
    if (url.endsWith('/oauth/token')) { exchanges++; throw Error('lost response'); }
    throw Error('unexpected');
  } }), /uncertain; reconnect required/);
  assert.equal(writes, 2, 'An uncertain provider exchange is not replayed or stored');
  await assert.rejects(refresh({ ...input, fetcher: async url => {
    if (url.endsWith('/oauth/token')) return Response.json({ token_type: 'Bearer',
      access_token: 'new-customer-access-token', refresh_token: 'new-customer-refresh-token', expires_in: 3600 });
    if (url.endsWith('/profile')) return Response.json({ gotrue_id: 'different-user' });
    throw Error('wrong identity');
  } }), /owner or project changed/);
  assert.equal(writes, 2);
  console.log('PASS Supabase OAuth refresh: owner proof, rotated custody, SQL uncertainty and provider uncertainty (mocked HTTP/RPC)');
} finally { await rm(dir, { recursive: true, force: true }); }
