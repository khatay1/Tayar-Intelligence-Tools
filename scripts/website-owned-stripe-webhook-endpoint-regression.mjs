import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-webhook-endpoint-'));
try {
  const out = join(dir, 'endpoint.mjs');
  await build({ entryPoints: ['server/website-owned-stripe-webhook-endpoint.ts'], outfile: out,
    bundle: true, platform: 'node', format: 'esm' });
  const { verifyOwnedStripeWebhookEndpoint: verify, ownedStripeWebhookApiVersion: apiVersion,
    ownedStripeWebhookEvents: events } = await import(pathToFileURL(out));
  const secretKey = ['rk', 'live', 'fixtureonly123456789'].join('_');
  const projectId = '11111111-1111-4111-8111-111111111111';
  const input = { projectId, secretKey, publishableKey: 'pk_live_fixture123456789', environment: 'production',
    expectedAccountId: 'acct_customer1234', endpointId: 'we_customer1234', applicationOrigin: 'https://customer.example',
    isCurrent: () => true };
  const endpoint = { id: input.endpointId, object: 'webhook_endpoint', application: null,
    api_version: apiVersion, url: 'https://customer.example/api/stripe-webhook', livemode: true, status: 'enabled',
    enabled_events: [...events], metadata: { tayar_project_id: projectId, tayar_environment: 'production' },
    secret: 'whsec_never_return_this_fixture' };
  function fixture(options = {}) {
    const calls = []; let current = true;
    return { calls, input: { ...input, isCurrent: () => current, fetcher: async (url, init) => {
      calls.push(url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
      assert.equal(init.cache, 'no-store'); assert.equal(init.headers.Authorization, `Bearer ${secretKey}`);
      assert.equal(new URL(url).origin, 'https://api.stripe.com');
      assert.equal(init.headers['Stripe-Account'], undefined);
      if (url === 'https://api.stripe.com/v1/account') return Response.json({ object: 'account',
        id: options.accountId ?? input.expectedAccountId, charges_enabled: true });
      assert.equal(url, 'https://api.stripe.com/v1/webhook_endpoints/we_customer1234');
      assert.equal(init.headers['Stripe-Version'], apiVersion);
      if (options.stale) current = false;
      return options.response ? options.response() : Response.json({ ...endpoint, ...options.endpoint });
    } } };
  }
  const good = fixture(), proof = await verify(good.input);
  assert.equal(proof.status, 'endpoint-verified'); assert.equal(good.calls.length, 2);
  assert.deepEqual(proof.events, events);
  assert.doesNotMatch(JSON.stringify(proof), /whsec_|rk_live_|secret|ready/);
  const reordered = fixture({ endpoint: { enabled_events: [...events].reverse() } });
  assert.deepEqual(await verify(reordered.input), proof);
  for (const endpoint of [
    { id: 'we_foreign1234' }, { object: 'event_destination' }, { url: 'https://foreign.example/api/stripe-webhook' },
    { url: 'https://customer.example/api/stripe-webhook?extra=1' }, { status: 'disabled' }, { livemode: false },
    { application: 'ca_foreign1234' }, { api_version: null }, { api_version: '2020-08-27' },
    { metadata: { tayar_project_id: projectId, tayar_environment: 'preview' } },
    { metadata: { tayar_project_id: '22222222-2222-4222-8222-222222222222', tayar_environment: 'production' } },
    { enabled_events: ['*'] }, { enabled_events: events.slice(1) },
    { enabled_events: [...events.slice(1), events[1]] }, { enabled_events: [...events, 'customer.created'] },
  ]) await assert.rejects(verify(fixture({ endpoint }).input), /endpoint verification unavailable/);
  const foreign = fixture({ accountId: 'acct_foreign1234' });
  await assert.rejects(verify(foreign.input), /endpoint verification unavailable/);
  assert.equal(foreign.calls.length, 1, 'do not read endpoint after account mismatch');
  for (const options of [
    { stale: true }, { response: () => new Response('{}', { headers: { 'content-type': 'application/jsonbad' } }) }, { response: () => new Response(secretKey, { status: 403 }) },
    { response: () => new Response('not json', { headers: { 'content-type': 'application/json' } }) },
    { response: () => Response.json(endpoint, { headers: { 'content-length': '131073' } }) },
    { response: () => new Response('x'.repeat(131073), { headers: { 'content-type': 'application/json' } }) },
    { response: () => new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }) },
  ]) await assert.rejects(verify(fixture(options).input), error =>
    error.message === 'Stripe webhook endpoint verification unavailable.');
  for (const patch of [
    { endpointId: '../account' }, { applicationOrigin: 'http://customer.example' },
    { applicationOrigin: 'https://customer.example/' }, { applicationOrigin: 'https://user:pass@customer.example' },
    { applicationOrigin: 'https://127.0.0.1' }, { applicationOrigin: 'https://customer.example:8443' },
    { applicationOrigin: 'https://customer.example#fragment' }, { environment: 'preview' },
  ]) {
    const bad = fixture(); await assert.rejects(verify({ ...bad.input, ...patch }), /endpoint verification unavailable/);
    assert.equal(bad.calls.length, 0, 'invalid scope/mode denied before credentials leave');
  }
  const testKey = 'rk_test_fixtureonly123456789';
  const testProof = await verify({ ...input, secretKey: testKey, publishableKey: 'pk_test_fixture123456789',
    environment: 'preview', fetcher: async (url, init) => {
      assert.equal(init.headers.Authorization, `Bearer ${testKey}`);
      return Response.json(url.endsWith('/account') ? { object: 'account', id: input.expectedAccountId, charges_enabled: false }
        : { ...endpoint, livemode: false, metadata: { ...endpoint.metadata, tayar_environment: 'preview' } });
    } });
  assert.equal(testProof.environment, 'preview');
  let cancelled = false;
  const oversized = fixture({ response: () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(131073)); }, cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(verify(oversized.input), /endpoint verification unavailable/);
  assert.equal(cancelled, true, 'stop oversized streaming response');
  console.log('PASS owned webhook endpoint: account, mode, project, origin, exact events/version, stale scope and bounded read-only transport; no secret/delivery claim');
} finally { await rm(dir, { recursive: true, force: true }); }
