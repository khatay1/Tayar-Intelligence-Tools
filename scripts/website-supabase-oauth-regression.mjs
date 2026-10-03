import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-supabase-oauth-'));
try {
  const outfile = join(dir, 'oauth.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteSupabaseOAuthService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { supabaseAuthorizationUrl, acceptSupabaseOAuthCallback } = (await import(pathToFileURL(outfile))).default;
  const state = 'a'.repeat(64), pkceSecret = 'server-only-pkce-secret-12345678901234567890';
  const callback = 'https://tayar.example.com/functions/v1/website-supabase-connection';
  const clientId = 'supabase-oauth-fixture', clientSecret = 'server-client-secret';
  const auth = { state, pkceSecret, callback, clientId };
  const url = new URL(await supabaseAuthorizationUrl(auth));
  assert.equal(url.origin, 'https://api.supabase.com');
  assert.equal(url.pathname, '/v1/oauth/authorize');
  assert.equal(url.searchParams.get('redirect_uri'), callback);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), state);
  assert.equal(url.searchParams.has('scope'), false);
  assert.equal(url.href.includes(pkceSecret), false);
  assert.equal(url.href.includes(clientSecret), false);
  await assert.rejects(supabaseAuthorizationUrl({ ...auth, callback: 'https://evil.example/callback?token=x' }), /not configured/);
  let consumed = false, exchanges = 0;
  const stateClient = { async rpc(name) {
    assert.equal(name, 'website_consume_connection_oauth_state');
    const data = consumed ? null : { ownerId: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222', provider: 'supabase', environment: 'preview' };
    consumed = true; return { data, error: null };
  } };
  const fetcher = async (target, init) => {
    exchanges++;
    assert.equal(target, 'https://api.supabase.com/v1/oauth/token');
    assert.equal(init.headers.Authorization, `Basic ${btoa(`${clientId}:${clientSecret}`)}`);
    assert.equal(init.body.get('redirect_uri'), callback);
    assert.equal(init.body.get('grant_type'), 'authorization_code');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(init.body.get('code_verifier')));
    const challenge = Buffer.from(digest).toString('base64url');
    assert.equal(challenge, url.searchParams.get('code_challenge'));
    return Response.json({ token_type: 'Bearer', access_token: 'customer-access-token-fixture',
      refresh_token: 'customer-refresh-token-fixture', expires_in: 3600 });
  };
  const callbackInput = { ...auth, stateClient, clientSecret, code: 'provider-code', fetcher };
  const tokens = await acceptSupabaseOAuthCallback(callbackInput);
  assert.equal(tokens.ownerId, '11111111-1111-4111-8111-111111111111');
  assert.equal(tokens.environment, 'preview');
  assert.equal(tokens.accessToken, 'customer-access-token-fixture');
  assert.equal(tokens.refreshToken, 'customer-refresh-token-fixture');
  const created = await acceptSupabaseOAuthCallback({ ...callbackInput, stateClient: {
    async rpc() { return { data: { ownerId: tokens.ownerId, projectId: tokens.projectId,
      provider: 'supabase', environment: 'preview' }, error: null }; },
  }, fetcher: async () => Response.json({ token_type: 'Bearer', access_token: 'customer-access-token-fixture',
    refresh_token: 'customer-refresh-token-fixture', expires_in: 3600 }, { status: 201 }) });
  assert.equal(created.accessToken, tokens.accessToken);
  await assert.rejects(acceptSupabaseOAuthCallback(callbackInput), /authorization failed/);
  assert.equal(exchanges, 1);
  await assert.rejects(acceptSupabaseOAuthCallback({ ...callbackInput, pkceSecret: 'short' }), /authorization failed/);
  assert.equal(exchanges, 1);
  const freshState = { async rpc() { return { data: { ownerId: tokens.ownerId,
    projectId: tokens.projectId, provider: 'supabase', environment: 'preview' }, error: null }; } };
  await assert.rejects(acceptSupabaseOAuthCallback({ ...callbackInput, stateClient: freshState,
    fetcher: async () => Response.json({ error: clientSecret }, { status: 403 }) }),
  error => !error.message.includes(clientSecret));
  await assert.rejects(acceptSupabaseOAuthCallback({ ...callbackInput, stateClient: freshState,
    fetcher: async () => Response.json({ token_type: 'Bearer', access_token: 'customer-access-token-fixture',
      expires_in: 3600 }) }), /authorization failed/);
  const largeAccess = 'a'.repeat(12_000), largeRefresh = 'b'.repeat(12_000);
  const large = await acceptSupabaseOAuthCallback({ ...callbackInput, stateClient: freshState,
    fetcher: async () => Response.json({ token_type: 'Bearer', access_token: largeAccess,
      refresh_token: largeRefresh, expires_in: 3600 }) });
  assert.equal(large.accessToken.length, 12_000);
  assert.equal(large.refreshToken.length, 12_000);
  await assert.rejects(acceptSupabaseOAuthCallback({ ...callbackInput, stateClient: freshState,
    fetcher: async () => Response.json({ token_type: 'Bearer', access_token: 'a'.repeat(16_385),
      refresh_token: 'customer-refresh-token-fixture', expires_in: 3600 }) }), /authorization failed/);
  await assert.rejects(acceptSupabaseOAuthCallback({ ...callbackInput, stateClient: freshState,
    fetcher: async () => Response.json({ token_type: 'Bearer', access_token: 'customer-access-token-fixture',
      refresh_token: 'customer-refresh-token-fixture', expires_in: 3600, padding: 'x'.repeat(70_000) }) }),
  /authorization failed/);
  console.log('PASS Supabase OAuth: fixed callback, stateless PKCE, one-use state, scoped token exchange and safe errors (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
