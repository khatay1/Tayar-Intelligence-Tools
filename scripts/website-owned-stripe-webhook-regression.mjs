import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = await mkdtemp(join(tmpdir(), 'tayar-stripe-webhook-'));
const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secret = 'whsec_customer_fixture_1234567890', origin = 'https://orders.example.com', timestamp = 1_791_540_000;
try {
  const outfile = join(directory, 'webhook.mjs'), entry = join(directory, 'entry.ts');
  await writeFile(entry, `export * from ${JSON.stringify(resolve('server/website-owned-stripe-webhook.ts'))};\nexport * from ${JSON.stringify(resolve('server/website-owned-stripe-order-schema.ts'))};\nexport * from ${JSON.stringify(resolve('server/website-owned-stripe-order-store.ts'))};\nexport * from ${JSON.stringify(resolve('server/website-owned-stripe-order-actions.ts'))};`);
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile });
  const stripe = await import(pathToFileURL(outfile));
  const { normalizeOwnedStripeOrderEvent: normalize, serveOwnedStripeWebhook: serve, verifyOwnedStripeWebhook: verify,
    compileOwnedStripeOrderSchema: compileSchema, createOwnedStripeOrderEventStore: rpcStore,
    reserveOwnedStripeOrder: reserve, bindOwnedStripeOrderSession: bindSession,
    serveOwnedStripeOrderCheckout: checkout, serveOwnedStripeOrderRefund: requestRefund } = stripe;
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
  const sql = compileSchema(projectId);
  assert.match(sql, /enable row level security/); assert.match(sql, /from public,anon,authenticated,service_role/);
  assert.match(sql, /security invoker/); assert.match(sql, /set search_path=''/);
  assert.throws(() => compileSchema(orderId.slice(0, -1)));
  const rpcCalls = [], mockClient = { async rpc(name, args) { rpcCalls.push([name, structuredClone(args)]);
    if (name === 'app_stripe_order_reserve') return { data: { orderId, status: 'pending', sessionId: null }, error: null };
    if (name === 'app_stripe_order_bind_session') return { data: true, error: null };
    return { data: 'applied', error: null };
  } };
  assert.equal((await reserve(mockClient, { orderId, userId: projectId, environment: 'production', currency: 'sek', amountDue: 2500,
    operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).status, 'pending');
  await bindSession(mockClient, { orderId, operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sessionId: session.id });
  assert.equal(await rpcStore(mockClient).apply(normalize(event(), { projectId, livemode: true })), 'applied');
  assert.deepEqual(rpcCalls.map(call => call[0]), ['app_stripe_order_reserve', 'app_stripe_order_bind_session', 'app_stripe_order_apply_event']);
  const token = 'header.payload.signature.fixture', operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', actions = [], actionClient = { async rpc(name, args) {
    actions.push([name, structuredClone(args)]); return name === 'app_stripe_order_reserve'
      ? { data: { orderId, status: 'pending', sessionId: null }, error: null } : { data: true, error: null };
  } };
  const actionInput = { projectId, applicationOrigin: origin, secretKey: 'sk_live_fixture123456789', client: actionClient,
    async authenticate(value) { return value === token ? { userId: projectId } : null; },
    async loadOrder(value) { assert.deepEqual(value, { orderId, userId: projectId, checkoutId: 'buy' }); return { amount: 2500, currency: 'sek', returnPath: '/orders.html' }; },
    async authorizeRefund(value) { assert.equal(value.userId, projectId); return { paymentIntentId: session.payment_intent, amount: value.amount ?? 2500 }; },
    async fetcher(url, request) { const form = new URLSearchParams(request.body); actions.push([url, form, request.headers]);
      if (String(url).endsWith('/refunds')) return Response.json({ id: 're_fixture123456789', object: 'refund', status: 'pending' });
      assert.equal(form.get('metadata[tayar_order_id]'), orderId); assert.equal(form.get('payment_intent_data[metadata][tayar_project_id]'), projectId);
      assert.equal(form.get('line_items[0][price_data][unit_amount]'), '2500');
      return Response.json({ id: session.id, object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/fixture-order' });
    } };
  const oldActionEnvironment = process.env.VERCEL_ENV; process.env.VERCEL_ENV = 'production';
  try {
    const actionRequest = (path, body, auth = token) => new Request(`${origin}${path}`, { method: 'POST', body: JSON.stringify(body),
      headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', authorization: `Bearer ${auth}` } });
    let actionReply = await checkout(actionRequest('/api/stripe-order-checkout', { checkoutId: 'buy', operationId, orderId }), actionInput);
    assert.equal(actionReply.status, 200); assert.deepEqual(await actionReply.json(), { url: 'https://checkout.stripe.com/c/pay/fixture-order' });
    assert.match(actions.find(item => String(item[0]).includes('checkout/sessions'))[2]['Idempotency-Key'], new RegExp(operationId));
    actionReply = await requestRefund(actionRequest('/api/stripe-order-refund', { amount: 500, operationId, orderId }), actionInput);
    assert.equal(actionReply.status, 202); assert.deepEqual(await actionReply.json(), { status: 'pending' });
    assert.match(actions.find(item => String(item[0]).endsWith('/refunds'))[2]['Idempotency-Key'], new RegExp(operationId));
    assert.equal((await checkout(actionRequest('/api/stripe-order-checkout', { checkoutId: 'buy', operationId, orderId }, 'wrong-token-that-is-long-enough'), actionInput)).status, 401);
    assert.equal((await checkout(actionRequest('/api/stripe-order-checkout?amount=1', { checkoutId: 'buy', operationId, orderId }), actionInput)).status, 403);
    assert.equal((await checkout(actionRequest('/api/stripe-order-checkout', { checkoutId: 'buy', operationId, orderId, amount: 1 }), actionInput)).status, 400);
  } finally { if (oldActionEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = oldActionEnvironment; }

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.pathname !== '/tayar_booking_test') throw Error('Isolated fixture database required');
    const query = statement => new Promise((resolveQuery, reject) => {
      const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '', error = ''; child.stdout.on('data', value => output += value); child.stderr.on('data', value => error += value);
      child.on('error', reject); child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(statement);
    });
    await query(sql);
    const userId = '11111111-1111-4111-8111-111111111111', operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const literal = value => value === null ? 'null' : typeof value === 'boolean' || typeof value === 'number' ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
    const dbClient = { async rpc(name, args) { try {
      const result = await query(`set role service_role; select to_jsonb(public.${name}(${Object.entries(args).map(([key,value]) => `${key}=>${literal(value)}`).join(',')}));`);
      return { data: result ? JSON.parse(result) : null, error: null };
    } catch (error) { return { data: null, error }; } } };
    assert.equal((await reserve(dbClient, { orderId, userId, environment: 'production', currency: 'sek', amountDue: 2500, operationId })).status, 'pending');
    assert.equal((await reserve(dbClient, { orderId, userId, environment: 'production', currency: 'sek', amountDue: 2500, operationId })).status, 'pending');
    await assert.rejects(reserve(dbClient, { orderId, userId, environment: 'production', currency: 'sek', amountDue: 2600, operationId }));
    await bindSession(dbClient, { orderId, operationId, sessionId: session.id });
    await bindSession(dbClient, { orderId, operationId, sessionId: session.id });
    for (const role of ['anon','authenticated']) {
      await assert.rejects(query(`set role ${role}; select public.app_stripe_order_reserve('${orderId}','${userId}','production','sek',2500,'${operationId}');`), /permission denied/);
      await assert.rejects(query(`set role ${role}; select * from private.app_stripe_order_payments;`), /permission denied/);
    }
    await assert.rejects(query('set role service_role; select * from private.app_stripe_order_events;'), /permission denied/);
    const realStore = rpcStore(dbClient), paid = normalize(event(), { projectId, livemode: true });
    assert.equal(await realStore.apply(paid), 'applied'); assert.equal(await realStore.apply(paid), 'duplicate');
    assert.equal(await realStore.apply({ ...paid, amount: 2400 }), 'conflict');
    assert.equal(await query(`select status||':'||amount_paid from private.app_stripe_order_payments where order_id='${orderId}';`), 'paid:2500');
    const refundEvent = normalize(event('refund.updated', { ...refund, status: 'succeeded' }), { projectId, livemode: true });
    refundEvent.eventId = 'evt_refundfixture123456';
    assert.equal(await realStore.apply(refundEvent), 'applied');
    assert.equal(await query(`select status||':'||amount_refunded from private.app_stripe_order_payments where order_id='${orderId}';`), 'partially-refunded:500');
    const chargeEvent = normalize(event('charge.refunded', { ...charge, amount_refunded: 2500 }), { projectId, livemode: true });
    chargeEvent.eventId = 'evt_chargefixture123456';
    assert.equal(await realStore.apply(chargeEvent), 'applied');
    assert.equal(await query(`select status||':'||amount_refunded from private.app_stripe_order_payments where order_id='${orderId}';`), 'refunded:2500');
    assert.equal(await query(`select count(*) from private.app_stripe_order_events where order_id='${orderId}';`), '3');
    console.log('PASS PostgreSQL Stripe orders: private grants, verified reservation, immutable session, event replay/conflict and partial/full refunds');
  }
  console.log('PASS Stripe order webhook: raw-body signatures, replay/foreign isolation, paid/failed/refund normalization and server-only state input');
} finally { await rm(directory, { recursive: true, force: true }); }
