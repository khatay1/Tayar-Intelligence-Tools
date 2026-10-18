import { verifyOwnedStripeAccount } from './website-owned-stripe';

export const ownedStripeWebhookApiVersion = '2026-08-26.dahlia';
export const ownedStripeWebhookEvents = Object.freeze([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed', 'refund.created', 'refund.updated', 'charge.refunded',
] as const);

/** Metadata evidence only. Retrieving an endpoint cannot recover or prove its
 * signing secret, nor prove delivery. No caller may treat this as activation. */
export interface OwnedStripeWebhookEndpointProof {
  status: 'endpoint-verified'; accountId: string; endpointId: string;
  environment: 'preview' | 'production'; url: string; apiVersion: string;
  events: string[];
}

async function readEndpoint(response: Response, isCurrent: () => boolean | Promise<boolean>) {
  const limit = 131072, declared = Number(response.headers.get('content-length') ?? 0);
  if (response.status !== 200 || !Number.isFinite(declared) || declared < 0 || declared > limit
    || (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== 'application/json'
    || !response.body || !await isCurrent()) throw new Error();
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (!await isCurrent()) throw new Error();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new Error();
      chunks.push(next.value);
    }
  } catch (error) { try { await reader.cancel(); } catch { /* preserve refusal */ } throw error; }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value) || !await isCurrent()) throw new Error();
  return value as Record<string, unknown>;
}

/** Read-only precondition for the future endpoint/secret custody handoff.
 * Scope must come from trusted saved project/connection state, never HTTP input.
 * Credentials go only to fixed Stripe API origins, never to the customer URL. */
export async function verifyOwnedStripeWebhookEndpoint(input: {
  projectId: string; secretKey: string; publishableKey: string;
  environment: 'preview' | 'production'; expectedAccountId: string;
  endpointId: string; applicationOrigin: string;
  isCurrent(): boolean | Promise<boolean>; fetcher?: typeof fetch;
}): Promise<OwnedStripeWebhookEndpointProof> {
  try {
    if (typeof window !== 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.projectId)
      || !/^acct_[A-Za-z0-9]{8,64}$/.test(input.expectedAccountId)
      || !/^we_[A-Za-z0-9]{8,128}$/.test(input.endpointId) || !await input.isCurrent()) throw new Error();
    const origin = new URL(input.applicationOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== input.applicationOrigin
      || origin.username || origin.password || origin.port || !origin.hostname.includes('.')
      || origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost')
      || /^\d+(?:\.\d+){3}$/.test(origin.hostname) || origin.hostname.includes(':')) throw new Error();
    const url = `${origin.origin}/api/stripe-webhook`;
    const account = await verifyOwnedStripeAccount(input);
    if (account.accountId !== input.expectedAccountId || !await input.isCurrent()) throw new Error();
    const response = await (input.fetcher ?? fetch)(`https://api.stripe.com/v1/webhook_endpoints/${input.endpointId}`, {
      method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${input.secretKey}`, Accept: 'application/json',
        'Stripe-Version': ownedStripeWebhookApiVersion },
    });
    const endpoint = await readEndpoint(response, input.isCurrent);
    const metadata = endpoint.metadata;
    if (endpoint.object !== 'webhook_endpoint' || endpoint.id !== input.endpointId || endpoint.url !== url
      || endpoint.status !== 'enabled' || endpoint.livemode !== (input.environment === 'production')
      || endpoint.application !== null || endpoint.api_version !== ownedStripeWebhookApiVersion
      || !metadata || typeof metadata !== 'object' || Array.isArray(metadata)
      || (metadata as Record<string, unknown>).tayar_project_id !== input.projectId
      || (metadata as Record<string, unknown>).tayar_environment !== input.environment
      || !Array.isArray(endpoint.enabled_events) || endpoint.enabled_events.length !== ownedStripeWebhookEvents.length
      || new Set(endpoint.enabled_events).size !== ownedStripeWebhookEvents.length
      || ownedStripeWebhookEvents.some(event => !(endpoint.enabled_events as unknown[]).includes(event))
      || !await input.isCurrent()) throw new Error();
    return { status: 'endpoint-verified', accountId: account.accountId, endpointId: input.endpointId,
      environment: input.environment, url, apiVersion: ownedStripeWebhookApiVersion, events: [...ownedStripeWebhookEvents] };
  } catch { throw new Error('Stripe webhook endpoint verification unavailable.'); }
}
