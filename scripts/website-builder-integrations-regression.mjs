import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-integrations-'));
try {
  const outfile = join(temp, 'integrations.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/editor-integrations.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const integrations = (await import(pathToFileURL(outfile))).default;
  assert.ok(integrations.EDITOR_INTEGRATION_PROVIDERS.some(provider => provider.id === 'stripe'));
  assert.ok(integrations.EDITOR_INTEGRATION_PROVIDERS.some(provider => provider.id === 'webhook'));
  const config = integrations.normalizeEditorIntegrationsConfig({ connections: [{ id: 'hook', providerId: 'webhook', name: 'Orders', enabled: true, status: 'active', environments: ['production'], config: { url: 'https://example.com/hook' }, secrets: { signingSecret: { ref: 'secret://hook' } }, events: ['commerce.paid'] }] });
  assert.deepEqual(integrations.validateEditorIntegrations(config), []);
  assert.equal(integrations.integrationsForEvent(config, 'commerce.paid', 'production').length, 1);
  assert.equal(integrations.integrationsForEvent(config, 'commerce.paid', 'preview').length, 0);
  const invalid = integrations.normalizeEditorIntegrationsConfig({ connections: [{ id: 'bad', providerId: 'webhook', name: 'Bad', enabled: true, environments: ['production'], config: { url: 'http://example.com' }, secrets: {}, events: ['page.viewed'] }] });
  const issues = integrations.validateEditorIntegrations(invalid);
  assert.ok(issues.some(issue => issue.code === 'invalid-url'));
  assert.ok(issues.some(issue => issue.code === 'missing-secret'));
  assert.ok(issues.some(issue => issue.code === 'unsupported-event'));
  console.log('PASS Integrations MAX registry, normalization, secret references, HTTPS validation, event routing and environment scoping');
} finally {
  await rm(temp, { recursive: true, force: true });
}
