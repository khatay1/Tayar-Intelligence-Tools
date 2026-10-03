import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [bridge, presentation, versions, publishing, publishHandler] = await Promise.all([
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx'),
  read('src/modules/website-builder/v2-ui/WebsiteBuilderPresentation.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderPublishVersionsPanel.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderPublishingMaxPanel.tsx'),
  read('src/modules/website-builder/core/editor-publish-handler.ts'),
]);

assert.match(bridge, /onOpenPublishVersions\?\(\):void/,
  'The V2 bridge must expose a versions-open lifecycle hook');
assert.match(bridge, /setPublishingTool\('versions'\);onOpenPublishVersions\?\.\(\)/,
  'Opening Versions must trigger host refresh instead of only changing local tabs');
assert.match(bridge, /setLeftPanel\('site'\)/,
  'Domains must have a native V2 Site-panel fallback');
assert.match(bridge, /setLeftSidebarOpen\(true\)/,
  'Domains fallback must make the Site panel visible');
assert.match(bridge, /if\(onOpenDomains\)\{onOpenDomains\(\);return;\}/,
  'Explicit host domain navigation must retain priority');
assert.match(bridge, /disabled=\{publishing\}/,
  'Version restore controls must inherit publish\/rollback busy state');

assert.match(presentation, /publishRevisions=\{publishVersions\.map/,
  'Current persisted publish versions must feed Publishing MAX');
assert.match(presentation, /pageIds: publishRevisionPageIds\(version\.snapshot\)/,
  'Publishing MAX revisions should expose their real page counts');
assert.match(presentation, /onOpenPublishVersions=\{\(\) => \{[\s\S]*refreshPublishVersions\(\)/,
  'Opening Versions must refresh the persisted release history');
assert.match(presentation, /publishVersions\.find\(\(candidate\) => candidate\.id === revision\.id\)/,
  'Restore must resolve against the current version collection');
assert.match(presentation, /rollbackPublishVersion\(version\)/,
  'Publishing MAX Restore must use the live rollback path');

assert.match(versions, /disabled\?:boolean/,
  'Versions panel must support a busy guard');
assert.match(versions, /disabled=\{disabled\|\|restoringId===revision\.id\}/,
  'Restore must reject duplicate clicks while a rollback is active');
assert.match(publishing, /Versions & rollback|onOpenVersions/,
  'Publishing MAX must retain the visible Versions & rollback entry point');
assert.match(publishing, /onOpenDomains/,
  'Publishing MAX must retain the visible Domains entry point');
assert.match(publishing, /!onPublishPlan/,
  'An unbound Publishing MAX action must be visibly disabled instead of becoming a no-op');

assert.match(presentation, /onPublishPlan=\{async \(plan\) => \{/,
  'The current Website Builder host must execute Publishing MAX plans');
assert.match(presentation, /plan\.mode !== 'full' \|\| plan\.scheduledAt/,
  'The host must fail closed for unsupported selective or scheduled plans');
assert.match(presentation, /plan\.environment === 'staging'[\s\S]*await createSharePreview\(\)/,
  'Staging plans must use the real preview pipeline');
assert.match(presentation, /await publishWebsite\(false, plan\.releaseNote\)/,
  'Production plans must use the real publishing pipeline with the submitted release note');
assert.match(presentation, /setReleaseNote\(plan\.releaseNote\)/,
  'Publishing MAX release notes must stay synchronized with the legacy release state');

assert.match(publishHandler, /publishWebsite\(fromStaging = false, releaseNoteOverride\?: string\)/,
  'The publishing handler must accept a race-free release-note override');
assert.match(publishHandler, /\(releaseNoteOverride \?\? releaseNote\)\.trim\(\)\.slice\(0, 500\)/,
  'The persisted release note must use the plan override while retaining the existing 500 character bound');

console.log('PASS Publishing MAX V2 reachability: executable staging\/production plans, versions refresh, live rollback, page counts, busy guard and native domain navigation');
