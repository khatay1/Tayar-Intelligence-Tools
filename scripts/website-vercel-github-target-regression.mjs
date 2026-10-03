import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-github-target-'));
try {
  const outfile = join(dir, 'target.cjs');
  await build({ entryPoints: ['server/website-vercel-github-target.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { createWebsiteVercelGithubTargetLoader: create } =
    (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const connectionId = '33333333-3333-4333-8333-333333333333';
  const connection = { id: connectionId, ownerId, projectId, provider: 'github', environment: 'preview',
    accountId: '17', targetId: '88', permissions: ['contents:write'], status: 'connected', version: 3,
    verifiedAt: '2026-10-02T12:00:00.000Z', updatedAt: '2026-10-02T12:00:00.000Z' };
  const exact = { ...connection, operationId: null };
  const ownerClient = { async rpc(name, args) {
    assert.equal(name, 'website_infrastructure_connections_for_owner');
    assert.deepEqual(args, { p_project_id: projectId });
    return { data: [connection], error: null };
  } };
  let exactRow = exact, custodyReads = 0;
  const serviceClient = { async rpc(name, args) {
    if (name === 'website_byo_connection_for_worker') {
      assert.deepEqual(args, { p_connection_id: connectionId, p_project_id: projectId, p_owner_id: ownerId });
      return { data: exactRow, error: null };
    }
    if (name === 'website_read_github_oauth_custody') {
      custodyReads++;
      assert.deepEqual(args, { p_connection_id: connectionId, p_project_id: projectId,
        p_owner_id: ownerId, p_expected_connection_version: 3 });
      return { data: { version: 1, accountId: '17', installationId: '42', repositoryId: '88',
        repositoryFullName: 'customer/booking-app', defaultBranch: 'main', environment: 'preview',
        accessExpiresAt: null, refreshExpiresAt: null,
        custodyExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        grant: { accessToken: 'github-long-lived-user-token-1234567890', refreshToken: null } }, error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  } };
  let current = true, ownerChecks = 0, providerCalls = 0;
  const load = create({ ownerClient, serviceClient, githubClientId: 'Iv1_fixture',
    githubClientSecret: 'fixture-client-secret-value',
    fetcher: async () => { providerCalls++; throw new Error('valid custody must not call GitHub'); } });
  assert.deepEqual(await load({ ownerId, projectId, isCurrentOwner: async () => { ownerChecks++; return current; } }),
    { repositoryId: '88', repositoryOwner: 'customer', repositoryName: 'booking-app', productionBranch: 'main' });
  assert.equal(custodyReads, 1);
  assert.equal(providerCalls, 0);
  assert.ok(ownerChecks >= 4);

  exactRow = { ...exact, version: 4 };
  assert.equal(await load({ ownerId, projectId, isCurrentOwner: async () => true }), null);
  assert.equal(custodyReads, 1, 'service projection mismatch stops before OAuth custody');

  exactRow = exact; current = false;
  assert.equal(await load({ ownerId, projectId, isCurrentOwner: async () => current }), null);
  assert.equal(custodyReads, 1, 'stale owner stops before registry/custody access');
  console.log('PASS Vercel GitHub target: owner projection, exact service recheck, OAuth custody identity and stale/mismatch refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
