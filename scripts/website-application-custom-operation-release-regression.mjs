import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-operation-release-'));
try {
  const outfile = join(dir, 'custom-operation-release.cjs');
  await build({ entryPoints: ['server/website-application-custom-operation-release.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { resolvePublishedCustomOperationArtifact } = (await import(pathToFileURL(outfile))).default;
  const release = {
    id: 'release_1', project_id: 'project_1', user_id: 'owner_1', storage_bucket: 'website-application-releases',
    snapshot: { application: { requirements: { specification: { operations: [
      { id: 'calculate_1', execution: 'custom', source: 'return { total: input.price * input.quantity };' },
    ] } } } },
  };
  const ids = { ownerId: 'owner_1', projectId: 'project_1', releaseId: 'release_1', operationId: 'calculate_1' };
  assert.deepEqual(resolvePublishedCustomOperationArtifact({ ...ids, release }), {
    releaseId: 'release_1', operationId: 'calculate_1', source: 'return { total: input.price * input.quantity };',
  });
  for (const mismatch of [
    { releaseId: 'other_release' }, { projectId: 'other_project' }, { ownerId: 'other_owner' },
    { operationId: 'unknown' },
  ]) assert.equal(resolvePublishedCustomOperationArtifact({ ...ids, ...mismatch, release }), null);
  assert.equal(resolvePublishedCustomOperationArtifact({ ...ids, release: { ...release, storage_bucket: 'published-sites' } }), null);
  assert.equal(resolvePublishedCustomOperationArtifact({ ...ids, release: { ...release, snapshot: {} } }), null);
  assert.equal(resolvePublishedCustomOperationArtifact({ ...ids, release: { ...release,
    snapshot: { application: { requirements: { specification: { operations: [
      { id: 'calculate_1', execution: 'native', source: 'return 1;' },
    ] } } } },
  } }), null);
  assert.equal(resolvePublishedCustomOperationArtifact({ ...ids, release: { ...release,
    snapshot: { application: { requirements: { specification: { operations: [
      { id: 'calculate_1', execution: 'custom', source: 'x'.repeat(65 * 1024) },
    ] } } } },
  } }), null);
  console.log('Published custom operation immutable-release resolver regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
