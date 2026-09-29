import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-byo-readiness-'));
try {
  const outfile = join(dir, 'readiness.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-byo-readiness.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { analyzeByoPublishReadiness: analyze } = (await import(pathToFileURL(outfile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const app = { version: 1, tables: [], roles: [], auth: { enabled: false, signUpEnabled: false,
    emailVerificationRequired: true }, pageAccess: [] };
  const snapshot = { application: app, pages: [{ id: 'home', sections: [] }] };
  const connection = (provider, status = 'ready') => ({ id: crypto.randomUUID(), projectId, ownerId, provider,
    environment: 'production', accountId: '17', targetId: '88', permissions: ['contents:write'], status, version: 1,
    operationId: null, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const args = { snapshot, projectId, ownerId, environment: 'production', connections: [], runtimeSourceVerified: false };
  const initial = analyze(args);
  assert.equal(initial.ready, false);
  assert.deepEqual(initial.requirements.filter(item => item.required).map(item => item.provider), ['github', 'vercel']);
  assert(initial.blockers.some(item => item.includes('runtime source')));
  const connected = analyze({ ...args, connections: [connection('github', 'connected'), connection('vercel')] });
  assert.equal(connected.requirements[0].action, 'verify');
  assert.equal(connected.ready, false);
  const staticReady = analyze({ ...args, runtimeSourceVerified: true,
    connections: [connection('github'), connection('vercel')] });
  assert.equal(staticReady.ready, true, 'This reports connections and source only; deployment verification is a separate gate');
  const dynamic = { ...snapshot, application: { ...app, auth: { ...app.auth, enabled: true },
    pageAccess: [{ pageId: 'home', access: 'authenticated' }] } };
  const dynamicReport = analyze({ ...args, snapshot: dynamic, runtimeSourceVerified: true,
    connections: [connection('github'), connection('vercel')] });
  assert.equal(dynamicReport.needs.database, true);
  assert.equal(dynamicReport.needs.serverRuntime, true);
  assert.equal(dynamicReport.needs.protectedPages, true);
  assert.equal(dynamicReport.requirements.find(item => item.provider === 'supabase').action, 'connect');
  const stripe = { ...snapshot, integrationsMax: { version: 1, connections: [{ id: 'stripe1', providerId: 'stripe',
    name: 'Stripe', enabled: true, status: 'configured', environments: ['production'], config: {}, secrets: {},
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] } };
  const paymentReport = analyze({ ...args, snapshot: stripe });
  assert.equal(paymentReport.requirements.find(item => item.provider === 'stripe').required, true);
  assert(paymentReport.blockers.some(item => item.startsWith('Integration configuration:')));
  const wrong = analyze({ ...args, runtimeSourceVerified: true, connections: [
    { ...connection('github'), ownerId: crypto.randomUUID() }, connection('vercel') ] });
  assert.equal(wrong.requirements[0].status, 'unavailable');
  await assert.rejects(async () => analyze({ ...args, snapshot: { ...snapshot,
    pages: [snapshot.pages[0], snapshot.pages[0]] } }), /readiness is unavailable/);
  console.log('PASS BYO readiness: required providers, real ready vs connected, dynamic backend, Stripe and wrong owner');
} finally { await rm(dir, { recursive: true, force: true }); }
