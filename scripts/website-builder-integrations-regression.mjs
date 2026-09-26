import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-integrations-'));
try {
  async function load(name) {
    const outfile = join(temp, `${name}.cjs`);
    await build({ entryPoints: [`src/modules/website-builder/core/${name}.ts`], bundle: true, platform: 'node', format: 'cjs', outfile });
    return (await import(pathToFileURL(outfile))).default;
  }
  const integrations = await load('editor-integrations');
  const runtime = await load('editor-integration-runtime');
  const storage = await load('editor-integrations-storage');
  const projectHost = await load('editor-integrations-project-host');
  const legacyHost = await load('editor-integrations-host');
  const security = await load('editor-integration-security');
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

  const event = runtime.createEditorIntegrationEvent({ id: 'evt-1', projectId: 'project-1', event: 'commerce.paid', environment: 'production', occurredAt: '2026-09-22T10:00:00.000Z', payload: { orderId: 'order-1' } });
  let requests = 0;
  const waits = [];
  const deliveries = await runtime.dispatchEditorIntegrationEvent(config, event, {
    async resolveSecret(ref, scope) { assert.equal(ref, 'secret://hook'); assert.deepEqual(scope, { projectId: 'project-1', environment: 'production', connectionId: 'hook', field: 'signingSecret' }); return 'sign-me'; },
    async sign(body, secret) { assert.equal(secret, 'sign-me'); assert.ok(body.includes('order-1')); return 'signature'; },
    async request(input) {
      requests += 1;
      assert.equal(input.redirect, 'error');
      assert.equal(input.headers['X-Tayar-Event-Id'], 'evt-1');
      assert.equal(input.headers['X-Tayar-Signature'], 'signature');
      assert.equal(input.headers['Idempotency-Key'], 'tayar:evt-1:hook');
      return requests === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 };
    },
    async sleep(ms) { waits.push(ms); },
    now() { return new Date('2026-09-22T10:00:00.000Z'); },
  }, { baseDelayMs: 10, maxAttempts: 3 });
  assert.equal(requests, 2, 'retryable failures retry once before success');
  assert.deepEqual(waits, [10]);
  assert.equal(deliveries[0].status, 'delivered');
  assert.equal(deliveries[0].attempt, 2);

  const clientOnly = integrations.normalizeEditorIntegrationsConfig({ connections: [{ id: 'ga', providerId: 'google-analytics', name: 'GA', enabled: true, status: 'active', environments: ['production'], config: { measurementId: 'G-TEST' }, secrets: {}, events: ['page.viewed'] }] });
  const skipped = await runtime.dispatchEditorIntegrationEvent(clientOnly, { ...event, event: 'page.viewed' }, { async resolveSecret() {}, async request() { throw new Error('must not request'); } });
  assert.equal(skipped[0]?.status, 'skipped', 'provider-specific integrations require their server/client adapter');

  for (const adapter of [
    { async resolveSecret() {}, async sign() { return 'signature'; } },
    { async resolveSecret() { return 'private-test-value'; } },
    { async resolveSecret() { throw new Error('private-test-value'); }, async sign() { return 'signature'; } },
    { async resolveSecret() { return 'private-test-value'; }, async sign() { return ''; } },
  ]) {
    const result = await runtime.dispatchEditorIntegrationEvent(config, event, { ...adapter, async request() { assert.fail('Unsigned webhook must never be dispatched'); } });
    assert.equal(result[0].status, 'failed');
    assert.equal(result[0].attempt, 0);
    assert.ok(!JSON.stringify(result).includes('private-test-value'));
  }
  const networkFailure = await runtime.dispatchEditorIntegrationEvent(config, event, {
    async resolveSecret() { return 'private-test-value'; }, async sign() { return 'signature'; },
    async request() { throw new Error('Authorization: private-test-value'); },
  }, { maxAttempts: 1 });
  assert.ok(!JSON.stringify(networkFailure).includes('private-test-value'), 'Safe delivery logs omit adapter exception details');

  for (const url of ['http://example.com', 'https://127.0.0.1', 'https://2130706433', 'https://[::1]', 'https://a.internal', 'https://u:password@example.com', 'https://example.com/?api_key=private-test-value', 'https://example.com:8443']) {
    assert.equal(security.isPublicIntegrationEndpoint(url), false, url);
    const unsafe = structuredClone(config); unsafe.connections[0].config.url = url;
    const result = await runtime.dispatchEditorIntegrationEvent(unsafe, event, { async resolveSecret() { assert.fail('invalid URL must fail before secret lookup'); }, async request() { assert.fail('invalid URL must not request'); } });
    assert.equal(result[0].status, 'failed');
  }
  const noEnvironment = structuredClone(config); noEnvironment.connections[0].environments = [];
  assert.deepEqual(storage.deserializeEditorIntegrations(storage.serializeEditorIntegrations(noEnvironment)).connections[0].environments, [], 'Empty environment selection must never activate production');

  const malicious = structuredClone(config);
  malicious.connections[0].config.signingSecret = 'private-test-value';
  malicious.connections[0].config.authorization = 'private-test-value';
  malicious.connections[0].secrets.signingSecret.ref = 'private-test-value';
  assert.ok(!JSON.stringify(storage.serializeEditorIntegrations(malicious)).includes('private-test-value'));
  assert.ok(!JSON.stringify(storage.redactEditorIntegrationSecrets(malicious)).includes('private-test-value'));
  const stripe = { version: 1, connections: [{ ...config.connections[0], providerId: 'stripe', config: { publishableKey: 'sk_test_private-test-value', secretKey: 'private-test-value' } }] };
  assert.ok(!JSON.stringify(storage.serializeEditorIntegrations(stripe)).includes('private-test-value'));

  for (const persisted of [{ integrations: config }, { integrationsConfig: config }, { integrationsMax: storage.serializeEditorIntegrations(config) }, { maxState: { version: 1, integrations: config } }]) {
    assert.equal(projectHost.readEditorIntegrationsFromProject(persisted).connections[0].id, 'hook');
    assert.equal(legacyHost.readEditorIntegrationsFromProject(persisted).connections[0].id, 'hook');
  }
  const roundtrip = projectHost.writeEditorIntegrationsToProject({ pages: [{ id: 'existing-page' }], maxState: { version: 1, cms: { preserved: true } }, integrations: malicious }, config);
  assert.equal(roundtrip.maxState.cms.preserved, true);
  assert.equal(roundtrip.pages[0].id, 'existing-page');
  assert.equal(projectHost.readEditorIntegrationsFromProject(JSON.parse(JSON.stringify(roundtrip))).connections[0].id, 'hook');
  assert.ok(!JSON.stringify(roundtrip).includes('private-test-value'));
  assert.equal(projectHost.readEditorIntegrationsFromProject({ integrationsMax: config, maxState: { integrations: { version: 1, connections: [] } } }).connections.length, 0, 'Canonical empty configuration overrides stale legacy state');
  await assert.rejects(projectHost.setEditorIntegrationSecret(config, 'hook', 'unknownField', 'value', { async setSecret() { assert.fail('Unknown secret field must not reach storage'); } }));
  await assert.rejects(projectHost.setEditorIntegrationSecret(config, 'hook', 'signingSecret', 'value', { async setSecret() { return 'private-test-value'; } }), /valid reference/);
  console.log('PASS Integrations MAX registry, secrets, HTTPS validation, environment routing, signed delivery, idempotency and bounded retry runtime');
} finally {
  await rm(temp, { recursive: true, force: true });
}
