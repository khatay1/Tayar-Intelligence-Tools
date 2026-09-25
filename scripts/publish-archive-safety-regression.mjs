import assert from 'node:assert/strict';
import { hookHarness } from './test-support/hook-harness.mjs';

const names = hookHarness('src/modules/website-builder/core/published-site-validation.ts').exports;
const validation = hookHarness('src/modules/website-builder/core/publish-version-archive-validation.ts', {
  './published-site-validation': names,
}).exports;
const valid = {
  ownerId: 'owner', projectId: 'project', versionId: 'release',
  storagePrefix: 'owner/project/versions/release',
  fileManifest: [{ name: 'index.html', contentType: 'text/html' }, { name: 'sv/about.html', contentType: 'text/html' }],
};
validation.assertValidPublishVersionArchive(valid);
for (const invalid of [
  { storagePrefix: 'owner/another-project/versions/release' },
  { storagePrefix: 'owner/project/previews/release' },
  { fileManifest: [{ name: '../index.html', contentType: 'text/html' }] },
  { fileManifest: [{ name: 'index.html', contentType: 'text/html' }, { name: 'staging/index.html', contentType: 'text/html' }] },
  { fileManifest: [{ name: 'index.html', contentType: 'text/html' }, { name: 'index.html', contentType: 'text/html' }] },
]) assert.throws(() => validation.assertValidPublishVersionArchive({ ...valid, ...invalid }));

let dbChanges = 0;
const versions = hookHarness('src/modules/website-builder/services/publishVersionService.ts', {
  '@/lib/supabase': { supabase: { from: () => { dbChanges++; throw new Error('Unwanted database write'); } } },
  '../core/publish-version-archive-validation': validation,
}).exports;
assert.ok((await versions.deleteWebsitePublishVersionArchive({ ...valid, storagePrefix: 'owner/other/versions/release' })).error);
assert.ok((await versions.discardWebsitePublishVersionArchive({ ...valid, fileManifest: [{ name: '../index.html', contentType: 'text/html' }] })).error);
assert.equal(dbChanges, 0, 'invalid targets must be rejected before deleting any database row');

let deleteWrites = 0;
let removedPaths = [];
let storedArchive = { storage_prefix: valid.storagePrefix, file_manifest: valid.fileManifest };
const archiveStore = hookHarness('src/modules/website-builder/services/publishVersionService.ts', {
  '@/lib/supabase': { supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: storedArchive, error: null }) }) }) }) }),
      delete: () => { deleteWrites++; return { eq: () => ({ eq: () => ({ eq: () => ({ select: async () => ({ data: [{ id: valid.versionId }], error: null }) }) }) }) }; },
    }),
    storage: { from: () => ({ remove: async paths => { removedPaths = paths; return { error: null }; } }) },
  } },
  '../core/publish-version-archive-validation': validation,
}).exports;
storedArchive = { ...storedArchive, storage_prefix: 'owner/project/versions/another-release' };
assert.ok((await archiveStore.deleteWebsitePublishVersionArchive(valid)).error);
storedArchive = { ...storedArchive, storage_prefix: valid.storagePrefix, file_manifest: [{ name: 'index.html', contentType: 'text/html' }] };
assert.ok((await archiveStore.deleteWebsitePublishVersionArchive(valid)).error);
assert.equal(deleteWrites, 0, 'stored archive identity and manifest must match before deleting the record');
storedArchive = { storage_prefix: valid.storagePrefix, file_manifest: [...valid.fileManifest].reverse() };
assert.equal((await archiveStore.deleteWebsitePublishVersionArchive(valid)).error, null);
assert.equal(deleteWrites, 1);
assert.deepEqual(removedPaths, valid.fileManifest.map(item => `${valid.storagePrefix}/${item.name}`));

let projectWrites = 0;
let liveWrites = 0;
let restores = 0;
let snapshots = 0;
let staleRemovals = 0;
let missingArchiveFile = false;
let invalidArchivedIndex = false;
let invalidLiveIndex = false;
let failLiveUpload = false;
let liveEvents = [];
const rollback = hookHarness('src/modules/website-builder/core/editor-rollback-handler.ts', {
  '@/lib/published-site-url': {
    buildPublishedSiteBaseUrl: () => 'https://example.test/site/owner/project',
    buildPublishedSiteUrl: () => 'https://example.test/site/owner/project/index.html',
    normalizePublishedSiteUrl: value => value,
  },
  '../core/editor-project-lifecycle': { saveLocalWebsiteProject: () => {} },
  '../core/publish-version-archive-validation': validation,
  '../core/published-site-validation': names,
  '../services/projectCloudService': { updateWebsiteProjectPublicationState: async () => { projectWrites++; return { error: null }; } },
  '../services/publishedWebsiteService': {
    snapshotPublishedWebsiteFiles: async () => { snapshots++; return { files: new Map() }; },
    removeStalePublishedWebsiteFiles: async () => { staleRemovals++; liveEvents.push('remove stale'); },
    downloadPublishedWebsiteFile: async path => missingArchiveFile && path.endsWith('sv/about.html')
      ? { data: null, error: null }
      : { data: new Blob([(invalidArchivedIndex && path.endsWith('/index.html')) || (invalidLiveIndex && path === 'owner/project/index.html') ? 'broken html' : '<html>old</html>'], { type: 'text/html' }), error: null },
    uploadPublishedWebsiteBlob: async () => { liveWrites++; liveEvents.push('upload'); return { error: failLiveUpload ? { message: 'Upload failed' } : null }; },
    verifyPublishedRoute: async () => false,
    restorePublishedWebsiteSnapshot: async () => { restores++; },
  },
}, { window: { confirm: () => true }, Blob }).exports;
let errorText = '';
const refs = { activeUserIdRef: { current: 'owner' }, cloudRevisionRef: { current: { projectId: 'project', updatedAt: '2026-01-01' } }, projectLoadSequenceRef: { current: 0 }, publishOperationSequenceRef: { current: 0 }, saveInFlightRef: { current: false } };
const handler = rollback.createRollbackPublishVersionHandler({
  ...refs,
  user: { id: 'owner' }, cloudProjectId: 'project', publishBusy: false, previewBusy: false,
  projectTeamAccess: { canPublish: true }, buildProjectData: () => ({}),
  l: value => value, setPublishBusy: () => {}, setPublishError: value => { errorText = value; },
  verifyLiveDeployment: async () => true,
});
await handler({
  id: 'release', project_id: 'project', user_id: 'owner', storage_prefix: valid.storagePrefix,
  file_manifest: [{ name: 'index.html', contentType: 'text/html' }], created_at: '2026-01-01', published_url: 'https://example.test/index.html',
});
assert.equal(liveWrites, 1, 'archive is restored before public verification');
assert.equal(restores, 1, 'failed public verification restores previous live snapshot');
assert.deepEqual(liveEvents, ['upload', 'remove stale'], 'stale files are removed only after the new index is uploaded');
assert.equal(projectWrites, 0, 'failed public verification never commits project published state');
assert.match(errorText, /restored automatically/);
missingArchiveFile = true;
liveWrites = 0;
restores = 0;
snapshots = 0;
staleRemovals = 0;
errorText = '';
await handler({
  id: 'release', project_id: 'project', user_id: 'owner', storage_prefix: valid.storagePrefix,
  file_manifest: valid.fileManifest, created_at: '2026-01-01', published_url: 'https://example.test/index.html',
});
assert.match(errorText, /Could not restore sv\/about\.html/);
assert.equal(snapshots, 0, 'an incomplete archive fails before making a live backup');
assert.equal(staleRemovals, 0, 'an incomplete archive must never delete live files');
assert.equal(liveWrites, 0, 'an incomplete archive must never upload live files');
assert.equal(restores, 0, 'the live site is untouched when the archive preflight fails');
missingArchiveFile = false;
invalidArchivedIndex = true;
errorText = '';
await handler({
  id: 'release', project_id: 'project', user_id: 'owner', storage_prefix: valid.storagePrefix,
  file_manifest: valid.fileManifest, created_at: '2026-01-01', published_url: 'https://example.test/index.html',
});
assert.match(errorText, /archived index\.html is not a valid/);
assert.equal(staleRemovals, 0, 'invalid archived HTML must never touch live files');
assert.equal(liveWrites, 0);
invalidArchivedIndex = false;
failLiveUpload = true;
liveWrites = 0;
staleRemovals = 0;
restores = 0;
await handler({
  id: 'release', project_id: 'project', user_id: 'owner', storage_prefix: valid.storagePrefix,
  file_manifest: valid.fileManifest, created_at: '2026-01-01', published_url: 'https://example.test/index.html',
});
assert.equal(liveWrites, 1);
assert.equal(staleRemovals, 0, 'failed upload must keep prior live files until rollback');
assert.equal(restores, 1, 'failed live upload restores the previous snapshot');
failLiveUpload = false;
invalidLiveIndex = true;
staleRemovals = 0;
restores = 0;
await handler({
  id: 'release', project_id: 'project', user_id: 'owner', storage_prefix: valid.storagePrefix,
  file_manifest: valid.fileManifest, created_at: '2026-01-01', published_url: 'https://example.test/index.html',
});
assert.equal(staleRemovals, 0, 'unverified live index must retain old routes until rollback');
assert.equal(restores, 1, 'unverified live index restores the previous snapshot');
console.log('PASS publication rollback: project-scoped archive, stored manifest matching, archive preflight, safe cleanup, route verification before state commit');
