import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-export-source-'));
try {
  const outfile = join(dir, 'source.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubExportSourceService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { captureWebsiteGitHubExportSource: capture } = (await import(pathToFileURL(outfile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const connectionId = '33333333-3333-4333-8333-333333333333';
  let snapshot = { pages: [{ id: 'home', title: 'Original' }], application: { auth: false } };
  let connection = { id: connectionId, ownerId, projectId, provider: 'github', environment: 'production',
    accountId: '77', targetId: '88', permissions: ['contents:write'], status: 'connected', version: 2,
    operationId: null, verifiedAt: '2026-09-29T00:00:00Z', updatedAt: '2026-09-29T00:00:00Z' };
  const reader = {
    async readSavedProject() { return { projectId, ownerId, snapshot: structuredClone(snapshot) }; },
    async readConnection() { return structuredClone(connection); },
  };
  const compile = async saved => [{ path: 'index.html', content: `<html>${saved.pages[0].title}</html>` }];
  const args = { projectId, ownerId, connectionId, reader, compile };
  const first = await capture(args);
  assert.equal(first.files[0].content, '<html>Original</html>');
  assert.match(first.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(await first.isCurrent(), true);
  assert.equal((await capture(args)).sourceDigest, first.sourceDigest);
  first.connection.version = 999;
  assert.equal(await first.isCurrent(), true, 'Returned metadata cannot mutate the authoritative reader');
  first.files[0].content = 'changed';
  assert.equal(await first.isCurrent(), false, 'Captured file mutation fails before ref write');
  const second = await capture(args);
  snapshot = { ...snapshot, pages: [{ id: 'home', title: 'Edited' }] };
  assert.equal(await second.isCurrent(), false, 'Saved revision changed');
  snapshot = { pages: [{ id: 'home', title: 'Original' }], application: { auth: false } };
  const third = await capture(args);
  connection = { ...connection, version: 3, accountId: '79' };
  assert.equal(await third.isCurrent(), false, 'Account switch invalidates capture');
  connection = { ...connection, version: 2, accountId: '77' };
  await assert.rejects(capture({ ...args, compile: async () => [{ path: '.env', content: 'KEY=x' }] }), /manifest/);
  await assert.rejects(capture({ ...args, reader: { ...reader, readSavedProject: async () => ({ projectId, ownerId: 'other', snapshot }) } }), /source changed/);
  console.log('PASS GitHub source capture: persisted project/owner, deterministic digest, stale revision/account and mutable output denial');
} finally { await rm(dir, { recursive: true, force: true }); }
