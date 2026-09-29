import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-oauth-'));
try {
  const outfile = join(dir, 'vercel-oauth.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteVercelOAuthService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { vercelAuthorizationUrl, acceptVercelOAuthCallback } =
    (await import(pathToFileURL(outfile))).default;
  const state = 'a'.repeat(64), callback = 'https://tayar.example.com/functions/v1/website-vercel-connection?action=callback';
  const url = new URL(vercelAuthorizationUrl({ integrationSlug: 'tayar-connect', state }));
  assert.equal(url.origin, 'https://vercel.com');
  assert.equal(url.pathname, '/integrations/tayar-connect/new');
  assert.equal(url.searchParams.get('state'), state);
  await assert.rejects(async () => vercelAuthorizationUrl({ integrationSlug: '../admin', state }), /not configured/);

  let consumed = false, exchanges = 0;
  const stateClient = { async rpc(name) {
    assert.equal(name, 'website_consume_connection_oauth_state');
    const data = consumed ? null : { ownerId: '11111111-1111-4111-8111-111111111111',
      projectId: '22222222-2222-4222-8222-222222222222', provider: 'vercel', environment: 'production' };
    consumed = true; return { data, error: null };
  } };
  const input = { stateClient, state, code: 'provider-code', callbackTeamId: 'team_customer1234',
    callbackConfigurationId: 'icfg_customer1234', clientId: 'vercel-client-id',
    clientSecret: 'vercel-client-secret-value', callback };
  const fetcher = async (target, init) => {
    exchanges++;
    assert.equal(target, 'https://api.vercel.com/v2/oauth/access_token');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(init.body.get('client_id'), input.clientId);
    assert.equal(init.body.get('client_secret'), input.clientSecret);
    assert.equal(init.body.get('code'), input.code);
    assert.equal(init.body.get('redirect_uri'), callback);
    return Response.json({ token_type: 'Bearer', access_token: 'customer-vercel-access-token',
      user_id: 'user_customer1234', team_id: 'team_customer1234', installation_id: 'icfg_customer1234' });
  };
  const grant = await acceptVercelOAuthCallback({ ...input, fetcher });
  assert.equal(grant.ownerId, '11111111-1111-4111-8111-111111111111');
  assert.equal(grant.projectId, '22222222-2222-4222-8222-222222222222');
  assert.equal(grant.environment, 'production');
  assert.equal(grant.userId, 'user_customer1234');
  assert.equal(grant.teamId, 'team_customer1234');
  await assert.rejects(acceptVercelOAuthCallback({ ...input, fetcher }), /invalid or expired/);
  assert.equal(exchanges, 1);

  const fresh = () => ({ async rpc() { return { data: { ownerId: grant.ownerId,
    projectId: grant.projectId, provider: 'vercel', environment: 'production' }, error: null }; } });
  await assert.rejects(acceptVercelOAuthCallback({ ...input, stateClient: fresh(),
    callbackTeamId: 'team_attacker1234', fetcher }), /authorization failed/);
  await assert.rejects(acceptVercelOAuthCallback({ ...input, stateClient: fresh(),
    callbackConfigurationId: 'icfg_attacker1234', fetcher }), /authorization failed/);
  await assert.rejects(acceptVercelOAuthCallback({ ...input, stateClient: fresh(),
    fetcher: async () => Response.json({ error: input.clientSecret }, { status: 403 }) }),
  error => !error.message.includes(input.clientSecret));
  const personal = await acceptVercelOAuthCallback({ ...input, stateClient: fresh(), callbackTeamId: null,
    fetcher: async () => Response.json({ token_type: 'Bearer', access_token: 'personal-vercel-access-token',
      user_id: 'user_customer1234', team_id: null, installation_id: input.callbackConfigurationId }) });
  assert.equal(personal.teamId, null);
  console.log('PASS Vercel OAuth: external integration URL, one-use scope, fixed callback and account-bound exchange (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }

