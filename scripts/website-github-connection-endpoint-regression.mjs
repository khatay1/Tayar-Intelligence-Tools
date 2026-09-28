import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-github-endpoint-'));
try {
  const outfile = join(dir, 'endpoint.cjs');
  await build({ entryPoints: ['server/website-github-connection.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile, banner: { js: 'globalThis.Deno = { serve() {} };' },
    plugins: [{ name: 'supabase-test', setup(builder) {
      builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabase', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => { throw new Error("not called"); };', loader: 'js' }));
    } }],
  });
  const { handleWebsiteGitHubConnection: handle } = createRequire(import.meta.url)(outfile);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const callback = 'https://platform.example/functions/v1/website-github-connection?action=callback';
  const returnUrl = 'https://tayar.example/builder';
  const token = 'fixture-github-token-12345678901234567890';
  let writes = [];
  let authorized = true;
  const platform = {
    auth: { getUser: async () => ({ data: { user: { id: ownerId, is_anonymous: false } }, error: null }) },
    from: () => ({ select: () => ({ eq() { return this; }, is() { return this; },
      maybeSingle: async () => ({ data: authorized ? { id: projectId } : null, error: null }) }) }),
    rpc: async (name, args) => {
      writes.push({ name, args });
      if (name === 'website_create_connection_oauth_state') return { error: null };
      if (name === 'website_consume_connection_oauth_state') return { data: { ownerId, projectId, environment: 'production', provider: 'github' }, error: null };
      if (name === 'website_store_connection_handoff') return { error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://github.com/login/oauth/access_token');
    assert.equal(options.body.get('redirect_uri'), callback);
    return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ token_type: 'bearer', access_token: token }) };
  };
  const context = { platform, clientId: 'Iv1_clientid', clientSecret: 'fixture-secret', callback, returnUrl, fetcher };
  const request = (body, auth = true) => new Request(callback.replace('action=callback', 'action=begin'), { method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer header.payload.signature' } : {}) }, body: JSON.stringify(body) });
  assert.equal((await handle(request({ projectId, environment: 'production' }, false), context)).status, 401);
  assert.equal(writes.length, 0);
  authorized = false;
  assert.equal((await handle(request({ projectId, environment: 'production' }), context)).status, 404);
  authorized = true;
  const begin = await handle(request({ projectId, environment: 'production' }), context);
  assert.equal(begin.status, 200);
  const authorizationUrl = new URL((await begin.json()).authorizationUrl);
  assert.equal(authorizationUrl.origin, 'https://github.com');
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), callback);
  const rawState = authorizationUrl.searchParams.get('state');
  assert.match(rawState, /^[a-f0-9]{64}$/);
  assert.equal(writes[0].name, 'website_create_connection_oauth_state');
  assert.equal(writes[0].args.p_owner_id, ownerId);
  assert.notEqual(writes[0].args.p_state_hash, rawState);
  const returned = await handle(new Request(`${callback}&state=${rawState}&code=code123`), context);
  assert.equal(returned.status, 303);
  const destination = new URL(returned.headers.get('location'));
  assert.equal(destination.origin, new URL(returnUrl).origin);
  assert.match(destination.hash, /^#tayar_github_handoff=[0-9a-f-]{36}$/);
  assert.ok(!returned.headers.get('location').includes(token));
  const stored = writes.find(write => write.name === 'website_store_connection_handoff');
  assert.equal(stored.args.p_token, token);
  assert.equal(stored.args.p_owner_id, ownerId);
  assert.equal((await handle(new Request(`${callback}&state=wrong&code=code123`), context)).status, 400);
  assert.equal((await handle(request({ projectId, environment: 'production' }), { ...context, returnUrl: 'https://evil.example/path?next=1' })).status, 503);
  const beforeMisconfiguration = writes.length;
  assert.equal((await handle(request({ projectId, environment: 'production' }), { ...context, clientSecret: '' })).status, 503);
  assert.equal(writes.length, beforeMisconfiguration);
  console.log('PASS GitHub endpoint: owner auth, fixed callback, hashed state, opaque handoff and no token redirect');
} finally { await rm(dir, { recursive: true, force: true }); }
