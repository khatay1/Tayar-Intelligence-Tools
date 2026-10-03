import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-custody-'));
try {
  const outfile = join(dir, 'custody.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubOAuthCustodyService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { readWebsiteGitHubOAuthCustody: read, resolveWebsiteGitHubRepositoryGrant: resolve } =
    (await import(pathToFileURL(outfile))).default;

  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const connectionId = '33333333-3333-4333-8333-333333333333';
  const connection = { id: connectionId, ownerId, projectId, provider: 'github', environment: 'preview',
    accountId: '17', targetId: '88', status: 'connected', permissions: ['contents:write'], version: 3,
    operationId: null, verifiedAt: '2026-10-03T20:00:00Z', updatedAt: '2026-10-03T20:00:00Z' };
  const now = Date.parse('2026-10-03T20:00:00Z');
  const baseCustody = { version: 1, accountId: '17', installationId: '42', repositoryId: '88',
    repositoryFullName: 'owner/site', defaultBranch: 'main', environment: 'preview',
    accessExpiresAt: new Date(now + 60_000).toISOString(),
    refreshExpiresAt: new Date(now + 100 * 86_400_000).toISOString(),
    custodyExpiresAt: new Date(now + 100 * 86_400_000).toISOString(),
    grant: { accessToken: 'ghu_expiring_access_token_1234567890', refreshToken: 'ghr_refresh_token_123456789012345' } };

  let readCount = 0, refreshWrites = 0, reconciles = 0;
  const client = { async rpc(name, args) {
    if (name === 'website_read_github_oauth_custody') {
      readCount++;
      assert.equal(args.p_connection_id, connectionId);
      assert.equal(args.p_expected_connection_version, 3);
      return { data: structuredClone(baseCustody), error: null };
    }
    if (name === 'website_refresh_github_oauth_custody') {
      refreshWrites++;
      assert.equal(args.p_expected_version, 1);
      assert.equal(args.p_expected_connection_version, 3);
      assert.equal(args.p_access_token, 'ghu_rotated_access_token_1234567890');
      assert.equal(args.p_refresh_token, 'ghr_rotated_refresh_token_1234567890');
      assert.match(args.p_operation_id, /^[0-9a-f-]{36}$/);
      return { data: 2, error: null };
    }
    if (name === 'website_reconcile_github_oauth_refresh') {
      reconciles++;
      return { data: 2, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  } };
  const fetcher = async (url, options) => {
    const parsed = new URL(url), path = parsed.pathname;
    if (url === 'https://github.com/login/oauth/access_token') {
      const body = options.body;
      assert.equal(body.get('grant_type'), 'refresh_token');
      assert.equal(body.get('refresh_token'), baseCustody.grant.refreshToken);
      return new Response(JSON.stringify({ token_type: 'bearer', access_token: 'ghu_rotated_access_token_1234567890',
        expires_in: 28800, refresh_token: 'ghr_rotated_refresh_token_1234567890',
        refresh_token_expires_in: 15897600 }), { status: 200 });
    }
    assert.equal(options.headers.Authorization, 'Bearer ghu_rotated_access_token_1234567890');
    if (path === '/user/installations') {
      assert.equal(parsed.searchParams.get('per_page'), '100');
      assert.equal(parsed.searchParams.get('page'), '1');
      return new Response(JSON.stringify({ installations: [{ id: 42, account: { id: 17, login: 'owner' },
        permissions: { contents: 'write' }, suspended_at: null }] }), { status: 200 });
    }
    if (path === '/user/installations/42/repositories') {
      assert.equal(parsed.searchParams.get('per_page'), '100');
      assert.equal(parsed.searchParams.get('page'), '1');
      return new Response(JSON.stringify({ repositories: [{ id: 88, owner: { id: 17 }, full_name: 'owner/site',
        default_branch: 'main', permissions: { push: true }, archived: false, disabled: false }] }), { status: 200 });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  const stored = await read({ client, connection, isCurrentOwner: () => true });
  assert.equal(stored.repositoryFullName, 'owner/site');
  assert.equal(stored.refreshToken, baseCustody.grant.refreshToken);

  const resolved = await resolve({ client, connection, clientId: 'Iv1_fixture',
    clientSecret: 'fixture-client-secret-value', isCurrentOwner: async () => true, fetcher, now: () => now });
  assert.deepEqual(resolved, { accessToken: 'ghu_rotated_access_token_1234567890',
    repositoryFullName: 'owner/site', defaultBranch: 'main' });
  assert.equal(refreshWrites, 1);
  assert.equal(reconciles, 0);

  const validClient = { async rpc(name) {
    assert.equal(name, 'website_read_github_oauth_custody');
    return { data: { ...baseCustody, accessExpiresAt: new Date(now + 3_600_000).toISOString(),
      grant: { accessToken: 'ghu_still_valid_access_token_1234567890', refreshToken: baseCustody.grant.refreshToken } }, error: null };
  } };
  assert.deepEqual(await resolve({ client: validClient, connection, clientId: 'Iv1_fixture',
    clientSecret: 'fixture-client-secret-value', isCurrentOwner: () => true,
    fetcher: async () => { throw new Error('valid grant must not refresh'); }, now: () => now }),
  { accessToken: 'ghu_still_valid_access_token_1234567890', repositoryFullName: 'owner/site', defaultBranch: 'main' });

  const legacyClient = { async rpc(name) {
    assert.equal(name, 'website_read_github_oauth_custody');
    return { data: { ...baseCustody, accessExpiresAt: null, refreshExpiresAt: null,
      grant: { accessToken: 'github-long-lived-user-token-1234567890', refreshToken: null } }, error: null };
  } };
  assert.equal((await resolve({ client: legacyClient, connection, clientId: 'Iv1_fixture',
    clientSecret: 'fixture-client-secret-value', isCurrentOwner: () => true, now: () => now })).accessToken,
  'github-long-lived-user-token-1234567890');

  const expiredClient = { async rpc(name) {
    assert.equal(name, 'website_read_github_oauth_custody');
    return { data: { ...baseCustody, accessExpiresAt: new Date(now - 1).toISOString(),
      refreshExpiresAt: new Date(now - 1).toISOString() }, error: null };
  } };
  await assert.rejects(resolve({ client: expiredClient, connection, clientId: 'Iv1_fixture',
    clientSecret: 'fixture-client-secret-value', isCurrentOwner: () => true, now: () => now }), /access is unavailable/);
  assert.ok(readCount >= 2);
  const sql = await readFile('supabase/migrations/20261003231500_website_byo_github_oauth_custody.sql', 'utf8');
  for (const proof of [
    'alter table private.website_github_oauth_custody enable row level security',
    'revoke all on private.website_github_oauth_custody from public, anon, authenticated',
    'v_connection_version:=public.website_record_infrastructure_connection',
    'vault.create_secret',
    'website_read_github_oauth_custody',
    'website_refresh_github_oauth_custody',
    'website_reconcile_github_oauth_refresh',
    'website_delete_github_oauth_custody',
  ]) assert.ok(sql.includes(proof), proof);
  assert.ok(!/grant execute on function public\.website_(?:bind|read|refresh|delete)_github[^\n]* to authenticated/i.test(sql));
  const cleanup = await readFile('supabase/migrations/20261003231600_website_byo_github_custody_cleanup_schedule.sql', 'utf8');
  assert.ok(cleanup.includes('website_cleanup_expired_github_oauth_custody()'));
  console.log('PASS GitHub OAuth custody: scoped read, direct reuse, verified refresh rotation, Vault/RLS SQL and expiry cleanup');
} finally { await rm(dir, { recursive: true, force: true }); }
