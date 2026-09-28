import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-oauth-'));
try {
  const outfile = join(dir, 'oauth.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubOAuthService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { githubAuthorizationUrl, exchangeGitHubAppUserCode, acceptGitHubOAuthCallback } = (await import(pathToFileURL(outfile))).default;
  const state = 'a'.repeat(64);
  const callback = 'https://tayar.example.com/auth/github/callback';
  const clientId = 'Iv1_fixture';
  const clientSecret = 'fixture-client-secret';
  const code = 'github-code';
  const url = new URL(githubAuthorizationUrl({ state, callback, clientId }));
  assert.equal(url.origin, 'https://github.com');
  assert.equal(url.searchParams.get('state'), state);
  assert.equal(url.searchParams.get('redirect_uri'), callback);
  assert.throws(() => githubAuthorizationUrl({ state, clientId, callback: 'https://evil.example/path?return=secret' }), /not configured/);
  let exchanges = 0;
  const fetcher = async (target, options) => {
    exchanges++;
    assert.equal(target, 'https://github.com/login/oauth/access_token');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('client_secret'), clientSecret);
    assert.equal(options.body.get('redirect_uri'), callback);
    return { ok: true, headers: { get() { return null; } }, async text() { return JSON.stringify({ token_type: 'bearer', access_token: 'github-user-token-fixture-12345' }); } };
  };
  const exchange = { clientId, clientSecret, code, callback, fetcher };
  assert.equal(await exchangeGitHubAppUserCode(exchange), 'github-user-token-fixture-12345');
  let consumed = false;
  const stateClient = { async rpc(name, args) {
    assert.equal(name, 'website_consume_connection_oauth_state');
    assert.match(args.p_state_hash, /^[0-9a-f]{64}$/);
    const data = consumed ? null : { ownerId: '11111111-1111-4111-8111-111111111111', projectId: '22222222-2222-4222-8222-222222222222', provider: 'github', environment: 'production' };
    consumed = true;
    return { data, error: null };
  } };
  assert.deepEqual(await acceptGitHubOAuthCallback({ stateClient, state, ...exchange }), {
    ownerId: '11111111-1111-4111-8111-111111111111', projectId: '22222222-2222-4222-8222-222222222222', environment: 'production', userToken: 'github-user-token-fixture-12345',
  });
  assert.equal(exchanges, 2);
  await assert.rejects(acceptGitHubOAuthCallback({ stateClient, state, ...exchange }), /invalid or expired/);
  assert.equal(exchanges, 2, 'Replay cannot exchange another code');
  await assert.rejects(exchangeGitHubAppUserCode({ ...exchange, fetcher: async () => { throw new Error(clientSecret); } }), error => !error.message.includes(clientSecret));
  await assert.rejects(exchangeGitHubAppUserCode({ ...exchange, fetcher: async () => ({ ok: true, headers: { get() { return null; } }, async text() { return JSON.stringify({ error: 'bad_verification_code' }); } }) }), /authorization failed/);
  console.log('PASS GitHub OAuth: fixed callback, one-use scope before exchange, safe token/error handling');
} finally { await rm(dir, { recursive: true, force: true }); }
