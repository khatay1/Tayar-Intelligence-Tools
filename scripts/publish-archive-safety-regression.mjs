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

let projectWrites = 0;
let liveWrites = 0;
let restores = 0;
const rollback = hookHarness('src/modules/website-builder/core/editor-rollback-handler.ts', {
  '@/lib/published-site-url': {
    buildPublishedSiteBaseUrl: () => 'https://example.test/site/owner/project',
    buildPublishedSiteUrl: () => 'https://example.test/site/owner/project/index.html',
    normalizePublishedSiteUrl: value => value,
  },
  '../core/editor-project-lifecycle': { saveLocalWebsiteProject: () => {} },
  '../core/publish-version-archive-validation': validation,
  '../services/projectCloudService': { updateWebsiteProjectPublicationState: async () => { projectWrites++; return { error: null }; } },
  '../services/publishedWebsiteService': {
    snapshotPublishedWebsiteFiles: async () => ({ files: new Map() }),
    removeStalePublishedWebsiteFiles: async () => {},
    downloadPublishedWebsiteFile: async () => ({ data: new Blob(['<html>old</html>'], { type: 'text/html' }), error: null }),
    uploadPublishedWebsiteBlob: async () => { liveWrites++; return { error: null }; },
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
assert.equal(projectWrites, 0, 'failed public verification never commits project published state');
assert.match(errorText, /restored automatically/);
console.log('PASS publication rollback: project-scoped archive, safe manifest, no unsafe cleanup, route verification before state commit');
