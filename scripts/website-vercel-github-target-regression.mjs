import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
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
  let exactRow = exact;
  const serviceClient = { async rpc(name, args) {
    assert.equal(name, 'website_byo_connection_for_worker');
    assert.deepEqual(args, { p_connection_id: connectionId, p_project_id: projectId, p_owner_id: ownerId });
    return { data: exactRow, error: null };
  } };
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  let providerCalls = 0;
  const fetcher = async (url, options) => {
    providerCalls++;
    assert.match(options.headers.Authorization, /^Bearer /);
    const payload = url.includes('/app/installations?')
      ? [{ id: 42, account: { id: 17 }, permissions: { contents: 'write' }, suspended_at: null }]
      : { token: 'fixture-installation-token-1234567890123456',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(), permissions: { contents: 'write' },
        repositories: [{ id: 88, owner: { id: 17 }, full_name: 'customer/booking-app', default_branch: 'main' }] };
    return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify(payload) };
  };
  let current = true, ownerChecks = 0;
  const load = create({ ownerClient, serviceClient, githubAppClientId: 'Iv1_fixture',
    githubAppPrivateKeyPkcs8: privateKeyPkcs8, fetcher });
  assert.deepEqual(await load({ ownerId, projectId, isCurrentOwner: async () => { ownerChecks++; return current; } }),
    { repositoryId: '88', repositoryOwner: 'customer', repositoryName: 'booking-app', productionBranch: 'main' });
  assert.equal(providerCalls, 2); assert.ok(ownerChecks >= 4);
  exactRow = { ...exact, version: 4 };
  assert.equal(await load({ ownerId, projectId, isCurrentOwner: async () => true }), null);
  assert.equal(providerCalls, 2, 'service projection mismatch stops before GitHub');
  exactRow = exact; current = false;
  assert.equal(await load({ ownerId, projectId, isCurrentOwner: async () => current }), null);
  assert.equal(providerCalls, 2, 'stale owner stops before registry/provider access');
  console.log('PASS Vercel GitHub target: owner projection, exact service recheck, live App identity and stale/mismatch refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
