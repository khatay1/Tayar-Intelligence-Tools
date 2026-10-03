import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [bridge, presentation, versions, publishing] = await Promise.all([
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx'),
  read('src/modules/website-builder/v2-ui/WebsiteBuilderPresentation.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderPublishVersionsPanel.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderPublishingMaxPanel.tsx'),
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

console.log('PASS Publishing MAX V2 reachability: versions refresh, live rollback, page counts, busy guard and native domain navigation');
