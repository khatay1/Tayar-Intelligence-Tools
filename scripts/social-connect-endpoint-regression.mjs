import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-social-connect-endpoint-'));
try {
  const outfile = join(dir, 'endpoint.cjs');
  await build({ entryPoints: ['server/social-connect-endpoint.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createSocialConnectEndpoint, createSocialConnectEdge } = (await import(pathToFileURL(outfile))).default;
  const userId = '11111111-1111-4111-8111-111111111111', tenantId = '22222222-2222-4222-8222-222222222222', secretRef = '33333333-3333-4333-8333-333333333333';
  const origin = 'https://tayar.example', endpoint = origin + '/api/social-connect';
  const now = Date.parse('2026-10-18T12:00:00Z'), token = 'not-for-the-browser-access-token';
  const states = new Map(), connections = new Map(), secrets = new Map();
  let authCalls = 0, networkCalls = 0, mayManage = true, scopeEnabled = true, limited = false, anonymous = false, rpcError = false;
  const platform = { auth: { async getUser(bearer) { authCalls++; assert.equal(bearer, 'session.token.signature'); return { data: { user: { id: userId, is_anonymous: anonymous } }, error: null }; } },
    async rpc(name, args) {
      if (rpcError) throw Error(token);
      if (name === 'get_social_hub_actor_access') return { data: { ownership: 'customer', canManage: mayManage && args.p_user_id === userId && args.p_scope_id === tenantId, enabled: scopeEnabled }, error: null };
      if (name === 'save_social_hub_oauth_state') { states.set(args.p_state_hash, { state_hash: args.p_state_hash, scope_id: args.p_scope_id, user_id: args.p_user_id, channel: args.p_channel, expires_at: args.p_expires_at, metadata: args.p_metadata }); return { data: null, error: null }; }
      if (name === 'consume_social_hub_oauth_state') { const state = states.get(args.p_state_hash); if (state?.scope_id !== args.p_scope_id || state?.user_id !== args.p_user_id) return { data: null, error: null }; states.delete(args.p_state_hash); return { data: state, error: null }; }
      if (name === 'social_hub_store_credential') { secrets.set(args.p_connection_id, args.p_access_token); return { data: secretRef, error: null }; }
      if (name === 'save_social_hub_connection') { const c = args.p_record; connections.set(c.id, { id: c.id, scope_id: c.tenantId, owner_user_id: c.ownerUserId, ownership: c.ownership, channel: c.channel, external_account_id: c.accountId, status: c.status, permissions_verified: c.permissionsVerified, webhook_verified: c.webhookVerified, secret_ref: c.tokenRef, scopes: c.scopes, expires_at: c.expiresAt, version: c.version }); return { data: null, error: null }; }
      if (name === 'get_social_hub_connection') { const c = connections.get(args.p_id); return { data: c?.scope_id === args.p_scope_id ? c : null, error: null }; }
      if (name === 'social_hub_revoke_credential') { secrets.delete(args.p_connection_id); const c = connections.get(args.p_connection_id); if (c) c.secret_ref = null; return { data: null, error: null }; }
      assert.fail('Unexpected RPC ' + name);
    } };
  const config = { enabled: true, platform, origin, returnUrl: origin + '/#workspace/social-hub', now: () => now,
    meta: { appId: '12345', appSecret: 'server-only-app-secret', graphVersion: 'v23.0', origin, callbackUrl: endpoint },
    async rateLimit(actor) { assert.equal(actor.userId, userId); return !limited; },
    async fetcher(url, init) { networkCalls++; assert.equal(init.redirect, 'error');
      if (url.endsWith('/oauth/access_token')) return Response.json({ access_token: token });
      if (new URL(url).pathname.endsWith('/debug_token')) return Response.json({ data: { app_id: '12345', is_valid: true, expires_at: now / 1000 + 3600, scopes: ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'] } });
      if (new URL(url).pathname.endsWith('/me/accounts')) return Response.json({ data: [{ id: '101', access_token: token, tasks: ['MESSAGING'] }] });
      if (url.endsWith('/getMe')) return Response.json({ ok: true, result: { id: 123456, is_bot: true } });
      assert.fail('Unexpected provider endpoint');
    },
  };
  const handler = createSocialConnectEndpoint(config);
  const post = (action, input, headers = {}) => handler(new Request(`${endpoint}?action=${action}`, { method: 'POST', headers: { origin, authorization: 'Bearer session.token.signature', 'content-type': 'application/json', ...headers }, body: JSON.stringify(input) }));
  const start = { tenantId, channel: 'facebook', accountId: '101', ownership: 'customer' };
  assert.equal((await createSocialConnectEdge({})(new Request(endpoint))).status, 503);
  assert.equal((await createSocialConnectEndpoint({ ...config, enabled: undefined })(new Request(endpoint))).status, 503);
  assert.equal(authCalls, 0);
  assert.equal((await post('start', start, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('start', start, { authorization: '' })).status, 401);
  assert.equal((await post('start', start, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post('start', { ...start, userId: 'attacker' })).status, 400);
  assert.equal((await post('start', { ...start, accountId: 'x'.repeat(17000) })).status, 400);
  anonymous = true; assert.equal((await post('start', start)).status, 401); anonymous = false;
  mayManage = false; assert.equal((await post('start', start)).status, 409); mayManage = true;
  scopeEnabled = false; assert.equal((await post('start', start)).status, 409); scopeEnabled = true;
  limited = true; assert.equal((await post('start', start)).status, 429); limited = false;
  assert.equal(networkCalls, 0);
  assert.equal((await post('start', { ...start, ownership: 'official' })).status, 409);
  const begun = await post('start', start); assert.equal(begun.status, 200);
  const authorizationUrl = new URL((await begun.json()).authorizationUrl), state = authorizationUrl.searchParams.get('state');
  const popup = await handler(new Request(`${endpoint}?code=provider-code&state=${state}`));
  assert.equal(popup.status, 200); assert.match(popup.headers.get('content-security-policy'), /script-src 'nonce-[a-f0-9]{32}'/);
  const html = await popup.text(); assert.ok(html.includes('postMessage')); assert.ok(html.includes('tayar-social-connect')); assert.ok(html.includes(JSON.stringify(origin))); assert.equal(html.includes(token), false);
  assert.equal(states.size, 1, 'Popup callback cannot consume or exchange state without existing authenticated session');
  assert.equal(networkCalls, 0);
  const completed = await post('callback', { tenantId, channel: 'facebook', state, code: 'provider-code' }); assert.equal(completed.status, 200);
  const responseText = await completed.text(); assert.equal(responseText.includes(token), false); assert.equal(responseText.includes('tokenRef'), false);
  const connection = JSON.parse(responseText).connection;
  assert.equal((await post('callback', { tenantId, channel: 'facebook', state, code: 'provider-code' })).status, 409);
  assert.equal((await post('status', { tenantId, connectionId: connection.id })).status, 200);
  assert.equal((await post('disconnect', { tenantId, connectionId: connection.id })).status, 200);
  const status = await (await post('status', { tenantId, connectionId: connection.id })).json(); assert.equal(status.connection.status, 'disconnected'); assert.equal(status.connection.renewal, 'reconnect-required');
  const telegram = await post('telegram', { tenantId, ownership: 'customer', botToken: '123456:telegram-token-no-browser-secrets' }); assert.equal(telegram.status, 200);
  assert.equal((await telegram.text()).includes('telegram-token'), false);
  const withoutMeta = createSocialConnectEndpoint({ ...config, meta: undefined });
  const tgOnly = await withoutMeta(new Request(`${endpoint}?action=telegram`, { method: 'POST', headers: { origin, authorization: 'Bearer session.token.signature', 'content-type': 'application/json' }, body: JSON.stringify({ tenantId, ownership: 'customer', botToken: '123456:telegram-token-no-browser-secrets' }) })); assert.equal(tgOnly.status, 200);
  const badPopup = await handler(new Request(`${endpoint}?state=invalid&code=bad`)); assert.ok((await badPopup.text()).includes('authorization_failed'));
  rpcError = true; const failed = await post('status', { tenantId, connectionId: connection.id }); assert.equal(failed.status, 409); assert.equal((await failed.text()).includes(token), false);
  console.log('PASS Social Connect transport: concrete Auth/RPC/Vault flow, default disabled, origin/CSRF, input bounds, permission/feature gates, popup handoff, replay rejection, secret-free results, Telegram without Meta');
} finally { await rm(dir, { recursive: true, force: true }); }
