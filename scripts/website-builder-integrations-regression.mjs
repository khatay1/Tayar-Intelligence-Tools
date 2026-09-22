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
    async resolveSecret(ref) { assert.equal(ref, 'secret://hook'); return 'sign-me'; },
    async sign(body, secret) { assert.equal(secret, 'sign-me'); assert.ok(body.includes('order-1')); return 'signature'; },
    async request(input) {
      requests += 1;
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
  console.log('PASS Integrations MAX registry, secrets, HTTPS validation, environment routing, signed delivery, idempotency and bounded retry runtime');
} finally {
  await rm(temp, { recursive: true, force: true });
}
