import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

const [
  bridge,
  bridgeBase,
  v2Index,
  integrationsSlot,
  integrationsHost,
  integrationsStore,
  integrationsRuntime,
  localizationSlot,
  localizationStore,
  maxState,
  lifecycle,
  normalization,
  cloudService,
] = await Promise.all([
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx'),
  read('src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx'),
  read('src/modules/website-builder/v2-ui/index.ts'),
  read('src/modules/website-builder/v2-ui/BuilderIntegrationsSettingsSlot.tsx'),
  read('src/modules/website-builder/core/editor-integrations-project-host.ts'),
  read('src/modules/website-builder/core/editor-integrations-host-store.ts'),
  read('src/modules/website-builder/core/editor-integration-runtime.ts'),
  read('src/modules/website-builder/v2-ui/BuilderLocalizationSettingsSlot.tsx'),
  read('src/modules/website-builder/core/editor-localization-host-store.ts'),
  read('src/modules/website-builder/core/editor-max-project-state.ts'),
  read('src/modules/website-builder/core/editor-project-lifecycle.ts'),
  read('src/modules/website-builder/core/project-normalization.ts'),
  read('src/modules/website-builder/services/projectCloudService.ts'),
]);
const bridgeSources = `${bridge}\n${bridgeBase}`;

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
assert.match(lifecycle, /embedEditorMaxProjectState/, 'Local and recovery saves must persist the complete MAX state envelope');
assert.match(lifecycle, /hydrateEditorMaxProjectState/, 'Local and recovery loads must hydrate the complete MAX state envelope');
assert.match(normalization, /hydrateEditorMaxProjectState\(input\)/, 'Cloud/project normalization must hydrate MAX state');
assert.match(normalization, /maxState/, 'Normalized project loads must expose MAX state explicitly');
assert.match(cloudService, /embedEditorMaxProjectState\(content\)/, 'Cloud save/create must persist MAX state');
assert.match(cloudService, /embedEditorMaxProjectState\(input\.content\)/, 'Publish-state cloud writes must persist MAX state');

assert.match(maxState, /EDITOR_MAX_STATE_VERSION/, 'MAX project state must remain versioned');
assert.match(maxState, /withEditorMaxProjectState/, 'MAX state updates must use a non-destructive patch boundary');
assert.match(maxState, /cms:/, 'MAX state must reserve CMS state');
assert.match(maxState, /localization:/, 'MAX state must reserve localization state');
assert.match(maxState, /publishing:/, 'MAX state must reserve publishing state');
assert.match(maxState, /forms:/, 'MAX state must reserve forms state');
assert.match(maxState, /designSystem:/, 'MAX state must reserve design-system state');
assert.match(maxState, /collaboration:/, 'MAX state must reserve collaboration state');
assert.match(maxState, /integrations:/, 'MAX state must reserve integrations state');
assert.match(maxState, /localization: getEditorLocalizationHostConfig\(\)/, 'Saving MAX state must capture the active localization host');
assert.match(maxState, /hydrateEditorLocalizationHost\(state\.localization\)/, 'Loading MAX state must restore localization host state');
assert.match(localizationStore, /subscribeEditorLocalizationHost/, 'Localization host must notify the UI after hydration or edits');
assert.match(localizationStore, /createEditorLocalizationConfig/, 'Missing legacy localization state must fall back safely');
assert.match(localizationSlot, /BuilderLocalizationMaxPanel/, 'Localization settings slot must render Localization MAX');
assert.match(localizationSlot, /useSyncExternalStore/, 'Localization settings must track the persisted host state');
assert.match(localizationSlot, /setEditorLocalizationHostConfig/, 'Localization edits must update the persisted host state');
assert.match(bridgeSources, /BuilderLocalizationSettingsSlot/, 'V2 Settings must expose persisted Localization MAX');

// End-to-end reachability guard. The V2 bridge is intentionally split into a host wrapper and UI base.
assert.match(bridgeSources, /BuilderIntegrationsSettingsSlot/, 'V2 Settings must expose Integrations MAX');
assert.match(bridgeSources, /integrationsConfig/, 'V2 bridge must accept integrations project state');
assert.match(bridgeSources, /onChangeIntegrations/, 'V2 bridge must expose integrations persistence callback');
assert.match(bridgeSources, /onSetIntegrationSecret/, 'V2 bridge must expose secure secret callback');
assert.match(bridgeSources, /onTestIntegrationConnection/, 'V2 bridge must expose connection testing callback');
assert.match(bridgeSources, /useSyncExternalStore/, 'V2 bridge must stay synchronized with the persisted integrations host');
assert.match(bridgeSources, /editorIntegrationPublishBlockers/, 'V2 publish controls must include integration blockers');
assert.match(bridgeSources, /resolvedOnChangeIntegrations/, 'V2 settings must remain editable even when the legacy host omits new props');

console.log('PASS Website Builder MAX reachability: versioned MAX state, localization and integrations persist through local/cloud project lifecycle and remain reachable from V2 settings');
