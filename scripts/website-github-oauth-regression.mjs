import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-oauth-'));
try {
  const outfile = join(dir, 'oauth.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubOAuthService.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const mod = (await import(pathToFileURL(outfile))).default;
  const { githubAuthorizationUrl, exchangeGitHubAppUserCode, refreshGitHubAppUserGrant,
    acceptGitHubOAuthCallback, decodeGitHubOAuthHandoff, githubGrantExpiries } = mod;
  const state = 'a'.repeat(64);
  const callback = 'https://tayar.example.com/auth/github/callback';
  const clientId = 'Iv1_fixture';
  const clientSecret = 'fixture-client-secret-value';
  const code = 'github-code';
  const now = Date.parse('2026-10-03T20:00:00Z');
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
    if (options.body.get('grant_type') === 'refresh_token') {
      assert.equal(options.body.get('refresh_token'), 'ghr_fixture_refresh_token_1234567890');
      return new Response(JSON.stringify({ token_type: 'bearer', access_token: 'ghu_rotated_access_token_1234567890',
        expires_in: 28800, refresh_token: 'ghr_rotated_refresh_token_1234567890',
        refresh_token_expires_in: 15897600 }), { status: 200 });
    }
    assert.equal(options.body.get('redirect_uri'), callback);
    return new Response(JSON.stringify({ token_type: 'bearer', access_token: 'ghu_fixture_access_token_1234567890',
      expires_in: 28800, refresh_token: 'ghr_fixture_refresh_token_1234567890',
      refresh_token_expires_in: 15897600 }), { status: 200 });
  };
  const exchange = { clientId, clientSecret, code, callback, fetcher, now: () => now };
  const grant = await exchangeGitHubAppUserCode(exchange);
  assert.equal(grant.accessToken, 'ghu_fixture_access_token_1234567890');
  assert.equal(grant.refreshToken, 'ghr_fixture_refresh_token_1234567890');
  assert.equal(grant.expiresIn, 28800);
  const expiries = githubGrantExpiries(grant);
  assert.equal(expiries.accessExpiresAt, '2026-10-04T04:00:00.000Z');
  assert.equal(Date.parse(expiries.refreshExpiresAt) - now, 15897600 * 1000);
  assert.equal(expiries.custodyExpiresAt, expiries.refreshExpiresAt);

  const rotated = await refreshGitHubAppUserGrant({ clientId, clientSecret,
    refreshToken: grant.refreshToken, fetcher, now: () => now + 60_000 });
  assert.equal(rotated.accessToken, 'ghu_rotated_access_token_1234567890');
  assert.equal(rotated.refreshToken, 'ghr_rotated_refresh_token_1234567890');

  const legacy = await exchangeGitHubAppUserCode({ ...exchange, fetcher: async () =>
    new Response(JSON.stringify({ token_type: 'bearer', access_token: 'github-user-token-fixture-12345' }), { status: 200 }) });
  assert.equal(legacy.refreshToken, null);
  assert.equal(githubGrantExpiries(legacy).accessExpiresAt, null);

  let consumed = false;
  const stateClient = { async rpc(name, args) {
    assert.equal(name, 'website_consume_connection_oauth_state');
    assert.match(args.p_state_hash, /^[0-9a-f]{64}$/);
    const data = consumed ? null : { ownerId: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222', provider: 'github', environment: 'production' };
    consumed = true;
    return { data, error: null };
  } };
  const accepted = await acceptGitHubOAuthCallback({ stateClient, state, ...exchange });
  assert.equal(accepted.ownerId, '11111111-1111-4111-8111-111111111111');
  assert.equal(accepted.projectId, '22222222-2222-4222-8222-222222222222');
  assert.equal(accepted.environment, 'production');
  assert.deepEqual(decodeGitHubOAuthHandoff(accepted.userToken), grant);
  assert.equal(exchanges, 3);
  await assert.rejects(acceptGitHubOAuthCallback({ stateClient, state, ...exchange }), /invalid or expired/);
  assert.equal(exchanges, 3, 'Replay cannot exchange another code');
  await assert.rejects(exchangeGitHubAppUserCode({ ...exchange, fetcher: async () => { throw new Error(clientSecret); } }),
    error => !error.message.includes(clientSecret));
  await assert.rejects(exchangeGitHubAppUserCode({ ...exchange, fetcher: async () =>
    new Response(JSON.stringify({ error: 'bad_verification_code' }), { status: 200 }) }), /authorization failed/);
  await assert.rejects(refreshGitHubAppUserGrant({ clientId, clientSecret, refreshToken: grant.refreshToken,
    fetcher: async () => new Response(JSON.stringify({ token_type: 'bearer',
      access_token: 'ghu_access_token_without_refresh_12345', expires_in: 28800 }), { status: 200 }) }), /authorization failed/);
  console.log('PASS GitHub OAuth: one-use scope, refreshable/legacy grants, safe rotation and sanitized errors');
} finally { await rm(dir, { recursive: true, force: true }); }
