import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-byo-connections-'));
try {
  const outfile = join(dir, 'connections.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-infrastructure-connections.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { assertInfrastructureConnection, publicInfrastructureConnection, beginInfrastructureOperation,
    finishInfrastructureOperation, disconnectInfrastructureConnection } = (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const id = '33333333-3333-4333-8333-333333333333';
  const operationId = '44444444-4444-4444-8444-444444444444';
  const now = '2026-09-28T19:00:00.000Z';
  const base = { id, ownerId, projectId, provider: 'github', environment: 'production', accountId: 'owner-team',
    targetId: null, permissions: [], status: 'disconnected', version: 1, operationId: null, verifiedAt: null, updatedAt: now };
  assertInfrastructureConnection(base);
  const scope = { ownerId, projectId, provider: 'github', environment: 'production', accountId: 'owner-team', expectedVersion: 1 };
  assert.throws(() => beginInfrastructureOperation(base, { ...scope, projectId: id }, operationId, now), /changed/);
  assert.throws(() => beginInfrastructureOperation(base, { ...scope, accountId: 'different-team' }, operationId, now), /changed/);
  const pending = beginInfrastructureOperation(base, scope, operationId, now);
  assert.equal(pending.version, 2);
  assert.throws(() => beginInfrastructureOperation(pending, { ...scope, expectedVersion: 2 }, operationId, now), /changed/);
  assert.throws(() => finishInfrastructureOperation(pending, { ...scope, expectedVersion: 2 }, id,
    { status: 'ready', targetId: 'owner/repo', permissions: ['contents:write'], verifiedAt: now }, now), /changed/);
  assert.throws(() => finishInfrastructureOperation(pending, { ...scope, expectedVersion: 2 }, operationId,
    { status: 'ready', targetId: null, permissions: [], verifiedAt: now }, now), /not verified/);
  const ready = finishInfrastructureOperation(pending, { ...scope, expectedVersion: 2 }, operationId,
    { status: 'ready', targetId: 'owner/repo', permissions: ['contents:write'], verifiedAt: now }, now);
  assert.equal(ready.version, 3);
  assert.equal(publicInfrastructureConnection(ready).operationId, undefined);
  assert.throws(() => finishInfrastructureOperation(ready, { ...scope, expectedVersion: 3 }, operationId,
    { status: 'ready', targetId: 'other/repo', permissions: [], verifiedAt: now }, now), /changed/);
  assert.throws(() => disconnectInfrastructureConnection(ready, { ...scope, expectedVersion: 2 }, now), /changed/);
  const disconnected = disconnectInfrastructureConnection(ready, { ...scope, expectedVersion: 3 }, now);
  assert.equal(disconnected.targetId, null);
  assert.deepEqual(disconnected.permissions, []);
  assert.throws(() => assertInfrastructureConnection({ ...ready, permissions: ['contents:write', 'contents:write'] }), /Invalid/);
  assert.throws(() => assertInfrastructureConnection({ ...ready, accountId: 'owner?token=secret' }), /Invalid/);
  console.log('PASS BYO connection model: scope/version/operation isolation, verified readiness and disconnect');
} finally { await rm(dir, { recursive: true, force: true }); }
