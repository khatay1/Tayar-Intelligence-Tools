import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-byo-client-'));
try {
  const outfile = join(dir, 'client.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteInfrastructureConnectionClient.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { readWebsiteInfrastructureConnections: read } = (await import(pathToFileURL(outfile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const row = { id: '33333333-3333-4333-8333-333333333333', projectId, ownerId,
    provider: 'supabase', environment: 'production', accountId: 'my-team', targetId: 'my-project',
    permissions: ['database:read'], status: 'ready', version: 2, verifiedAt: '2026-09-28T19:00:00Z', updatedAt: '2026-09-28T19:00:00Z' };
  const request = (data, overrides = {}) => read({ projectId, ownerId, isCurrent: () => true,
    client: { async rpc(name, args) { assert.equal(name, 'website_infrastructure_connections_for_owner'); assert.deepEqual(args, { p_project_id: projectId }); return { data, error: null }; } }, ...overrides });
  assert.deepEqual(await request([row]), [row]);
  assert.deepEqual(await request([{ ...row, status: 'connecting', targetId: null, verifiedAt: null }]), [{ ...row, status: 'connecting', targetId: null, verifiedAt: null }]);
  assert.deepEqual(await request([{ ...row, accessToken: 'private' }]), [row], 'Unknown provider payload cannot reach UI');
  await assert.rejects(request([{ ...row, ownerId: '44444444-4444-4444-8444-444444444444' }]), /scope changed/);
  await assert.rejects(request([{ ...row, projectId: ownerId }]), /scope changed/);
  await assert.rejects(request([row, row]), /unavailable/);
  await assert.rejects(request([{ ...row, status: 'ready', verifiedAt: null }]), /unavailable/);
  await assert.rejects(request([row], { isCurrent: () => false }), /scope changed/);
  let checks = 0;
  await assert.rejects(request([row], { isCurrent: () => ++checks === 1 }), /scope changed/);
  console.log('PASS BYO owner reader: scoped metadata, stale results, duplicate/malformed denial and no token projection');
} finally { await rm(dir, { recursive: true, force: true }); }
