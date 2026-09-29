import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-supabase-disconnect-'));
try {
  const outfile = join(dir, 'disconnect.cjs');
  await build({ entryPoints: ['server/website-owned-supabase-oauth-disconnect.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { disconnectOwnedSupabase: disconnect } = (await import(pathToFileURL(outfile))).default;
  const sql = await readFile('supabase/migrations/20260929182500_website_byo_supabase_disconnect.sql', 'utf8');
  assert.match(sql, /delete from private\.website_supabase_oauth_custody/);
  assert.match(sql, /create table private\.website_supabase_disconnect_attempts/);
  assert.match(sql, /delete from private\.website_supabase_disconnect_attempts/);
  assert.match(sql, /last_commit_id=p_commit_id/);
  assert.match(sql, /not exists \(select 1 from private\.website_supabase_oauth_custody/);
  for (const name of ['begin_supabase_disconnect', 'disconnect_supabase_connection', 'reconcile_supabase_disconnect']) {
    assert.match(sql, new RegExp(`revoke all on function public.website_${name}\\([^;]+from public, anon, authenticated`));
  }
  const connection = { id: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222',
    provider: 'supabase', environment: 'production', accountId: 'user_1234',
    targetId: 'abcdefghijklmnopqrst', permissions: ['projects:read'], status: 'connected',
    version: 7, operationId: null, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let committed = false, attempt = false, lost = false, databaseRejected = false, prepareLost = false;
  let owner = true, posts = 0, deletes = 0, responseStatus = 204;
  const client = { async rpc(name, args) {
    assert.equal(args.p_owner_id, connection.ownerId);
    if (name === 'website_reconcile_supabase_disconnect')
      return { data: committed && args.p_commit_id === '44444444-4444-4444-8444-444444444444' ? 8 : null, error: null };
    if (name === 'website_begin_supabase_disconnect') {
      const fresh = !attempt; attempt = true;
      return prepareLost ? { data: null, error: Error('prepare response lost') } : { data: fresh, error: null };
    }
    if (name === 'website_read_supabase_oauth_custody') {
      return { data: { version: 1, accountId: connection.accountId, projectRef: connection.targetId,
        organizationId: 'customer-org', organizationSlug: 'customer', environment: connection.environment,
        accessExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        custodyExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        grant: { accessToken: 'customer-access-token-fixture', refreshToken: 'customer-refresh-token-fixture' } },
      error: null };
    }
    assert.equal(name, 'website_disconnect_supabase_connection');
    if (databaseRejected) return { data: null, error: Error('database unavailable') };
    deletes++; committed = true;
    return lost ? { data: null, error: Error('lost') } : { data: 8, error: null };
  } };
  const fetcher = async (url, init) => {
    posts++; assert.equal(url, 'https://api.supabase.com/v1/oauth/revoke');
    assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.refresh_token, 'customer-refresh-token-fixture');
    assert.equal(body.client_id, 'supabase-client');
    return new Response(null, { status: responseStatus });
  };
  const input = { client, connection, organizationId: 'customer-org', organizationSlug: 'customer',
    clientId: 'supabase-client', clientSecret: 'client-secret',
    commitId: '44444444-4444-4444-8444-444444444444',
    isCurrentOwner: () => owner, fetcher };
  assert.deepEqual(await disconnect(input), { version: 8, revocation: 'confirmed' });
  assert.equal(posts, 1); assert.equal(deletes, 1);
  assert.deepEqual(await disconnect(input), { version: 8, revocation: 'uncertain' });
  assert.equal(posts, 1, 'Retry reconciles locally without replaying the provider POST');
  committed = false; attempt = false; lost = true; responseStatus = 429;
  assert.deepEqual(await disconnect(input), { version: 8, revocation: 'uncertain' });
  assert.equal(posts, 2); assert.equal(deletes, 2);
  committed = false; attempt = false; databaseRejected = true;
  await assert.rejects(disconnect(input), /uncertain; refresh connection status/);
  assert.equal(posts, 3);
  await assert.rejects(disconnect(input), /uncertain; refresh connection status/);
  assert.equal(posts, 3, 'Retry after failed local commit skips the provider POST');
  databaseRejected = false;
  assert.deepEqual(await disconnect(input), { version: 8, revocation: 'uncertain' });
  assert.equal(posts, 3, 'A resumed local completion never repeats provider revocation');
  committed = false; attempt = false; prepareLost = true;
  await assert.rejects(disconnect(input), /uncertain; refresh connection status/);
  assert.equal(posts, 3);
  prepareLost = false;
  assert.deepEqual(await disconnect(input), { version: 8, revocation: 'uncertain' });
  assert.equal(posts, 3, 'A lost prepare response also suppresses the provider POST');
  owner = false;
  await assert.rejects(disconnect(input), /unavailable/);
  assert.equal(posts, 3);
  owner = true; committed = false;
  await assert.rejects(disconnect({ ...input, commitId: '55555555-5555-4555-8555-555555555555',
    connection: { ...connection, provider: 'github' } }), /unavailable/);
  assert.equal(posts, 3);
  console.log('PASS Supabase disconnect: revocation attempt, atomic erase, exact reconciliation, no replay and stale owner (mocked HTTP/RPC/static SQL)');
} finally { await rm(dir, { recursive: true, force: true }); }
