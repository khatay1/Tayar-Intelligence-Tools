import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from '../src/modules/website-builder/services/trustedServerRuntime';
import { beginSocialMetaConnect, completeSocialMetaConnect, connectSocialTelegram, disconnectSocialConnection, socialConnectionStatus } from './social-connect';
import type { SocialActor, SocialMetaConfig } from './social-connect';
import { createSocialConnectPersistence } from './social-connect-store';

export interface SocialConnectEndpointContext {
  /** Explicit opt-in only after isolated migration/channel tests. Missing flag disables all actions. */
  enabled?: boolean;
  platform: Pick<SupabaseClient, 'auth' | 'rpc'>;
  origin: string;
  /** Same-origin fixed route which invokes this handler for authenticated POST actions. */
  endpointPath?: string;
  /** Fixed same-origin app page; GET OAuth callback sends only short-lived code/state to its same-origin opener. */
  returnUrl: string;
  meta?: SocialMetaConfig;
  fetcher?: typeof fetch;
  now?: () => number;
  /** Durable host-level limiter. Required when enabled; never replace with process-local counters. */
  rateLimit(actor: SocialActor, action: string): Promise<boolean>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statePattern = /^[a-f0-9]{64}$/;
const codePattern = /^[A-Za-z0-9_.-]{1,4096}$/;
const responseHeaders = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff' };
function json(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: { ...responseHeaders, 'content-type': 'application/json' } }); }
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value as Record<string, unknown>; }
function exact(value: Record<string, unknown>, allowed: string[]) { if (Object.keys(value).some(key => !allowed.includes(key))) throw Error(); }
function parseConfig(context: SocialConnectEndpointContext) {
  const origin = new URL(context.origin), destination = new URL(context.returnUrl);
  const path = context.endpointPath ?? '/api/social-connect';
  if (origin.protocol !== 'https:' || origin.origin !== context.origin || destination.origin !== origin.origin || destination.username || destination.password
    || destination.search || !/^\/api\/[a-z0-9/_-]+$/i.test(path) || path.endsWith('/')
    || (context.meta && (context.meta.origin !== context.origin || new URL(context.meta.callbackUrl).origin !== origin.origin
      || new URL(context.meta.callbackUrl).search || new URL(context.meta.callbackUrl).hash))) throw Error();
  return { origin: origin.origin, destination, path, callbackPath: context.meta ? new URL(context.meta.callbackUrl).pathname : null };
}
async function body(request: Request) {
  if (!request.body || Number(request.headers.get('content-length') ?? 0) > 16384) throw Error();
  const reader = request.body.getReader(); let text = '', size = 0; const decoder = new TextDecoder();
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 16384) { await reader.cancel(); throw Error(); } text += decoder.decode(part.value, { stream: true }); } }
  finally { reader.releaseLock(); }
  text += decoder.decode(); return row(JSON.parse(text));
}

/** Source-only composition using existing Tayar Auth, checked service-only SQL and Supabase Vault.
 * Mount behind same-origin HTTPS routing and the required durable ingress limiter. */
export function createSocialConnectEndpoint(context: SocialConnectEndpointContext): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (isUntrustedBrowserRuntime() || context.enabled !== true) return json(503, { error: 'Social Connect is disabled.' });
    let configured: ReturnType<typeof parseConfig>, url: URL;
    try { configured = parseConfig(context); url = new URL(request.url); if (url.origin !== configured.origin) throw Error(); }
    catch { return json(503, { error: 'Social Connect is not configured.' }); }
    // Normal provider navigation has no Tayar bearer token. No grant is consumed or exchanged here.
    // The existing signed-in SPA finishes through the protected POST callback action below.
    if (request.method === 'GET' && configured.callbackPath && url.pathname === configured.callbackPath) {
      const state = url.searchParams.get('state') ?? '', code = url.searchParams.get('code') ?? '';
      const invalid = url.searchParams.has('error') || url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1
        || !statePattern.test(state) || !codePattern.test(code);
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
      const message = invalid ? { type: 'tayar-social-connect', error: 'authorization_failed' } : { type: 'tayar-social-connect', state, code };
      const encode = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Tayar Connect</title><body><p>Return to Tayar to finish connecting your account.</p><script nonce="${nonce}">if(window.opener&&!window.opener.closed){try{window.opener.postMessage(${encode(message)},${encode(configured.origin)});window.close();}catch{}}</script></body></html>`;
      return new Response(html, { status: 200, headers: { ...responseHeaders, 'content-type': 'text/html; charset=utf-8',
        'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
        'cross-origin-opener-policy': 'same-origin-allow-popups' } });
    }
    if (url.pathname !== configured.path || request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
    if (request.headers.get('origin') !== configured.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json(403, { error: 'Same-origin request required.' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return json(415, { error: 'JSON request required.' });
    if (url.searchParams.getAll('action').length !== 1 || Array.from(url.searchParams.keys()).some(key => key !== 'action')) return json(400, { error: 'Invalid action.' });
    const action = url.searchParams.get('action')!;
    if (!['start', 'callback', 'telegram', 'disconnect', 'status'].includes(action)) return json(400, { error: 'Invalid action.' });
    const bearer = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!bearer || bearer.length > 16384) return json(401, { error: 'Sign in required.' });
    let userId: string;
    try {
      const identity = await context.platform.auth.getUser(bearer);
      if (identity.error || !identity.data.user || identity.data.user.is_anonymous || !uuid.test(identity.data.user.id)) throw Error();
      userId = identity.data.user.id;
    } catch { return json(401, { error: 'Sign in required.' }); }
    let input: Record<string, unknown>;
    try {
      input = await body(request);
      const keys = action === 'start' ? ['tenantId', 'channel', 'accountId', 'ownership', 'businessAccountId', 'pageId']
        : action === 'callback' ? ['tenantId', 'channel', 'state', 'code'] : action === 'telegram' ? ['tenantId', 'ownership', 'botToken'] : ['tenantId', 'connectionId'];
      exact(input, keys);
      if (typeof input.tenantId !== 'string' || !uuid.test(input.tenantId)) throw Error();
      if (action === 'start' || action === 'callback') { if (!['facebook', 'instagram', 'whatsapp'].includes(String(input.channel))) throw Error(); }
      if (action === 'start' || action === 'telegram') { if (input.ownership !== 'official' && input.ownership !== 'customer') throw Error(); }
      if ((action === 'disconnect' || action === 'status') && (typeof input.connectionId !== 'string' || !uuid.test(input.connectionId))) throw Error();
      if (action === 'callback' && (typeof input.state !== 'string' || !statePattern.test(input.state) || typeof input.code !== 'string' || !codePattern.test(input.code))) throw Error();
      if (action === 'start' && (typeof input.accountId !== 'string' || (input.pageId !== undefined && typeof input.pageId !== 'string') || (input.businessAccountId !== undefined && typeof input.businessAccountId !== 'string'))) throw Error();
      if (action === 'telegram' && typeof input.botToken !== 'string') throw Error();
    } catch { return json(400, { error: 'Invalid connection request.' }); }
    const actor: SocialActor = { tenantId: input.tenantId as string, userId };
    async function authorize(scope: SocialActor, expectedOwnership: 'official' | 'customer') {
      if (scope.tenantId !== actor.tenantId || scope.userId !== actor.userId) throw Error();
      const { data, error } = await context.platform.rpc('get_social_hub_actor_access', { p_scope_id: scope.tenantId, p_user_id: scope.userId });
      const access = row(data);
      if (error || access.canManage !== true || access.enabled !== true || access.ownership !== expectedOwnership) throw Error();
    }
    try {
      if (!await context.rateLimit(actor, action)) return json(429, { error: 'Try again later.' });
      const persistence = createSocialConnectPersistence(context.platform);
      const deps = { ...persistence, authorize, fetcher: context.fetcher, now: context.now };
      if (action === 'start') {
        if (!context.meta) return json(503, { error: 'Meta Connect is not configured.' });
        return json(200, await beginSocialMetaConnect({ actor, channel: input.channel as 'facebook' | 'instagram' | 'whatsapp', accountId: input.accountId as string,
          ownership: input.ownership as 'official' | 'customer', ...(input.pageId ? { pageId: input.pageId as string } : {}), ...(input.businessAccountId ? { businessAccountId: input.businessAccountId as string } : {}) }, context.meta, deps));
      }
      if (action === 'callback') {
        if (!context.meta) return json(503, { error: 'Meta Connect is not configured.' });
        const callbackUrl = new URL(context.meta.callbackUrl); callbackUrl.search = new URLSearchParams({ state: input.state as string, code: input.code as string }).toString();
        return json(200, { connection: await completeSocialMetaConnect({ actor, channel: input.channel as 'facebook' | 'instagram' | 'whatsapp', callbackRequestUrl: callbackUrl.toString() }, context.meta, deps) });
      }
      if (action === 'telegram') return json(200, { connection: await connectSocialTelegram({ actor, ownership: input.ownership as 'official' | 'customer', botToken: input.botToken as string }, deps) });
      if (action === 'disconnect') return json(200, { connection: await disconnectSocialConnection(actor, input.connectionId as string, deps) });
      return json(200, { connection: await socialConnectionStatus(actor, input.connectionId as string, deps) });
    } catch { return json(409, { error: 'Connection could not be completed. Verify access and start Connect again.' }); }
  };
}

/** Concrete Edge composition. No environment values are returned to browser responses.
 * A deployment may mount this factory now; it stays disabled until explicitly configured. */
export function createSocialConnectEdge(environment: Record<string, string | undefined>): (request: Request) => Promise<Response> {
  if (environment.SOCIAL_HUB_ENABLED !== 'true') return async () => json(503, { error: 'Social Connect is disabled.' });
  try {
    const supabaseUrl = new URL(environment.SUPABASE_URL ?? '');
    const serviceKey = environment.SUPABASE_SECRET_KEY ?? environment.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl.hostname) || supabaseUrl.username || supabaseUrl.password
      || supabaseUrl.pathname !== '/' || supabaseUrl.search || supabaseUrl.hash || !serviceKey) throw Error();
    const callbackUrl = environment.SOCIAL_META_CALLBACK_URL ?? environment.SOCIAL_CONNECT_CALLBACK_URL;
    const origin = environment.SOCIAL_HUB_ORIGIN ?? (callbackUrl ? new URL(callbackUrl).origin : '');
    const metaComplete = environment.SOCIAL_META_APP_ID && environment.SOCIAL_META_APP_SECRET && environment.SOCIAL_META_GRAPH_VERSION && callbackUrl;
    const platform = createClient(supabaseUrl.origin, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    return createSocialConnectEndpoint({ enabled: true, platform, origin,
      returnUrl: environment.SOCIAL_CONNECT_RETURN_URL ?? `${origin}/#workspace/social-hub`,
      endpointPath: environment.SOCIAL_CONNECT_ENDPOINT_PATH ?? '/api/social-connect',
      ...(metaComplete ? { meta: { appId: environment.SOCIAL_META_APP_ID!, appSecret: environment.SOCIAL_META_APP_SECRET!,
        graphVersion: environment.SOCIAL_META_GRAPH_VERSION!, origin, callbackUrl: callbackUrl!, whatsappConfigId: environment.SOCIAL_META_WHATSAPP_CONFIG_ID } } : {}),
      async rateLimit(actor, action) {
        const { data, error } = await platform.rpc('consume_social_hub_connect_rate_limit', { p_scope_id: actor.tenantId, p_user_id: actor.userId, p_action: action });
        return !error && data === true;
      },
    });
  } catch { return async () => json(503, { error: 'Social Connect is not configured.' }); }
}
