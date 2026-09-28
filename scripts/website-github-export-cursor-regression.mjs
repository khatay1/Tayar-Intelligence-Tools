import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-export-cursor-'));
try {
  const outfile = join(dir, 'cursor.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubExportCursorService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { readWebsiteGitHubExportCursor: read, initializeWebsiteGitHubExportCursor: initialize,
    commitWebsiteGitHubExportCursor: commit } = (await import(pathToFileURL(outfile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const connectionId = '33333333-3333-4333-8333-333333333333';
  const operationId = '44444444-4444-4444-8444-444444444444';
  const newHeadSha = 'a'.repeat(40);
  const sourceDigest = 'b'.repeat(64);
  let stored = null;
  let writes = 0;
  const client = { async rpc(name, args) {
    if (name === 'website_github_export_cursor_for_worker') return { data: stored, error: null };
    if (name === 'website_initialize_github_export_cursor') {
      assert.equal(args.p_branch, `tayar/${projectId}/production`);
      stored = { projectId, connectionVersion: 1, repositoryId: '88', environment: 'production', branch: args.p_branch,
        lastHeadSha: null, lastSourceDigest: null, version: 1 };
      return { data: 1, error: null };
    }
    if (name === 'website_reconcile_github_export_cursor') {
      return { data: stored?.lastOperationId === args.p_operation_id && stored.version === args.p_expected_version + 1
        && stored.lastHeadSha === args.p_new_head && stored.lastSourceDigest === args.p_source_digest ? stored.version : null, error: null };
    }
    assert.equal(name, 'website_commit_github_export_cursor');
    writes++;
    assert.equal(args.p_expected_head, null);
    if (stored.version !== args.p_expected_version || stored.lastHeadSha !== args.p_expected_head) {
      return { data: null, error: new Error('cursor changed') };
    }
    stored = { ...stored, lastHeadSha: args.p_new_head, lastSourceDigest: args.p_source_digest,
      lastOperationId: args.p_operation_id, version: 2 };
    return { data: null, error: new Error('response lost after commit') };
  } };
  const scope = { client, projectId, ownerId, connectionId, isCurrentOwner: () => true };
  assert.equal(await read(scope), null);
  await assert.rejects(initialize({ ...scope, repositoryId: '88', connectionVersion: 1, environment: 'production', branchIsAbsent: false }), /target changed/);
  const cursor = await initialize({ ...scope, repositoryId: '88', connectionVersion: 1, environment: 'production', branchIsAbsent: true });
  assert.equal(cursor.branch, `tayar/${projectId}/production`);
  assert.deepEqual(await read(scope), cursor);
  const input = { ...scope, cursor, operationId, newHeadSha, sourceDigest };
  assert.equal(await commit(input), 2);
  assert.equal(await commit(input), 2);
  assert.equal(writes, 1, 'A reconciled retry never increments cursor again');
  await assert.rejects(commit({ ...input, sourceDigest: 'c'.repeat(64) }), /cursor changed/);
  await assert.rejects(commit({ ...input, isCurrentOwner: () => false }), /scope changed/);
  console.log('PASS GitHub export cursor: dedicated branch, owner scope, CAS and uncertain commit reconciliation');
} finally { await rm(dir, { recursive: true, force: true }); }
