import { isUntrustedBrowserRuntime } from '../src/modules/website-builder/services/trustedServerRuntime';

export type SocialConnectChannel = 'whatsapp' | 'telegram' | 'facebook' | 'instagram';
type MetaChannel = Exclude<SocialConnectChannel, 'telegram'>;
export interface SocialActor { tenantId: string; userId: string }
export interface SocialOAuthState {
  stateHash: string; tenantId: string; userId: string; channel: MetaChannel;
  accountId: string; ownership: 'official' | 'customer'; callbackUrl: string;
  expiresAt: string; businessAccountId?: string; pageId?: string;
}
export interface SocialConnection {
  id: string; tenantId: string; ownerUserId: string; channel: SocialConnectChannel;
  accountId: string; ownership: 'official' | 'customer';
  status: 'connected' | 'disconnected' | 'expired'; permissionsVerified: boolean;
  webhookVerified: boolean; tokenRef: string | null; scopes: string[]; expiresAt: string | null; version: number;
}
export type SocialPublicConnection = Omit<SocialConnection, 'tokenRef'>;
/** Implement with durable atomic operations; never mount using an in-memory store. */
export interface SocialConnectStore {
  saveOAuthState(record: SocialOAuthState): Promise<void>;
  consumeOAuthState(scope: SocialActor & { stateHash: string }): Promise<SocialOAuthState | null>;
  getConnection(scope: { id: string; tenantId: string }): Promise<SocialConnection | null>;
  /** expectedVersion=null is insert-only, otherwise compare-and-swap. Throw on conflict.
   * Reject any duplicate active channel/account across scopes (including official).
   * Metadata and secret_ref must never be writable by browser database roles. */
  saveConnection(record: SocialConnection, expectedVersion: number | null): Promise<void>;
}
/** Vault references and reads are tenant+connection bound. No credentials in metadata or browser results. */
export interface SocialConnectVault {
  put(scope: { tenantId: string; connectionId: string; accessToken: string }): Promise<string>;
  /** Idempotent; retry after local disconnect if custody deletion was interrupted. */
  revoke(scope: { tenantId: string; connectionId: string; tokenRef: string }): Promise<void>;
}
export interface SocialConnectDependencies {
  store: SocialConnectStore; vault: SocialConnectVault;
  /** Fresh existing Tayar session and membership; official requires platform-admin permission.
   * Must throw on stale membership, disabled feature, anonymous session, or insufficient role. */
  authorize(actor: SocialActor, ownership: 'official' | 'customer'): Promise<void>;
  fetcher?: typeof fetch; now?: () => number;
}
export interface SocialMetaConfig { appId: string; appSecret: string; graphVersion: string; origin: string; callbackUrl: string; whatsappConfigId?: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numeric = /^[1-9][0-9]{0,39}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const scopes: Record<MetaChannel, string[]> = {
  facebook: ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'],
  instagram: ['pages_show_list', 'instagram_basic', 'instagram_manage_messages', 'pages_manage_metadata'],
  whatsapp: ['whatsapp_business_management', 'whatsapp_business_messaging'],
};
export class SocialConnectError extends Error { constructor() { super('Social connection could not be verified. Start Connect again.'); } }
function fail(): never { throw new SocialConnectError(); }
function server() { if (isUntrustedBrowserRuntime()) fail(); }
function actorValid(actor: SocialActor) { if (!uuid.test(actor.tenantId) || !uuid.test(actor.userId)) fail(); }
function tokenValid(value: unknown): value is string { return typeof value === 'string' && value.length >= 20 && value.length <= 8192 && ![...value].some(character => /\s/.test(character) || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127); }
function row(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(); return value as Record<string, unknown>; }
function publicConnection(connection: SocialConnection): SocialPublicConnection { const { tokenRef: _tokenRef, ...result } = connection; return result; }
async function digest(raw: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))), x => x.toString(16).padStart(2, '0')).join(''); }
function validateConfig(config: SocialMetaConfig) {
  const origin = new URL(config.origin), callback = new URL(config.callbackUrl);
  if (origin.protocol !== 'https:' || origin.origin !== config.origin || origin.username || origin.password
    || callback.origin !== origin.origin || callback.username || callback.password || callback.hash || callback.search
    || !callback.pathname.startsWith('/api/') || !numeric.test(config.appId) || !config.appSecret
    || !/^v\d{2}\.\d$/.test(config.graphVersion)) fail();
}
async function readJSON(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 131072 || !response.body) fail();
  const reader = response.body.getReader(); let bytes = 0; const parts: Uint8Array[] = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 131072) { await reader.cancel(); fail(); } parts.push(value); } }
  finally { reader.releaseLock(); }
  const combined = new Uint8Array(bytes); let position = 0; for (const part of parts) { combined.set(part, position); position += part.length; }
  try { return row(JSON.parse(new TextDecoder().decode(combined))); } catch { return fail(); }
}
async function requestJSON(url: string, init: RequestInit, deps: SocialConnectDependencies) {
  try { return await readJSON(await (deps.fetcher ?? fetch)(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) })); }
  catch { return fail(); }
}
function graphURL(config: SocialMetaConfig, path: string, query: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
function graphGet(config: SocialMetaConfig, path: string, accessToken: string, deps: SocialConnectDependencies, query: Record<string, string> = {}) {
  return requestJSON(graphURL(config, path, query), { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } }, deps);
}
async function verifiedToken(config: SocialMetaConfig, token: string, channel: MetaChannel, deps: SocialConnectDependencies) {
  const debug = row((await graphGet(config, 'debug_token', `${config.appId}|${config.appSecret}`, deps, { input_token: token })).data);
  const now = (deps.now ?? Date.now)();
  if (debug.is_valid !== true || debug.app_id !== config.appId || !Array.isArray(debug.scopes)
    || !scopes[channel].every(scope => (debug.scopes as unknown[]).includes(scope))
    || typeof debug.expires_at !== 'number' || !Number.isSafeInteger(debug.expires_at) || debug.expires_at < 0) fail();
  // Meta uses zero for non-expiring grants. Data access expiry still applies.
  const expiries = [debug.expires_at, debug.data_access_expires_at].filter(value => value !== undefined && value !== 0);
  if (expiries.some(value => typeof value !== 'number' || !Number.isSafeInteger(value) || value * 1000 <= now)) fail();
  return expiries.length ? new Date(Math.min(...expiries as number[]) * 1000).toISOString() : null;
}
async function findAccount(config: SocialMetaConfig, path: string, accessToken: string, accountId: string, fields: string, deps: SocialConnectDependencies) {
  let after: string | undefined;
  for (let page = 0; page < 10; page++) {
    const body = await graphGet(config, path, accessToken, deps, { fields, limit: '100', ...(after ? { after } : {}) });
    if (!Array.isArray(body.data)) fail();
    for (const value of body.data) { const item = row(value); if (item.id === accountId) return item; }
    if (!body.paging) return fail();
    const paging = row(body.paging); if (!paging.next) return fail();
    const cursor = row(paging.cursors).after;
    if (typeof cursor !== 'string' || cursor.length > 2048 || !/^[A-Za-z0-9_=-]+$/.test(cursor)) fail();
    after = cursor; // Never follow provider-supplied next URLs.
  }
  return fail();
}

async function beginSocialMetaConnectInternal(input: {
  actor: SocialActor; channel: MetaChannel; accountId: string; ownership: 'official' | 'customer';
  businessAccountId?: string; pageId?: string;
}, config: SocialMetaConfig, deps: SocialConnectDependencies): Promise<{ authorizationUrl: string }> {
  server(); actorValid(input.actor); validateConfig(config);
  if (!Object.prototype.hasOwnProperty.call(scopes, input.channel) || !numeric.test(input.accountId) || !['official', 'customer'].includes(input.ownership)
    || (input.channel === 'whatsapp' && (!numeric.test(input.businessAccountId ?? '') || !numeric.test(config.whatsappConfigId ?? '')))
    || (input.channel === 'instagram' && !numeric.test(input.pageId ?? ''))) fail();
  await deps.authorize(input.actor, input.ownership);
  const rawState = Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');
  const state: SocialOAuthState = { ...input.actor, channel: input.channel, accountId: input.accountId, ownership: input.ownership,
    callbackUrl: config.callbackUrl, stateHash: await digest(rawState), expiresAt: new Date((deps.now ?? Date.now)() + 9 * 60000).toISOString(),
    ...(input.channel === 'whatsapp' ? { businessAccountId: input.businessAccountId } : {}),
    ...(input.channel === 'instagram' ? { pageId: input.pageId } : {}) };
  await deps.store.saveOAuthState(state); await deps.authorize(input.actor, input.ownership);
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.search = new URLSearchParams({ client_id: config.appId, redirect_uri: config.callbackUrl, state: rawState, response_type: 'code',
    ...(input.channel === 'whatsapp' ? { config_id: config.whatsappConfigId!, override_default_response_type: 'true' }
      : { scope: scopes[input.channel].join(',') }) }).toString();
  return { authorizationUrl: url.toString() };
}

/** Callback actor comes from the existing signed-in Tayar session, never query parameters. */
async function completeSocialMetaConnectInternal(input: { actor: SocialActor; channel: MetaChannel; callbackRequestUrl: string }, config: SocialMetaConfig, deps: SocialConnectDependencies): Promise<SocialPublicConnection> {
  server(); actorValid(input.actor); validateConfig(config);
  const callback = new URL(input.callbackRequestUrl), fixed = new URL(config.callbackUrl);
  if (callback.origin !== fixed.origin || callback.pathname !== fixed.pathname || callback.hash || callback.username || callback.password
    || callback.searchParams.has('error') || callback.searchParams.getAll('state').length !== 1 || callback.searchParams.getAll('code').length !== 1) fail();
  const rawState = callback.searchParams.get('state') ?? '', code = callback.searchParams.get('code') ?? '';
  if (!hashPattern.test(rawState) || !/^[A-Za-z0-9_.-]{1,4096}$/.test(code)) fail();
  const state = await deps.store.consumeOAuthState({ ...input.actor, stateHash: await digest(rawState) });
  if (!state || state.tenantId !== input.actor.tenantId || state.userId !== input.actor.userId || state.channel !== input.channel
    || !['official', 'customer'].includes(state.ownership) || state.callbackUrl !== config.callbackUrl || !numeric.test(state.accountId) || !Number.isFinite(Date.parse(state.expiresAt))
    || Date.parse(state.expiresAt) <= (deps.now ?? Date.now)()) fail();
  await deps.authorize(input.actor, state.ownership);
  const exchange = await requestJSON(graphURL(config, 'oauth/access_token'), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.appId, client_secret: config.appSecret, redirect_uri: config.callbackUrl, code }) }, deps);
  if (!tokenValid(exchange.access_token)) fail();
  const accessToken = exchange.access_token, expiresAt = await verifiedToken(config, accessToken, state.channel, deps);
  let credential = accessToken;
  if (state.channel === 'whatsapp') {
    if (!numeric.test(state.businessAccountId ?? '')) fail();
    // Reading the selected WABA's phone-number edge with the scoped grant verifies access.
    await findAccount(config, `${state.businessAccountId}/phone_numbers`, accessToken, state.accountId, 'id,display_phone_number', deps);
  } else {
    const pageId = state.channel === 'facebook' ? state.accountId : state.pageId;
    if (!numeric.test(pageId ?? '')) fail();
    const page = await findAccount(config, 'me/accounts', accessToken, pageId!, 'id,access_token,tasks,instagram_business_account', deps);
    if (!Array.isArray(page.tasks) || !page.tasks.some(task => task === 'MANAGE' || task === 'MESSAGING') || !tokenValid(page.access_token)) fail();
    if (state.channel === 'instagram' && row(page.instagram_business_account).id !== state.accountId) fail();
    credential = page.access_token;
  }
  return saveGrant(input.actor, { channel: state.channel, accountId: state.accountId, ownership: state.ownership, scopes: scopes[state.channel], expiresAt }, credential, deps);
}

async function saveGrant(actor: SocialActor, grant: Pick<SocialConnection, 'channel' | 'accountId' | 'ownership' | 'scopes' | 'expiresAt'>, accessToken: string, deps: SocialConnectDependencies): Promise<SocialPublicConnection> {
  await deps.authorize(actor, grant.ownership);
  const id = crypto.randomUUID();
  const tokenRef = await deps.vault.put({ tenantId: actor.tenantId, connectionId: id, accessToken });
  if (!uuid.test(tokenRef)) fail();
  try {
    await deps.authorize(actor, grant.ownership);
    const connection: SocialConnection = { ...grant, id, tenantId: actor.tenantId, ownerUserId: actor.userId,
      status: 'connected', permissionsVerified: true, webhookVerified: false, tokenRef, version: 1 };
    await deps.store.saveConnection(connection, null); return publicConnection(connection);
  } catch {
    await deps.vault.revoke({ tenantId: actor.tenantId, connectionId: id, tokenRef }); return fail();
  }
}

/** Telegram has no user OAuth Connect for bots. Accept token only in a protected server POST body. */
async function connectSocialTelegramInternal(input: { actor: SocialActor; ownership: 'official' | 'customer'; botToken: string }, deps: SocialConnectDependencies): Promise<SocialPublicConnection> {
  server(); actorValid(input.actor);
  if (!['official', 'customer'].includes(input.ownership) || !/^[1-9][0-9]{3,19}:[A-Za-z0-9_-]{20,150}$/.test(input.botToken)) fail();
  await deps.authorize(input.actor, input.ownership);
  const body = await requestJSON(`https://api.telegram.org/bot${input.botToken}/getMe`, { method: 'POST', headers: { accept: 'application/json' } }, deps);
  const bot = row(body.result);
  if (body.ok !== true || bot.is_bot !== true || !Number.isSafeInteger(bot.id) || Number(bot.id) <= 0 || String(bot.id) !== input.botToken.split(':')[0]) fail();
  return saveGrant(input.actor, { channel: 'telegram', accountId: String(bot.id), ownership: input.ownership, scopes: ['bot'], expiresAt: null }, input.botToken, deps);
}

/** Local disconnect immediately disables use; it does not revoke unrelated Meta grants or Telegram bots. */
async function disconnectSocialConnectionInternal(actor: SocialActor, id: string, deps: SocialConnectDependencies): Promise<SocialPublicConnection> {
  server(); actorValid(actor); if (!uuid.test(id)) fail();
  const existing = await deps.store.getConnection({ id, tenantId: actor.tenantId });
  if (!existing || existing.tenantId !== actor.tenantId) fail();
  await deps.authorize(actor, existing.ownership);
  const disconnected: SocialConnection = { ...existing, ownerUserId: actor.userId, status: 'disconnected', permissionsVerified: false, webhookVerified: false, version: existing.version + 1 };
  await deps.store.saveConnection(disconnected, existing.version);
  if (existing.tokenRef) await deps.vault.revoke({ tenantId: actor.tenantId, connectionId: id, tokenRef: existing.tokenRef });
  return publicConnection(disconnected);
}

/** Meta and Telegram credentials use reauthorization/rotation, not a fabricated refresh-token flow. */
async function socialConnectionStatusInternal(actor: SocialActor, id: string, deps: SocialConnectDependencies): Promise<SocialPublicConnection & { renewal: 'reconnect-required' | 'not-required' }> {
  server(); actorValid(actor); if (!uuid.test(id)) fail();
  const connection = await deps.store.getConnection({ id, tenantId: actor.tenantId });
  if (!connection || connection.tenantId !== actor.tenantId) fail();
  await deps.authorize(actor, connection.ownership);
  const expired = connection.expiresAt !== null && (!Number.isFinite(Date.parse(connection.expiresAt)) || Date.parse(connection.expiresAt) <= (deps.now ?? Date.now)());
  const result = publicConnection(connection);
  if (expired && connection.status !== 'disconnected') { result.status = 'expired'; result.permissionsVerified = false; result.webhookVerified = false; }
  return { ...result, renewal: result.status === 'connected' ? 'not-required' : 'reconnect-required' };
}

// Adapters may throw messages containing request bodies or credentials. Never propagate them.
function safeConnect<Args extends unknown[], Result>(operation: (...args: Args) => Promise<Result>) {
  return async (...args: Args): Promise<Result> => { try { return await operation(...args); } catch { return fail(); } };
}
export const beginSocialMetaConnect = safeConnect(beginSocialMetaConnectInternal);
export const completeSocialMetaConnect = safeConnect(completeSocialMetaConnectInternal);
export const connectSocialTelegram = safeConnect(connectSocialTelegramInternal);
export const disconnectSocialConnection = safeConnect(disconnectSocialConnectionInternal);
export const socialConnectionStatus = safeConnect(socialConnectionStatusInternal);
