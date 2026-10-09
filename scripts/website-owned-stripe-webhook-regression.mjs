import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'tayar-stripe-webhook-'));
const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secret = 'whsec_customer_fixture_1234567890', origin = 'https://orders.example.com', timestamp = 1_791_540_000;
try {
  const outfile = join(directory, 'webhook.mjs');
  await build({ entryPoints: [resolve('server/website-owned-stripe-webhook.ts')], bundle: true, platform: 'node', format: 'esm', outfile });
  const { normalizeOwnedStripeOrderEvent: normalize, serveOwnedStripeWebhook: serve, verifyOwnedStripeWebhook: verify } = await import(pathToFileURL(outfile));
  const session = { id: 'cs_live_fixture123456789', object: 'checkout.session', client_reference_id: projectId,
    payment_intent: 'pi_fixture123456789', payment_status: 'paid', amount_total: 2500, currency: 'sek',
    metadata: { tayar_project_id: projectId, tayar_order_id: orderId } };
  const event = (type = 'checkout.session.completed', stripeObject = session, extra = {}) => ({ id: 'evt_fixture123456789', object: 'event',
    type, livemode: true, created: timestamp, data: { object: stripeObject }, ...extra });
  const raw = JSON.stringify(event());
  const signature = body => `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  assert.deepEqual(await verify({ rawBody: raw, signature: signature(raw), secret, now: () => new Date(timestamp * 1000) }), event());
  for (const changed of [raw + ' ', raw.replace('2500', '2501')]) await assert.rejects(verify({ rawBody: changed, signature: signature(raw), secret, now: () => new Date(timestamp * 1000) }));
  await assert.rejects(verify({ rawBody: raw, signature: signature(raw), secret, now: () => new Date((timestamp + 301) * 1000) }));
  await assert.rejects(verify({ rawBody: raw, signature: `t=${timestamp},t=${timestamp},v1=${'0'.repeat(64)}`, secret, now: () => new Date(timestamp * 1000) }));

  assert.deepEqual(normalize(event(), { projectId, livemode: true }), { eventId: 'evt_fixture123456789', eventType: 'checkout.session.completed',
    eventCreatedAt: new Date(timestamp * 1000).toISOString(), projectId, orderId, livemode: true, providerObjectId: session.id,
    providerPaymentId: session.payment_intent, amount: 2500, currency: 'sek', status: 'paid' });
  assert.equal(normalize(event('customer.created'), { projectId, livemode: true }), null);
  assert.equal(normalize(event('checkout.session.async_payment_failed', { ...session, payment_status: 'unpaid' }), { projectId, livemode: true }).status, 'payment-failed');
  const refund = { id: 're_fixture123456789', object: 'refund', payment_intent: session.payment_intent, amount: 500, currency: 'sek', status: 'pending', metadata: session.metadata };
  assert.equal(normalize(event('refund.created', refund), { projectId, livemode: true }).status, 'refund-pending');
  assert.equal(normalize(event('refund.updated', { ...refund, status: 'succeeded' }), { projectId, livemode: true }).status, 'refunded');
  const charge = { id: 'ch_fixture123456789', object: 'charge', payment_intent: session.payment_intent, amount: 2500, amount_refunded: 500,
    currency: 'sek', refunded: true, metadata: session.metadata };
  assert.equal(normalize(event('charge.refunded', charge), { projectId, livemode: true }).status, 'partially-refunded');
  assert.equal(normalize(event('charge.refunded', { ...charge, amount_refunded: 2500 }), { projectId, livemode: true }).status, 'refunded');
  for (const invalid of [event('checkout.session.completed', { ...session, payment_status: 'unpaid' }),
    event('checkout.session.completed', { ...session, metadata: { ...session.metadata, tayar_order_id: 'foreign' } }),
    event('checkout.session.completed', { ...session, client_reference_id: orderId }), { ...event(), livemode: false },
    event('refund.updated', { ...refund, status: 'requires_action' })]) assert.throws(() => normalize(invalid, { projectId, livemode: true }));

  const applied = [], seen = new Set();
  const store = { async apply(value) { applied.push(structuredClone(value)); if (seen.has(value.eventId)) return 'duplicate'; seen.add(value.eventId); return 'applied'; } };
  const request = (body = raw, headers = {}) => new Request(`${origin}/api/stripe-webhook`, { method: 'POST', body,
    headers: { 'content-type': 'application/json', 'stripe-signature': signature(body), ...headers } });
  const oldEnvironment = process.env.VERCEL_ENV; process.env.VERCEL_ENV = 'production';
  try {
    let reply = await serve(request(), { projectId, applicationOrigin: origin, endpointSecret: secret, store, now: () => new Date(timestamp * 1000) });
    assert.equal(reply.status, 200); assert.deepEqual(await reply.json(), { status: 'applied' }); assert.equal(applied.length, 1);
    reply = await serve(request(), { projectId, applicationOrigin: origin, endpointSecret: secret, store, now: () => new Date(timestamp * 1000) });
    assert.deepEqual(await reply.json(), { status: 'duplicate' }); assert.equal(applied.length, 2);
    const ignoredRaw = JSON.stringify(event('customer.created'));
    reply = await serve(request(ignoredRaw), { projectId, applicationOrigin: origin, endpointSecret: secret, store, now: () => new Date(timestamp * 1000) });
    assert.deepEqual(await reply.json(), { status: 'ignored' }); assert.equal(applied.length, 2);
    assert.equal((await serve(new Request(`${origin}/api/stripe-webhook`), { projectId, applicationOrigin: origin, endpointSecret: secret, store })).status, 405);
    assert.equal((await serve(new Request(`${origin}/api/stripe-webhook?order=${orderId}`, { method: 'POST', body: raw,
      headers: { 'content-type': 'application/json', 'stripe-signature': signature(raw) } }), { projectId, applicationOrigin: origin, endpointSecret: secret, store })).status, 404);
    assert.equal((await serve(request(raw, { 'stripe-signature': `t=${timestamp},v1=${'0'.repeat(64)}` }), { projectId, applicationOrigin: origin, endpointSecret: secret, store, now: () => new Date(timestamp * 1000) })).status, 400);
    const conflictStore = { async apply() { return 'conflict'; } };
    assert.equal((await serve(request(), { projectId, applicationOrigin: origin, endpointSecret: secret, store: conflictStore, now: () => new Date(timestamp * 1000) })).status, 409);
    const unavailableStore = { async apply() { throw new Error(secret); } };
    reply = await serve(request(), { projectId, applicationOrigin: origin, endpointSecret: secret, store: unavailableStore, now: () => new Date(timestamp * 1000) });
    assert.equal(reply.status, 503); assert.ok(!(await reply.text()).includes(secret));
  } finally { if (oldEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldEnvironment; }
  assert.ok(!JSON.stringify(applied).includes(secret));
  console.log('PASS Stripe order webhook: raw-body signatures, replay/foreign isolation, paid/failed/refund normalization and server-only state input');
} finally { await rm(directory, { recursive: true, force: true }); }
