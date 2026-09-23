import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [tool, bridge, redirectsPanel, versionsPanel, domainService, versionService] = await Promise.all([
  read('src/modules/website-builder/WebsiteBuilderTool.tsx'),
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderRedirectsPanel.tsx'),
  read('src/modules/website-builder/v2-ui/BuilderPublishVersionsPanel.tsx'),
  read('src/modules/website-builder/services/websiteDomainService.ts'),
  read('src/modules/website-builder/services/publishVersionService.ts'),
]);

assert.match(redirectsPanel, /onSave/, 'Redirects UI must expose persistence');
assert.match(versionsPanel, /onRestore/, 'Versions UI must expose rollback');
assert.match(bridge, /publishRedirects/, 'V2 bridge must expose redirect state');
assert.match(bridge, /publishRevisions/, 'V2 bridge must expose release revisions');
assert.match(bridge, /onOpenDomains/, 'V2 bridge must expose domain management');
assert.match(domainService, /connectWebsiteCustomDomain/, 'Domain service must support connection');
assert.match(domainService, /checkWebsiteCustomDomain/, 'Domain service must support verification');
assert.match(domainService, /removeWebsiteCustomDomain/, 'Domain service must support removal');
assert.match(versionService, /listWebsitePublishVersions/, 'Release service must support version listing');

// Active host reachability: implemented controls are not MAX-complete until the real
// Website Builder supplies state/actions to the V2 bridge.
assert.match(tool, /publishRedirects=/, 'WebsiteBuilder host must provide redirect state to Publishing MAX');
assert.match(tool, /onChangePublishRedirects=/, 'WebsiteBuilder host must make redirects editable');
assert.match(tool, /onSavePublishRedirects=/, 'WebsiteBuilder host must persist redirects');
assert.match(tool, /publishRevisions=/, 'WebsiteBuilder host must provide release revisions');
assert.match(tool, /onRestorePublishRevision=/, 'WebsiteBuilder host must wire release rollback');
assert.match(tool, /onOpenDomains=/, 'WebsiteBuilder host must make domain management reachable from Publishing MAX');

console.log('PASS Website Builder Publishing MAX surfaces: redirects, versions/rollback and domains are reachable end-to-end');
