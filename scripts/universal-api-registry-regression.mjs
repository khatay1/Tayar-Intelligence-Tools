import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), 'tayar-api-registry-'));
try {
  async function load(name) {
    const outfile = join(dir, `${name}.cjs`);
    await build({ entryPoints: [`src/modules/website-builder/core/${name}.ts`], bundle: true, platform: 'node', format: 'cjs', outfile });
    return require(outfile);
  }
  const api = await load('universal-api-registry');
  const importer = await load('api-directory-review');
  const integrations = await load('editor-integrations');
  const catalog = api.getUniversalAPICapabilities();
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  for (const capability of catalog) {
    await access(capability.adapter.reference);
    if (capability.adapter.kind === 'internal') await access(capability.source);
    assert.equal(capability.reliability, 'unmeasured');
    if (capability.providerId !== 'tayar') {
      assert.equal(capability.terms.status, 'review-required');
      assert.ok(integrations.getEditorIntegrationProvider(capability.providerId), 'reuse registered providers only');
    }
  }
  const config = { version: 1, connections: [{ id: 'resend-preview', providerId: 'resend', enabled: true, status: 'configured', environments: ['preview'], name: 'Company', config: { from: 'support@example.com' }, secrets: { apiKey: { ref: 'secret://do-not-leak' } }, events: [], createdAt: '', updatedAt: '' }] };
  const plans = api.planUniversalIntegrations([
    { id: 'native-booking', capabilityIds: ['stripe:checkout', 'booking'] },
    { id: 'email', capabilityIds: ['resend:transactional-email'] },
    { id: 'medical-records-api', capabilityIds: ['unknown-medical-records'] },
  ], config);
  assert.equal(plans[0].status, 'reuse-internal');
  assert.equal(plans[0].capabilityId, 'booking');
  assert.equal(plans[1].status, 'prepare-existing-adapter');
  assert.deepEqual(plans[1].connectionIds, ['resend-preview']);
  assert.ok(plans[1].blockers.some(message => /not live evidence/.test(message)));
  assert.equal(plans[2].status, 'unsupported');
  assert.throws(() => api.planUniversalIntegrations(Array.from({ length: 101 }, (_, i) => ({ id: String(i), capabilityIds: ['booking'] })), config), /planning limit/);
  assert.ok(plans.every(plan => plan.activation === 'deferred'));
  assert.deepEqual(api.planUniversalIntegrations([{ id: 'email', capabilityIds: ['resend:transactional-email'] }], config, 'production')[0].connectionIds, []);
  const draft = api.prepareUniversalIntegrationDraft('resend:transactional-email', 'company-email', 'preview', { from: 'support@example.com' });
  assert.equal(draft.config.connections[0].enabled, false);
  assert.equal(draft.config.connections[0].status, 'disconnected');
  assert.equal(draft.activation, 'deferred');
  assert.equal(draft.providerTest, 'not-run');
  assert.ok(draft.issues.some(issue => issue.code === 'missing-secret'));
  assert.throws(() => api.prepareUniversalIntegrationDraft('resend:transactional-email', 'company-email', 'preview', { apiKey: 'never-store' }), /Store credentials separately/);
  assert.throws(() => api.prepareUniversalIntegrationDraft('unknown:code', 'company-email', 'preview'), /Unsupported/);
  const sourceSnapshot = JSON.stringify(config);
  const reused = api.prepareUniversalProjectIntegration(config, 'resend:transactional-email', 'ignored-draft', 'preview');
  assert.equal(reused.reused, true);
  assert.equal(reused.connectionId, 'resend-preview');
  assert.equal(reused.config.connections.length, 1);
  assert.equal(JSON.stringify(config), sourceSnapshot, 'preparing must not mutate project configuration');
  const prepared = api.prepareUniversalProjectIntegration({ version: 1, connections: [] }, 'resend:transactional-email', 'email-draft', 'preview');
  assert.equal(prepared.reused, false);
  assert.equal(prepared.config.connections[0].enabled, false);
  assert.equal(prepared.config.connections[0].status, 'disconnected');
  assert.equal(prepared.config.connections[0].environments[0], 'preview');
  assert.deepEqual(prepared.config.connections[0].secrets, {});
  assert.equal(prepared.providerTest, 'not-run');
  assert.throws(() => api.prepareUniversalProjectIntegration({ version: 1, connections: [{ ...config.connections[0], id: 'email-draft', providerId: 'stripe' }] }, 'resend:transactional-email', 'email-draft'), /already in use/);
  assert.throws(() => api.prepareUniversalProjectIntegration(config, 'booking', 'booking-draft'), /does not require/);
  const context = api.universalAPIGenerationContext(config);
  assert.ok(!JSON.stringify(context).includes('do-not-leak'));
  assert.ok(!JSON.stringify(context).includes('support@example.com'));
  assert.equal(context.connections[0].activation, 'deferred');
  const result = importer.reviewAPIMegaList(`## Developer Tools
| [GitHub](https://api.github.com/?utm_source=ads&fpr=person) | Listing |
| [Duplicate](https://api.github.com/) | Listing |
| [Local](https://127.0.0.1/secret) | Unsafe |
| [Credential](https://api.github.com/?api_key=secret) | Unsafe |
### Sponsored partners
| [Paid](https://ads.example.com/) | Listing |
## Maps
| [GitHub again](https://api.github.com/) | Listing |
| [Map](https://maps.example.com/api?version=1&ref=partner) | Listing |`);
  assert.deepEqual(result.stats, { unique: 2, duplicates: 2, sponsored: 1, rejected: 2, trackingRemoved: 3 });
  assert.deepEqual(result.candidates[0].categories, ['Developer Tools', 'Maps']);
  assert.ok(result.candidates.every(item => item.reviewStatus === 'quarantined' && !item.executable && !/[?&](ref|fpr|utm_)/.test(item.url)));
  assert.equal(result.approval, 'none');
  assert.equal(result.licensing, 'not-established');
  assert.throws(() => importer.reviewAPIMegaList('x'.repeat(8_000_001)), /limit/);
  const source = await readFile('src/modules/website-builder/core/editor-ai-generation-handler.ts', 'utf8');
  assert.ok(source.includes('integrationCapabilities, limits:'), 'the registry must reach actual generation');
  console.log('PASS Universal API capability view, internal-first planning, deferred external evidence and quarantined directory deduplication');
} finally { await rm(dir, { recursive: true, force: true }); }
