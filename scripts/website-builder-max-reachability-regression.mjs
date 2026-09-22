import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [
  bridge,
  v2Index,
  integrationsSlot,
  integrationsHost,
  integrationsStore,
  integrationsRuntime,
  lifecycle,
  normalization,
  cloudService,
] = await Promise.all([
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx'),
  read('src/modules/website-builder/v2-ui/index.ts'),
  read('src/modules/website-builder/v2-ui/BuilderIntegrationsSettingsSlot.tsx'),
  read('src/modules/website-builder/core/editor-integrations-project-host.ts'),
  read('src/modules/website-builder/core/editor-integrations-host-store.ts'),
  read('src/modules/website-builder/core/editor-integration-runtime.ts'),
  read('src/modules/website-builder/core/editor-project-lifecycle.ts'),
  read('src/modules/website-builder/core/project-normalization.ts'),
  read('src/modules/website-builder/services/projectCloudService.ts'),
]);

assert.match(v2Index, /BuilderIntegrationsSettingsSlot/, 'Integrations settings slot must be exported from V2 UI');
assert.match(integrationsSlot, /BuilderIntegrationsMaxPanel/, 'Integrations settings slot must render the MAX panel');
assert.match(integrationsHost, /readEditorIntegrationsFromProject/, 'Integrations must have a project load boundary');
assert.match(integrationsHost, /writeEditorIntegrationsToProject/, 'Integrations must have a project save boundary');
assert.match(integrationsHost, /editorIntegrationPublishBlockers/, 'Integrations must participate in publish preflight');
assert.match(integrationsHost, /setEditorIntegrationSecret/, 'Integrations must keep secrets behind a host boundary');
assert.match(integrationsRuntime, /Idempotency-Key/, 'Integration delivery must remain idempotent');
assert.match(integrationsRuntime, /X-Tayar-Signature/, 'Integration delivery must retain signing support');

assert.match(integrationsStore, /hydrateEditorIntegrationsHostFromProject/, 'Integrations host must hydrate from project data');
assert.match(integrationsStore, /embedEditorIntegrationsHostIntoProject/, 'Integrations host must embed configuration into project data');
assert.match(lifecycle, /embedEditorIntegrationsHostIntoProject/, 'Local and recovery saves must persist integrations');
assert.match(lifecycle, /hydrateEditorIntegrationsHostFromProject/, 'Local and recovery loads must hydrate integrations');
assert.match(normalization, /hydrateEditorIntegrationsHostFromProject\(input\)/, 'Cloud/project normalization must hydrate integrations');
assert.match(cloudService, /embedEditorIntegrationsHostIntoProject\(content\)/, 'Cloud save/create must persist integrations');
assert.match(cloudService, /embedEditorIntegrationsHostIntoProject\(input\.content\)/, 'Publish-state cloud writes must persist integrations');

// End-to-end reachability guard. This fails if Integrations MAX becomes implemented-but-unreachable.
assert.match(bridge, /BuilderIntegrationsSettingsSlot/, 'V2 Settings must expose Integrations MAX');
assert.match(bridge, /integrationsConfig/, 'V2 bridge must accept integrations project state');
assert.match(bridge, /onChangeIntegrations/, 'V2 bridge must expose integrations persistence callback');
assert.match(bridge, /onSetIntegrationSecret/, 'V2 bridge must expose secure secret callback');
assert.match(bridge, /onTestIntegrationConnection/, 'V2 bridge must expose connection testing callback');
assert.match(bridge, /useSyncExternalStore/, 'V2 bridge must stay synchronized with the persisted integrations host');
assert.match(bridge, /editorIntegrationPublishBlockers/, 'V2 publish controls must include integration blockers');
assert.match(bridge, /resolvedOnChangeIntegrations/, 'V2 settings must remain editable even when the legacy host omits new props');

console.log('PASS Website Builder MAX reachability: integrations UI, persisted local/cloud project state, publish preflight, secrets boundary and runtime are wired end-to-end');
