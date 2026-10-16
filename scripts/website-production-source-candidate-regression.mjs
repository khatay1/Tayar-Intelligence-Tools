import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-production-source-checkpoint-'));
try {
  const out = join(dir, 'checkpoint.cjs');
  await build({ stdin: { contents: `export {recordWebsiteProductionSourceCandidate as record} from './server/website-production-source-candidate';
    export {websiteProjectReleaseDigest as digest} from './src/modules/website-builder/core/website-project-release-digest';`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: out });
  const { record, digest } = (await import(pathToFileURL(out))).default;
  const ids = Array.from({ length: 5 }, (_, n) => `${n + 1}`.repeat(8) + '-' + `${n + 1}`.repeat(4) + '-4' + `${n + 1}`.repeat(3) + '-8' + `${n + 1}`.repeat(3) + '-' + `${n + 1}`.repeat(12));
  const [operationId, projectId, ownerId, previewOperationId, githubConnectionId] = ids;
  let snapshot = { application: { version: 1 }, siteName: 'Prepared source' }, current = true;
  const candidate = { status: 'source-prepared', previewSourceDigest: 'd'.repeat(64), operationId, projectId, ownerId, previewOperationId, githubConnectionId,
    snapshotDigest: await digest(snapshot), runtimeDigest: 'a'.repeat(64), sourceDigest: 'b'.repeat(64), headSha: 'c'.repeat(40) };
  let stored = null, writes = 0, lose = false, throwResponse = false, invalidate = false;
  const client = { rpc: async (name, args) => {
    if (name === 'website_read_production_source_candidate') {
      assert.deepEqual(args, { p_operation_id: operationId, p_project_id: projectId, p_owner_id: ownerId });
      return { data: structuredClone(stored), error: null };
    }
    assert.equal(name, 'website_record_production_source_candidate'); writes++;
    assert.deepEqual(args.p_snapshot, snapshot); assert.equal(args.p_preview_source_digest, 'd'.repeat(64));
    assert.equal(args.p_preview_operation_id, previewOperationId); assert.equal(args.p_github_connection_id, githubConnectionId);
    stored = structuredClone(candidate); if (invalidate) current = false;
    if (throwResponse) throw Error('private transport detail');
    return lose ? { data: null, error: { message: 'private transport detail' } } : { data: structuredClone(stored), error: null };
  } };
  const options = { client, reader: { readSavedProject: async () => ({ projectId, ownerId, snapshot: structuredClone(snapshot) }), readConnection: async () => null },
    candidate, isCurrent: async () => current };
  assert.deepEqual(await record(options), candidate); assert.equal(writes, 1);
  assert.deepEqual(await record(options), candidate); assert.equal(writes, 1, 'Exact retry performs no second write');
  for (const mode of ['error', 'throw']) {
    stored = null; lose = mode === 'error'; throwResponse = mode === 'throw';
    assert.deepEqual(await record(options), candidate, 'Lost response reconciles exact metadata');
  }
  lose = false; throwResponse = false;
  for (const change of [{ headSha: 'e'.repeat(40) }, { ownerId: operationId }, { status: 'ready' }, { sourceDigest: 'e'.repeat(64) }, { previewSourceDigest: '0'.repeat(64) }, { accessToken: 'private' }]) {
    stored = { ...candidate, ...change }; const before = writes;
    await assert.rejects(record(options), /checkpoint is unavailable/); assert.equal(writes, before, 'Conflicting prior operation is never overwritten');
  }
  stored = null; const beforeStale = writes; snapshot = { ...snapshot, siteName: 'Changed' };
  await assert.rejects(record(options), /checkpoint is unavailable/); assert.equal(writes, beforeStale);
  snapshot.siteName = 'Prepared source'; current = false;
  await assert.rejects(record(options), /checkpoint is unavailable/); assert.equal(writes, beforeStale);
  current = true;
  await assert.rejects(record({ ...options, candidate: { ...candidate, sourceDigest: candidate.previewSourceDigest } }), /checkpoint is unavailable/);
  assert.equal(writes, beforeStale);
  invalidate = true;
  await assert.rejects(record(options), /checkpoint is unavailable/); assert.equal(writes, beforeStale + 1, 'Post-write invalidation cannot return readiness');
  console.log('PASS Production source checkpoint: exact immutable metadata, scoped snapshot, retry/lost-response recovery and stale/conflicting/secret refusal (RPC mocked; no deployment approval)');
} finally { await rm(dir, { recursive: true, force: true }); }
