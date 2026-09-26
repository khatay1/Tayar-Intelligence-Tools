import assert from 'node:assert/strict';
import { hookHarness } from './test-support/hook-harness.mjs';

const events = [];
let healthy = true;
let rollbackFails = false;
const files = [{ name: 'index.html', content: '<!doctype html><html></html>', contentType: 'text/html' }];
const snapshot = { files: new Map() };
const service = hookHarness('src/modules/website-builder/services/publishingWorkflowService.ts', {
  './publishedWebsiteService': {
    readPublishedWebsiteFolderFiles: async path => { events.push(['read', path]); return files; },
    snapshotPublishedWebsiteFiles: async path => { events.push(['snapshot', path]); return snapshot; },
    replacePublishedWebsiteFiles: async (...args) => { events.push(['replace', ...args]); },
    restorePublishedWebsiteSnapshot: async (...args) => { events.push(['restore', ...args]); if (rollbackFails) throw new Error('Storage unavailable'); },
    archivePublishedWebsiteFiles: async (...args) => { events.push(['archive', ...args]); },
    verifyPublishedRoute: async () => healthy,
  },
  '../core/editor-publishing': {},
}).exports;
const input = { projectId: 'project', ownerId: 'owner', productionUrl: 'https://example.test' };
assert.equal(service.websitePublishingFolders('project', 'owner').production, 'owner/project');
assert.throws(() => service.websitePublishingFolders('../project', 'owner'), /valid project/);
assert.throws(() => service.websitePublishingFolders('project', 'owner/other'), /valid project/);
await service.promoteStagingToProduction(input);
assert.equal(events.find(e => e[0] === 'replace')[1], 'owner/project');
assert.equal(events.filter(e => e[0] === 'restore').length, 0);
healthy = false;
await assert.rejects(service.promoteStagingToProduction(input), /restored automatically/);
assert.equal(events.at(-1)[0], 'restore');
assert.equal(events.at(-1)[2], snapshot);
rollbackFails = true;
await assert.rejects(service.promoteStagingToProduction(input), /rollback was incomplete.*Storage unavailable/);
rollbackFails = false;
const before = events.length;
await assert.rejects(service.restoreProductionFromArchive({ ...input, archivePrefix: 'other/project/versions/id' }), /belong to this project/);
assert.equal(events.length, before, 'invalid archive rejected before any storage IO');
await assert.rejects(service.restoreProductionFromArchive({ ...input, archivePrefix: 'owner/project/versions/../id' }), /belong to this project/);
await assert.rejects(service.restoreProductionFromArchive({ ...input, archivePrefix: 'owner/project/versions/id' }), /restored automatically/);
await service.createImmutableReleaseArchive({ archivePrefix: 'owner/project/versions/id', files });
assert.equal(events.at(-1)[0], 'archive', 'archives use the existing no-overwrite storage implementation');

let published = 0;
let staged = 0;
let locallyPreviewed = 0;
let stageSucceeds = true;
const bridge = hookHarness('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx', {
  '@/context/AuthContext': { useAuth: () => ({ user: { id: 'owner' } }) },
  '../core/editor-project-lifecycle': { loadActiveWebsiteProjectId: () => 'project' },
  '../services/publishScheduleService': { createWebsitePublishSchedule: async () => { throw new Error('unexpected schedule'); } },
  './WebsiteBuilderV2BridgeBase': { default: 'bridge' },
}).exports.WebsiteBuilderV2Bridge({ pages: [], onPublish: () => { published++; }, onPreview: () => { locallyPreviewed++; }, onStage: async () => { staged++; return stageSucceeds; } });
await assert.rejects(bridge.props.onPublishPlan({ mode: 'selective', environment: 'production' }), /Selected-page publishing/);
assert.equal(published, 0, 'selective publish must never silently publish the whole site');
await bridge.props.onPublishPlan({ mode: 'full', environment: 'production' });
assert.equal(published, 1);
await bridge.props.onPublishPlan({ mode: 'full', environment: 'staging' });
assert.equal(staged, 1, 'staging must create a cloud preview');
assert.equal(locallyPreviewed, 0, 'staging must not invoke the local preview');
assert.equal(published, 1, 'staging must not publish production');
stageSucceeds = false;
await assert.rejects(bridge.props.onPublishPlan({ mode: 'full', environment: 'staging' }), /Staging could not be created/);
console.log('PASS publishing: correct live path, archive isolation, rollback after verification failure, immutable storage and selective guard');

const publishing = hookHarness('src/modules/website-builder/core/editor-publishing.ts').exports;
let ready = false;
let writes = 0;
let inserted;
const schedules = hookHarness('src/modules/website-builder/services/publishScheduleService.ts', {
  '@/lib/supabase': { supabase: {
    rpc: async () => ({ data: ready, error: null }),
    functions: { invoke: async () => ({ data: { ready }, error: null }) },
    from: () => ({ insert: value => { writes++; inserted = value; return { select: () => ({ single: async () => ({ data: { id: 'id' }, error: null }) }) }; } }),
  } },
  '../core/editor-publishing': publishing,
}).exports;
const future = '2099-07-01T12:30:00+02:00';
assert.match((await schedules.rescheduleWebsitePublish({ id: 'id', projectId: 'project', ownerId: 'owner', scheduledAt: future })).error.message, /unavailable/);
assert.equal(writes, 0);
ready = true;
await schedules.createWebsitePublishSchedule({ id: 'id', projectId: 'project', ownerId: 'owner', plan: { scheduledAt: future }, allPageIds: ['page'] });
assert.equal(inserted.scheduled_at, '2099-07-01T10:30:00.000Z');
console.log('PASS schedule: timezone-preserving UTC timestamps and unavailable reschedule guard');

// Exercise the real staging handler through save, upload, verification and commit failures.
let saveThrows = false;
let saveSucceeds = true;
let previewHealthy = true;
let commitFails = false;
const previewEvents = [];
const previewState = {};
const previewHandler = hookHarness('src/modules/website-builder/core/editor-share-preview-handler.ts', {
  '@/lib/published-site-url': {
    buildPreviewSiteBaseUrl: () => 'https://example.test/preview/token',
    buildPreviewSiteUrl: () => 'https://example.test/preview/token/index.html',
    buildPublishedSiteBaseUrl: () => 'https://example.test/site/project',
  },
  '../core/website-builder-config': { sanitizeRobotsRules: () => '' },
  '../core/website-builder-rendering': { escapeHtml: value => value },
  '../core/website-localization': { websitePathUrl: (base, name) => `${base}/${name}` },
  '../services/projectCloudService': { updateWebsiteProjectInCloud: async () => {
    previewEvents.push('commit');
    return { error: commitFails ? { message: 'Revision conflict' } : null, data: { updated_at: 'revision' } };
  } },
  '../services/publishedWebsiteService': {
    uploadPublishedWebsiteFolderFiles: async path => { previewEvents.push(path); },
    verifyPublishedRoute: async () => previewHealthy,
    removePublishedWebsiteFiles: async () => { previewEvents.push('revoke'); },
  },
}, { Error }).exports.createSharePreviewHandler;
const setters = Object.fromEntries(['CloudProjects', 'PreviewBusy', 'PreviewCreatedAt', 'PreviewError', 'PreviewFingerprint', 'PreviewToken', 'PreviewUrl', 'Saved'].map(name => [`set${name}`, value => { previewState[name] = value; }]));
const createPreview = previewHandler({
  ...setters,
  activeUserIdRef: { current: 'owner' }, cloudProjectId: 'project',
  cloudRevisionRef: { current: { projectId: 'project', updatedAt: 'before' } },
  previewOperationSequenceRef: { current: 0 }, projectLoadSequenceRef: { current: 0 },
  previewBusy: false, publishBusy: false, previewToken: 'old',
  projectTeamAccess: { canPublish: true }, user: { id: 'owner' },
  siteAudit: { errors: [] }, cmsErrors: [], productionConfig: {},
  siteName: 'Test', publishedUrl: '',
  buildProjectData: () => ({ updatedAt: 'revision' }), buildEditableFingerprint: () => 'fingerprint',
  saveProject: async () => { if (saveThrows) throw new Error('Save failed'); return saveSucceeds; },
  getOutputPages: () => [{ id: 'home', sections: [] }], getOutputFilename: () => 'index.html',
  getHtml: () => '<!doctype html><html></html>', get404Html: () => '<!doctype html><html>404</html>',
});
saveThrows = true;
assert.equal(await createPreview(), false);
assert.equal(previewState.PreviewBusy, false, 'save exceptions must release the busy state');
assert.equal(previewState.PreviewError, 'Save failed');
assert.equal(previewEvents.length, 0);
saveThrows = false;
saveSucceeds = false;
assert.equal(await createPreview(), false);
assert.equal(previewState.PreviewBusy, false);
assert.equal(previewEvents.length, 0, 'failed synchronization must not upload');
saveSucceeds = true;
previewHealthy = false;
assert.equal(await createPreview(), false);
assert.ok(!previewEvents.includes('commit'), 'unhealthy previews must not commit');
previewHealthy = true;
commitFails = true;
assert.equal(await createPreview(), false);
assert.ok(!previewEvents.includes('revoke'), 'failed commit must retain the previous preview');
commitFails = false;
assert.equal(await createPreview(), true);
assert.equal(previewState.PreviewBusy, false);
assert.equal(previewState.PreviewUrl, 'https://example.test/preview/token/index.html');
assert.equal(previewEvents.at(-1), 'revoke');
console.log('PASS staging: cloud callback, failure propagation, save cleanup, route verification and commit-before-revoke');
