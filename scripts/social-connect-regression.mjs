import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'social-connect-'));
try {
  const outfile = join(dir, 'connect.cjs');
  await build({ entryPoints: ['server/social-connect.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const api = (await import(pathToFileURL(outfile))).default;
  const actor = { tenantId: '11111111-1111-4111-8111-111111111111', userId: '22222222-2222-4222-8222-222222222222' };
  const other = { ...actor, tenantId: '33333333-3333-4333-8333-333333333333' };
  const secretRef = '44444444-4444-4444-8444-444444444444';
  const now = Date.parse('2026-10-18T12:00:00Z');
  const config = { appId: '123456', appSecret: 'app-secret', graphVersion: 'v23.0', origin: 'https://tayar.example', callbackUrl: 'https://tayar.example/api/social/callback', whatsappConfigId: '54321' };
  const rawToken = 'never-return-this-token-to-the-browser';
  const states = new Map(), connections = new Map(), vault = new Map(), requests = [];
  let denied = false, denyAt = Infinity, failSave = false, badScope = false, badBot = false, badApp = false, badPage = false, big = false, providerFail = false, authorizationCalls = 0;
  const deps = {
    now: () => now,
    authorize: async (scope, ownership) => { authorizationCalls++; assert.deepEqual(scope, actor); if (denied || authorizationCalls >= denyAt || ownership === 'official') throw Error('denied'); },
    store: {
      async saveOAuthState(value) { assert.match(value.stateHash, /^[a-f0-9]{64}$/); states.set(value.stateHash, value); },
      async consumeOAuthState({ stateHash, tenantId, userId }) { const value = states.get(stateHash); if (!value || value.tenantId !== tenantId || value.userId !== userId) return null; states.delete(stateHash); return value; },
      async saveConnection(value, expectedVersion) { if (failSave) throw Error('database unavailable'); const current = connections.get(value.id); if (expectedVersion === null ? !!current : current?.version !== expectedVersion) throw Error('conflict'); if (Array.from(connections.values()).some(c => c.id !== value.id && c.channel === value.channel && c.accountId === value.accountId && c.status !== 'disconnected')) throw Error('duplicate channel account'); connections.set(value.id, value); },
      async getConnection({ id, tenantId }) { const value = connections.get(id); return value?.tenantId === tenantId ? value : null; },
    },
    vault: {
      async put(value) { vault.set(value.connectionId, value); return secretRef; },
      async revoke({ tenantId, connectionId, tokenRef }) { assert.equal(tokenRef, secretRef); assert.equal(vault.get(connectionId)?.tenantId, tenantId); vault.delete(connectionId); },
    },
    async fetcher(url, init) {
      requests.push({ url, init }); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.ok(init.signal);
      assert.match(new URL(url).hostname, /^(graph\.facebook\.com|api\.telegram\.org)$/);
      if (providerFail) throw Error(`provider failure ${rawToken}`);
      if (big) return new Response(' '.repeat(131073));
      const path = new URL(url).pathname;
      let value;
      if (path.endsWith('/oauth/access_token')) { assert.equal(init.method, 'POST'); assert.equal(new URLSearchParams(init.body).get('client_secret'), config.appSecret); value = { access_token: rawToken }; }
      else if (path.endsWith('/debug_token')) value = { data: { app_id: badApp ? '9999' : config.appId, is_valid: true, expires_at: now / 1000 + 3600, scopes: badScope ? [] : ['pages_show_list', 'pages_messaging', 'pages_manage_metadata', 'instagram_basic', 'instagram_manage_messages', 'whatsapp_business_management', 'whatsapp_business_messaging'] } };
      else if (path.endsWith('/me/accounts')) value = { data: [{ id: badPage ? '99999' : '101', access_token: 'page-' + rawToken, tasks: ['MESSAGING'], instagram_business_account: { id: '202' } }] };
      else if (path.endsWith('/303/phone_numbers')) value = { data: [{ id: '404' }] };
      else if (path.endsWith('/getMe')) value = { ok: true, result: { id: badBot ? 999999 : 123456, is_bot: true } };
      else assert.fail('Unexpected endpoint: ' + url);
      return Response.json(value);
    },
  };
  const begin = async (channel = 'facebook', extra = {}) => api.beginSocialMetaConnect({ actor, ownership: 'customer', channel, accountId: '101', ...extra }, config, deps);
  const callback = async (authorization, channel = 'facebook', session = actor) => {
    const state = new URL(authorization.authorizationUrl).searchParams.get('state');
    return api.completeSocialMetaConnect({ actor: session, channel, callbackRequestUrl: `${config.callbackUrl}?state=${state}&code=valid-code` }, config, deps);
  };
  const auth = await begin();
  const state = new URL(auth.authorizationUrl).searchParams.get('state');
  assert.match(state, /^[a-f0-9]{64}$/); assert.equal(states.has(state), false);
  assert.equal(JSON.stringify(auth).includes(rawToken), false);
  await assert.rejects(callback(auth, 'facebook', other));
  const connected = await callback(auth);
  assert.equal(connected.accountId, '101'); assert.equal(connected.webhookVerified, false); assert.equal(connected.permissionsVerified, true);
  assert.equal(Object.hasOwn(connected, 'tokenRef'), false); assert.equal(JSON.stringify(connected).includes(rawToken), false);
  assert.equal(vault.get(connected.id).accessToken, 'page-' + rawToken);
  await assert.rejects(callback(auth), /could not be verified/);
  await assert.rejects(callback(await begin(), 'instagram'), /could not be verified/);
  const expired = await begin(); for (const value of states.values()) value.expiresAt = new Date(now - 1).toISOString();
  await assert.rejects(callback(expired), /could not be verified/);
  const before = requests.length;
  await assert.rejects(api.beginSocialMetaConnect({ actor, ownership: 'customer', channel: 'facebook', accountId: 'http://evil' }, config, deps));
  await assert.rejects(api.beginSocialMetaConnect({ actor, ownership: 'customer', channel: 'facebook', accountId: '101' }, { ...config, callbackUrl: 'https://evil.example/api/callback' }, deps));
  assert.equal(requests.length, before);
  denied = true; await assert.rejects(begin()); denied = false;
  await assert.rejects(api.beginSocialMetaConnect({ actor, ownership: 'official', channel: 'facebook', accountId: '101' }, config, deps));
  badScope = true; await assert.rejects(callback(await begin())); badScope = false;
  badApp = true; await assert.rejects(callback(await begin())); badApp = false;
  badPage = true; await assert.rejects(callback(await begin())); badPage = false;
  big = true; await assert.rejects(callback(await begin())); big = false;
  providerFail = true; await assert.rejects(callback(await begin()), error => !error.message.includes(rawToken)); providerFail = false;
  await assert.rejects(api.socialConnectionStatus(other, connected.id, deps));
  connections.get(connected.id).expiresAt = new Date(now - 1).toISOString();
  const status = await api.socialConnectionStatus(actor, connected.id, deps); assert.equal(status.status, 'expired'); assert.equal(status.renewal, 'reconnect-required');
  const disconnected = await api.disconnectSocialConnection(actor, connected.id, deps);
  assert.equal(disconnected.status, 'disconnected'); assert.equal(vault.has(connected.id), false);
  const ig = await callback(await begin('instagram', { accountId: '202', pageId: '101' }), 'instagram'); assert.equal(ig.accountId, '202');
  const waAuth = await begin('whatsapp', { accountId: '404', businessAccountId: '303' });
  assert.equal(new URL(waAuth.authorizationUrl).searchParams.get('config_id'), '54321');
  const wa = await callback(waAuth, 'whatsapp'); assert.equal(wa.accountId, '404');
  const botToken = '123456:telegram-token-no-browser-secrets';
  badBot = true; await assert.rejects(api.connectSocialTelegram({ actor, ownership: 'customer', botToken }, deps)); badBot = false;
  const tg = await api.connectSocialTelegram({ actor, ownership: 'customer', botToken }, deps);
  assert.equal(tg.accountId, '123456'); assert.equal(tg.webhookVerified, false);
  const staleState = await begin(); denyAt = authorizationCalls + 3;
  await assert.rejects(callback(staleState)); denyAt = Infinity;
  assert.equal(vault.has(connected.id), false);
  const vaultSize = vault.size;
  failSave = true; await assert.rejects(callback(await begin())); failSave = false;
  assert.equal(vault.size, vaultSize, 'Failed persistence cleans up credential');
  await assert.rejects(api.connectSocialTelegram({ actor, ownership: 'customer', botToken }, deps));
  assert.equal(vault.size, vaultSize, 'Duplicate bot across connections cannot leak a second credential');
  const wrongCallback = await begin();
  await assert.rejects(api.completeSocialMetaConnect({ actor, channel: 'facebook', callbackRequestUrl: `https://evil.example/api/social/callback?state=${new URL(wrongCallback.authorizationUrl).searchParams.get('state')}&code=valid` }, config, deps));
  assert.ok(authorizationCalls > 20);
  const persistenceFile = join(dir, 'persistence.cjs');
  await build({ entryPoints: ['server/social-connect-store.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: persistenceFile });
  const persistenceApi = (await import(pathToFileURL(persistenceFile))).default;
  const rpcCalls = [];
  let rpcFailure = false, erasedCustody = false;
  const platform = { async rpc(name, args) {
    rpcCalls.push({ name, args });
    if (rpcFailure) throw Error(rawToken);
    if (name === 'social_hub_store_credential') return { data: secretRef, error: null };
    if (name === 'read_social_hub_credential') return { data: rawToken, error: null };
    if (name === 'get_social_hub_connection') return { data: { id: tg.id, scope_id: actor.tenantId, owner_user_id: actor.userId, ownership: 'customer', channel: 'telegram', external_account_id: tg.accountId, status: erasedCustody ? 'disconnected' : 'connected', permissions_verified: true, webhook_verified: false, secret_ref: erasedCustody ? null : secretRef, scopes: ['bot'], expires_at: null, version: 1 }, error: null };
    if (name === 'consume_social_hub_oauth_state') return { data: { state_hash: args.p_state_hash, scope_id: actor.tenantId, user_id: actor.userId, channel: 'facebook', expires_at: new Date(now + 60000).toISOString(), metadata: { accountId: '101', ownership: 'customer', callbackUrl: config.callbackUrl } }, error: null };
    return { data: null, error: null };
  } };
  const persistence = persistenceApi.createSocialConnectPersistence(platform);
  const dbState = { stateHash: 'a'.repeat(64), ...actor, channel: 'facebook', accountId: '101', ownership: 'customer', callbackUrl: config.callbackUrl, expiresAt: new Date(now + 60000).toISOString() };
  await persistence.store.saveOAuthState(dbState);
  assert.equal(JSON.stringify(rpcCalls.at(-1)).includes(rawToken), false);
  assert.equal((await persistence.store.consumeOAuthState({ ...actor, stateHash: dbState.stateHash })).accountId, '101');
  assert.equal((await persistence.store.getConnection({ id: tg.id, tenantId: actor.tenantId })).tokenRef, secretRef);
  await persistence.store.saveConnection(connections.get(tg.id), null);
  assert.equal(rpcCalls.at(-1).args.p_expected_version, null);
  assert.equal(await persistence.vault.put({ tenantId: actor.tenantId, connectionId: tg.id, accessToken: rawToken }), secretRef);
  await persistence.vault.revoke({ tenantId: actor.tenantId, connectionId: tg.id, tokenRef: secretRef });
  assert.equal(await persistenceApi.readSocialConnectionCredential(platform, { tenantId: actor.tenantId, connectionId: tg.id, tokenRef: secretRef }), rawToken);
  erasedCustody = true;
  const erased = await persistence.store.getConnection({ id: tg.id, tenantId: actor.tenantId });
  assert.equal(erased.status, 'disconnected'); assert.equal(erased.tokenRef, null);
  rpcFailure = true;
  await assert.rejects(persistence.store.getConnection({ id: tg.id, tenantId: actor.tenantId }), error => !error.message.includes(rawToken));
  console.log('PASS social Connect: Meta account/permissions, Telegram bot identity, hash-only expiring one-use tenant state, exact callback, vault cleanup, scoped disconnect, expiry, no browser credentials');
} finally { await rm(dir, { recursive: true, force: true }); }
