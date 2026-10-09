import { bindOwnedStripeOrderSession, reserveOwnedStripeOrder, type OwnedStripeOrderRpcClient } from './website-owned-stripe-order-store';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const checkoutId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;
const stripeSecret = /^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/;
const sessionId = /^cs_(?:test|live)_[A-Za-z0-9]{8,200}$/;
const paymentId = /^pi_[A-Za-z0-9]{8,200}$/;
const refundId = /^re_[A-Za-z0-9]{8,200}$/;

export interface OwnedStripeOrderActionDependencies {
  projectId: string; applicationOrigin: string; secretKey: string; client: OwnedStripeOrderRpcClient;
  authenticate(accessToken: string): Promise<{ userId: string } | null>;
  loadOrder(input: { orderId: string; userId: string; checkoutId: string }): Promise<{ amount: number; currency: string; returnPath: string } | null>;
  authorizeRefund(input: { orderId: string; userId: string; amount?: number }): Promise<{ paymentIntentId: string; amount: number } | null>;
  fetcher?: typeof fetch;
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'cache-control': 'private, no-store',
    'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' } });
}
async function json(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > 4096) throw new Error();
  const raw = await request.text(); if (raw.length > 4096) throw new Error();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
function environment(secret: string) {
  const deployed = process.env.VERCEL_ENV, match = stripeSecret.exec(secret);
  if (!match || secret.length > 4096 || /[\r\n]/.test(secret) || !['production', 'preview'].includes(deployed ?? '')) throw new Error();
  const expected = deployed === 'production' ? '_live_' : '_test_'; if (!secret.includes(expected)) throw new Error();
  return deployed as 'production' | 'preview';
}
async function identity(request: Request, input: OwnedStripeOrderActionDependencies) {
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9._~-]{20,4096}$/.test(authorization)) return null;
  const found = await input.authenticate(authorization.slice(7));
  return found && uuid.test(found.userId) ? found : null;
}
function validate(input: OwnedStripeOrderActionDependencies, request: Request, pathname: string) {
  if (typeof window !== 'undefined' || !uuid.test(input.projectId) || new URL(input.applicationOrigin).origin !== input.applicationOrigin
    || request.method !== 'POST') return 405;
  const url = new URL(request.url);
  if (url.origin !== input.applicationOrigin || url.pathname !== pathname || url.search || request.headers.get('origin') !== input.applicationOrigin
    || request.headers.get('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin') return 403;
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return 415;
  return 0;
}
async function stripeJson(fetcher: typeof fetch, url: string, secret: string, body: URLSearchParams, idempotencyKey: string) {
  const response = await fetcher(url, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey }, body: body.toString() });
  if (response.status !== 200 || Number(response.headers.get('content-length') ?? 0) > 131072) throw new Error();
  const raw = await response.text(); if (raw.length > 131072) throw new Error();
  const value: unknown = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}

export async function serveOwnedStripeOrderCheckout(request: Request, input: OwnedStripeOrderActionDependencies) {
  try {
    const invalid = validate(input, request, '/api/stripe-order-checkout'); if (invalid) return reply(invalid, { error: 'request' });
    const env = environment(input.secretKey), user = await identity(request, input); if (!user) return reply(401, { error: 'identity' });
    const body = await json(request);
    if (Object.keys(body).sort().join(',') !== 'checkoutId,operationId,orderId' || typeof body.orderId !== 'string' || !uuid.test(body.orderId)
      || typeof body.operationId !== 'string' || !uuid.test(body.operationId) || typeof body.checkoutId !== 'string' || !checkoutId.test(body.checkoutId)) return reply(400, { error: 'input' });
    const order = await input.loadOrder({ orderId: body.orderId, userId: user.userId, checkoutId: body.checkoutId });
    if (!order || !Number.isSafeInteger(order.amount) || order.amount < 1 || order.amount > 99_999_999_999 || !/^[a-z]{3}$/.test(order.currency)
      || !/^\/(?:[\p{L}\p{N}._-]+\/)*[\p{L}\p{N}._-]+\.html$/u.test(order.returnPath)) return reply(403, { error: 'order' });
    const reserved = await reserveOwnedStripeOrder(input.client, { orderId: body.orderId, userId: user.userId, environment: env,
      currency: order.currency, amountDue: order.amount, operationId: body.operationId });
    if (reserved.status !== 'pending') return reply(409, { error: 'state' });
    const success = new URL(order.returnPath, input.applicationOrigin); success.searchParams.set('checkout', 'success');
    const cancel = new URL(order.returnPath, input.applicationOrigin); cancel.searchParams.set('checkout', 'cancel');
    const form = new URLSearchParams({ mode: 'payment', success_url: success.href, cancel_url: cancel.href, client_reference_id: input.projectId,
      'line_items[0][price_data][currency]': order.currency, 'line_items[0][price_data][unit_amount]': String(order.amount),
      'line_items[0][price_data][product_data][name]': `Order ${body.orderId}`, 'line_items[0][quantity]': '1',
      'metadata[tayar_project_id]': input.projectId, 'metadata[tayar_order_id]': body.orderId,
      'payment_intent_data[metadata][tayar_project_id]': input.projectId, 'payment_intent_data[metadata][tayar_order_id]': body.orderId });
    const value = await stripeJson(input.fetcher ?? fetch, 'https://api.stripe.com/v1/checkout/sessions', input.secretKey, form,
      `tayar-checkout:${input.projectId}:${body.orderId}:${body.operationId}`);
    if (value.object !== 'checkout.session' || typeof value.id !== 'string' || !sessionId.test(value.id) || typeof value.url !== 'string') throw new Error();
    const target = new URL(value.url); if (target.origin !== 'https://checkout.stripe.com' || target.username || target.password) throw new Error();
    await bindOwnedStripeOrderSession(input.client, { orderId: body.orderId, operationId: body.operationId, sessionId: value.id });
    return reply(200, { url: target.href });
  } catch { return reply(503, { error: 'unavailable' }); }
}

export async function serveOwnedStripeOrderRefund(request: Request, input: OwnedStripeOrderActionDependencies) {
  try {
    const invalid = validate(input, request, '/api/stripe-order-refund'); if (invalid) return reply(invalid, { error: 'request' });
    environment(input.secretKey); const user = await identity(request, input); if (!user) return reply(401, { error: 'identity' });
    const body = await json(request), keys = Object.keys(body).sort().join(',');
    if (!['operationId,orderId', 'amount,operationId,orderId'].includes(keys) || typeof body.orderId !== 'string' || !uuid.test(body.orderId)
      || typeof body.operationId !== 'string' || !uuid.test(body.operationId)
      || body.amount !== undefined && (!Number.isSafeInteger(body.amount) || (body.amount as number) < 1)) return reply(400, { error: 'input' });
    const authorized = await input.authorizeRefund({ orderId: body.orderId, userId: user.userId, ...(body.amount === undefined ? {} : { amount: body.amount as number }) });
    if (!authorized || !paymentId.test(authorized.paymentIntentId) || !Number.isSafeInteger(authorized.amount) || authorized.amount < 1
      || body.amount !== undefined && authorized.amount !== body.amount) return reply(403, { error: 'refund' });
    const form = new URLSearchParams({ payment_intent: authorized.paymentIntentId, amount: String(authorized.amount),
      'metadata[tayar_project_id]': input.projectId, 'metadata[tayar_order_id]': body.orderId });
    const value = await stripeJson(input.fetcher ?? fetch, 'https://api.stripe.com/v1/refunds', input.secretKey, form,
      `tayar-refund:${input.projectId}:${body.orderId}:${body.operationId}`);
    if (value.object !== 'refund' || typeof value.id !== 'string' || !refundId.test(value.id)
      || !['pending', 'succeeded'].includes(String(value.status))) throw new Error();
    return reply(202, { status: value.status });
  } catch { return reply(503, { error: 'unavailable' }); }
}
