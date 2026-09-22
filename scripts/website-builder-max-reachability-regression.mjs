import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [bridge, v2Index, integrationsSlot, integrationsHost, integrationsRuntime] = await Promise.all([
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx'),
  read('src/modules/website-builder/v2-ui/index.ts'),
  read('src/modules/website-builder/v2-ui/BuilderIntegrationsSettingsSlot.tsx'),
  read('src/modules/website-builder/core/editor-integrations-project-host.ts'),
  read('src/modules/website-builder/core/editor-integration-runtime.ts'),
]);

assert.match(v2Index, /BuilderIntegrationsSettingsSlot/, 'Integrations settings slot must be exported from V2 UI');
assert.match(integrationsSlot, /BuilderIntegrationsMaxPanel/, 'Integrations settings slot must render the MAX panel');
assert.match(integrationsHost, /readEditorIntegrationsFromProject/, 'Integrations must have a project load boundary');
assert.match(integrationsHost, /writeEditorIntegrationsToProject/, 'Integrations must have a project save boundary');
assert.match(integrationsHost, /editorIntegrationPublishBlockers/, 'Integrations must participate in publish preflight');
assert.match(integrationsHost, /setEditorIntegrationSecret/, 'Integrations must keep secrets behind a host boundary');
assert.match(integrationsRuntime, /Idempotency-Key/, 'Integration delivery must remain idempotent');
assert.match(integrationsRuntime, /X-Tayar-Signature/, 'Integration delivery must retain signing support');

// End-to-end reachability guard. This intentionally fails until the V2 bridge exposes
// Integrations MAX through Settings; it prevents future "implemented but unreachable" regressions.
assert.match(bridge, /BuilderIntegrationsSettingsSlot/, 'V2 Settings must expose Integrations MAX');
assert.match(bridge, /integrationsConfig/, 'V2 bridge must accept integrations project state');
assert.match(bridge, /onChangeIntegrations/, 'V2 bridge must expose integrations persistence callback');
assert.match(bridge, /onSetIntegrationSecret/, 'V2 bridge must expose secure secret callback');
assert.match(bridge, /onTestIntegrationConnection/, 'V2 bridge must expose connection testing callback');

console.log('PASS Website Builder MAX reachability: integrations UI, project persistence, publish preflight, secrets and runtime are wired end-to-end');
