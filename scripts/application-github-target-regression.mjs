import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-target-'));
try {
  const outfile = join(dir, 'target.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-github-target.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { verifyGitHubTarget, planGitHubExport } = (await import(pathToFileURL(outfile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222';
  const connection = { id: '33333333-3333-4333-8333-333333333333', projectId,
    ownerId: '11111111-1111-4111-8111-111111111111', provider: 'github', environment: 'production',
    accountId: '1234', targetId: '5678', permissions: ['contents:write'], status: 'ready', version: 3,
    verifiedAt: '2026-09-28T19:00:00Z', operationId: null, updatedAt: '2026-09-28T19:00:00Z' };
  const observed = { installationAccountId: '1234', repositoryOwnerId: '1234', repositoryId: '5678',
    repositoryFullName: 'owner/app', selectedByInstallation: true, writable: true, archived: false,
    branch: 'tayar/production', headSha: 'a'.repeat(40) };
  const sourceDigest = 'b'.repeat(64);
  const cursor = { projectId, connectionVersion: 3, repositoryId: '5678', branch: 'tayar/production',
    lastHeadSha: observed.headSha, lastSourceDigest: null };
  verifyGitHubTarget(connection, observed);
  assert.equal(planGitHubExport({ connection, observed, cursor, sourceDigest }), 'write');
  assert.equal(planGitHubExport({ connection, observed, cursor: { ...cursor, lastSourceDigest: sourceDigest }, sourceDigest }), 'unchanged');
  for (const altered of [
    { repositoryId: 'other' }, { repositoryOwnerId: 'other' }, { installationAccountId: 'other' },
    { selectedByInstallation: false }, { writable: false }, { archived: true },
    { branch: 'tayar/../../main' }, { repositoryFullName: 'other/app' },
  ]) {
    if (altered.repositoryFullName) assert.doesNotThrow(() => verifyGitHubTarget(connection, { ...observed, ...altered }), 'A renamed repo may retain the same immutable ID');
    else assert.throws(() => verifyGitHubTarget(connection, { ...observed, ...altered }), /not verified/);
  }
  for (const altered of [
    { projectId: connection.id }, { connectionVersion: 2 }, { repositoryId: 'other' },
    { branch: 'main' }, { lastHeadSha: 'c'.repeat(40) },
  ]) assert.throws(() => planGitHubExport({ connection, observed, cursor: { ...cursor, ...altered }, sourceDigest }), /changed/);
  assert.throws(() => verifyGitHubTarget({ ...connection, status: 'credentials-revoked' }, observed), /not verified/);
  assert.throws(() => verifyGitHubTarget({ ...connection, permissions: ['contents:read'] }, observed), /not verified/);
  console.log('PASS GitHub target: installation/account/repository scope, write permission and stale branch/source guard');
} finally { await rm(dir, { recursive: true, force: true }); }
