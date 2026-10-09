const eventId = /^evt_[A-Za-z0-9]{8,200}$/;
const objectId = /^(?:cs_(?:test|live)|pi|ch|re)_[A-Za-z0-9]{8,200}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const webhookSecret = /^whsec_[A-Za-z0-9+/=_-]{16,300}$/;
const currency = /^[a-z]{3}$/;

export type OwnedStripeOrderEventStatus = 'paid' | 'payment-failed' | 'refund-pending' | 'partially-refunded' | 'refunded' | 'refund-failed';
export interface OwnedStripeOrderEvent {
  eventId: string;
  eventType: string;
  eventCreatedAt: string;
  projectId: string;
  orderId: string;
  livemode: boolean;
  providerObjectId: string;
  providerPaymentId?: string;
  amount: number;
  currency: string;
  status: OwnedStripeOrderEventStatus;
}
export interface OwnedStripeOrderEventStore {
  /** Must atomically insert eventId and update only the matching project/order.
   * A repeated identical event returns duplicate; conflicting identity returns conflict. */
  apply(event: OwnedStripeOrderEvent): Promise<'applied' | 'duplicate' | 'conflict'>;
}

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Stripe event.');
  return value as JsonObject;
};
const text = (value: unknown, pattern: RegExp) => {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('Invalid Stripe event.');
  return value;
};
const amount = (value: unknown) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 99_999_999_999) throw new Error('Invalid Stripe amount.');
  return value as number;
};

async function readBounded(request: Request, limit: number): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > limit) throw new Error('Stripe event too large.');
  if (!request.body) return '';
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength; if (size > limit) throw new Error('Stripe event too large.'); chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function signatureParts(header: string) {
  if (header.length > 4096 || /[\r\n]/.test(header)) throw new Error('Invalid Stripe signature.');
  const timestamps: number[] = [], signatures: string[] = [];
  for (const item of header.split(',')) {
    const separator = item.indexOf('='); if (separator < 1) continue;
    const key = item.slice(0, separator).trim(), value = item.slice(separator + 1).trim();
    if (key === 't' && /^\d{1,12}$/.test(value)) timestamps.push(Number(value));
    if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (timestamps.length !== 1 || signatures.length < 1 || signatures.length > 8) throw new Error('Invalid Stripe signature.');
  return { timestamp: timestamps[0], signatures };
}

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false; let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyOwnedStripeWebhook(input: { rawBody: string; signature: string; secret: string; now?: () => Date }) {
  if (!webhookSecret.test(input.secret) || typeof input.rawBody !== 'string' || input.rawBody.length > 262_144) throw new Error('Stripe webhook unavailable.');
  const { timestamp, signatures } = signatureParts(input.signature);
  const now = Math.floor((input.now?.() ?? new Date()).getTime() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) throw new Error('Expired Stripe signature.');
  const expected = await sign(input.secret, `${timestamp}.${input.rawBody}`);
  if (!signatures.some(candidate => equalHex(expected, candidate))) throw new Error('Invalid Stripe signature.');
  return object(JSON.parse(input.rawBody));
}

const supported = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'refund.created', 'refund.updated', 'charge.refunded']);

export function normalizeOwnedStripeOrderEvent(value: JsonObject, expected: { projectId: string; livemode: boolean }): OwnedStripeOrderEvent | null {
  const id = text(value.id, eventId), type = typeof value.type === 'string' ? value.type : '';
  if (value.object !== 'event' || typeof value.livemode !== 'boolean' || value.livemode !== expected.livemode
    || !uuid.test(expected.projectId) || !Number.isSafeInteger(value.created) || (value.created as number) < 1_500_000_000
    || !object(value.data)) throw new Error('Invalid Stripe event.');
  if (!supported.has(type)) return null;
  const provider = object((value.data as JsonObject).object), metadata = object(provider.metadata);
  const projectId = text(metadata.tayar_project_id, uuid), orderId = text(metadata.tayar_order_id, uuid);
  if (projectId !== expected.projectId) throw new Error('Foreign Stripe event.');
  const providerObjectId = text(provider.id, objectId), created = new Date((value.created as number) * 1000).toISOString();
  let status: OwnedStripeOrderEventStatus, total = 0, money = '', providerPaymentId: string | undefined;
  if (type.startsWith('checkout.session.')) {
    if (provider.object !== 'checkout.session' || provider.client_reference_id !== projectId) throw new Error('Invalid checkout identity.');
    total = amount(provider.amount_total); money = text(provider.currency, currency);
    if (typeof provider.payment_intent === 'string') providerPaymentId = text(provider.payment_intent, /^pi_[A-Za-z0-9]{8,200}$/);
    if (type === 'checkout.session.async_payment_failed') status = 'payment-failed';
    else { if (provider.payment_status !== 'paid') throw new Error('Unpaid checkout event.'); status = 'paid'; }
  } else if (type.startsWith('refund.')) {
    if (provider.object !== 'refund') throw new Error('Invalid refund event.');
    total = amount(provider.amount); money = text(provider.currency, currency);
    providerPaymentId = text(provider.payment_intent, /^pi_[A-Za-z0-9]{8,200}$/);
    status = provider.status === 'succeeded' ? 'refunded' : provider.status === 'pending' ? 'refund-pending'
      : ['failed', 'canceled'].includes(String(provider.status)) ? 'refund-failed' : (() => { throw new Error('Invalid refund status.'); })();
  } else {
    if (provider.object !== 'charge' || provider.refunded !== true) throw new Error('Invalid refunded charge.');
    total = amount(provider.amount_refunded); money = text(provider.currency, currency);
    providerPaymentId = text(provider.payment_intent, /^pi_[A-Za-z0-9]{8,200}$/);
    status = total === amount(provider.amount) ? 'refunded' : 'partially-refunded';
  }
  return { eventId: id, eventType: type, eventCreatedAt: created, projectId, orderId, livemode: value.livemode,
    providerObjectId, ...(providerPaymentId ? { providerPaymentId } : {}), amount: total, currency: money, status };
}

function response(status: number, body: string) {
  return new Response(body, { status, headers: { 'cache-control': 'private, no-store', 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' } });
}

export async function serveOwnedStripeWebhook(request: Request, input: { projectId: string; applicationOrigin: string;
  endpointSecret: string; store: OwnedStripeOrderEventStore; now?: () => Date }): Promise<Response> {
  try {
    if (typeof window !== 'undefined' || request.method !== 'POST') return response(405, '{"error":"method"}');
    const url = new URL(request.url);
    if (url.origin !== input.applicationOrigin || url.pathname !== '/api/stripe-webhook' || url.search) return response(404, '{"error":"route"}');
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return response(415, '{"error":"media"}');
    const rawBody = await readBounded(request, 262_144);
    const verified = await verifyOwnedStripeWebhook({ rawBody, signature: request.headers.get('stripe-signature') ?? '', secret: input.endpointSecret, now: input.now });
    const environment = process.env.VERCEL_ENV;
    if (!['production', 'preview'].includes(environment ?? '')) throw new Error('Stripe environment unavailable.');
    const event = normalizeOwnedStripeOrderEvent(verified, { projectId: input.projectId, livemode: environment === 'production' });
    if (!event) return response(200, '{"status":"ignored"}');
    let result: Awaited<ReturnType<OwnedStripeOrderEventStore['apply']>>;
    try { result = await input.store.apply(structuredClone(event)); }
    catch { return response(503, '{"error":"retry"}'); }
    if (result === 'conflict') return response(409, '{"error":"identity"}');
    return response(200, `{"status":"${result}"}`);
  } catch { return response(400, '{"error":"invalid"}'); }
}
