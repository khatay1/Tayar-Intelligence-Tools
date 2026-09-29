import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-supabase-endpoint-'));
try {
  const outfile = join(dir, 'endpoint.cjs');
  await build({ entryPoints: ['server/website-supabase-connection.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile, banner: { js: 'globalThis.Deno = { serve() {} };' },
    plugins: [{ name: 'supabase-test', setup(builder) {
      builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabase', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => { throw new Error("not called"); };', loader: 'js' }));
    } }],
  });
  const { handleWebsiteSupabaseConnection: handle } = createRequire(import.meta.url)(outfile);
  const ownerId = '11111111-1111-4111-8111-111111111111', projectId = '22222222-2222-4222-8222-222222222222';
  const callback = 'https://platform.example/functions/v1/website-supabase-connection?action=callback';
  const returnUrl = 'https://tayar.example/builder', accessToken = 'customer-access-token-fixture';
  const refreshToken = 'customer-refresh-token-fixture', handoffId = '33333333-3333-4333-8333-333333333333';
  let storedPayload = '', committed = false, writes = [];
  const platform = {
    auth: { getUser: async () => ({ data: { user: { id: ownerId, is_anonymous: false } }, error: null }) },
    from: () => ({ select: () => ({ eq() { return this; }, is() { return this; },
      maybeSingle: async () => ({ data: { id: projectId }, error: null }) }) }),
    rpc: async (name, args) => {
      writes.push({ name, args });
      if (name === 'website_create_connection_oauth_state') return { error: null };
      if (name === 'website_consume_connection_oauth_state') return { data: {
        ownerId, projectId, environment: 'production', provider: 'supabase' }, error: null };
      if (name === 'website_store_connection_handoff') { storedPayload = args.p_token; return { error: null }; }
      if (name === 'website_peek_connection_handoff') return { data: { environment: 'production', userToken: storedPayload }, error: null };
      if (name === 'website_consume_connection_handoff') return { data: { environment: 'production', userToken: storedPayload }, error: null };
      if (name === 'website_reconcile_supabase_project_binding') return { data: committed ? 1 : null, error: null };
      if (name === 'website_bind_supabase_project') { committed = true; return { data: 1, error: null }; }
      throw Error(`Unexpected RPC ${name}`);
    },
  };
  const organization = { id: 'customer-org', slug: 'customer', name: 'Customer' };
  const providerProject = { ref: 'abcdefghijklmnopqrst', name: 'Booking',
    organization_id: organization.id, organization_slug: organization.slug, status: 'ACTIVE_HEALTHY' };
  const fetcher = async (url, init) => {
    if (url === 'https://api.supabase.com/v1/oauth/token') return Response.json({
      token_type: 'Bearer', access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 });
    assert.equal(init.headers.Authorization, `Bearer ${accessToken}`);
    const path = url.replace('https://api.supabase.com/v1/', '');
    if (path === 'profile') return Response.json({ gotrue_id: 'user-1' });
    if (path === 'organizations') return Response.json([organization]);
    if (path === 'projects') return Response.json([providerProject]);
    if (path === 'organizations/customer/members') return Response.json([{ user_id: 'user-1', role_name: 'Owner' }]);
    if (path === `projects/${providerProject.ref}`) return Response.json(providerProject);
    throw Error(`Unexpected ${path}`);
  };
  const context = { platform, clientId: 'supabase-client', clientSecret: 'client-secret',
    pkceSecret: 'server-only-pkce-secret-12345678901234567890', callback, returnUrl,
    platformOrganizationId: 'tayar-org', fetcher };
  const post = (action, body, auth = true) => new Request(callback.replace('action=callback', `action=${action}`), {
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(auth ? { authorization: 'Bearer header.payload.signature' } : {}) }, body: JSON.stringify(body) });
  assert.equal((await handle(post('begin', { projectId, environment: 'production' }, false), context)).status, 401);
  const begin = await handle(post('begin', { projectId, environment: 'production' }), context);
  assert.equal(begin.status, 200);
  const authorizationUrl = new URL((await begin.json()).authorizationUrl);
  assert.equal(authorizationUrl.origin, 'https://api.supabase.com');
  const rawState = authorizationUrl.searchParams.get('state');
  assert.match(rawState, /^[a-f0-9]{64}$/);
  const returned = await handle(new Request(`${callback}&state=${rawState}&code=provider-code`), context);
  assert.equal(returned.status, 303);
  assert.match(new URL(returned.headers.get('location')).hash, /^#tayar_supabase_handoff=[0-9a-f-]{36}$/);
  assert.ok(!returned.headers.get('location').includes(accessToken));
  assert.equal(JSON.parse(storedPayload).refreshToken, refreshToken);
  const options = await handle(post('options', { projectId, handoffId }), context);
  assert.equal(options.status, 200);
  const choices = await options.json();
  assert.equal(choices.projects[0].projectRef, providerProject.ref);
  assert.ok(!JSON.stringify(choices).includes(accessToken));
  const bound = await handle(post('bind', { projectId, handoffId, projectRef: providerProject.ref,
    organizationId: organization.id, organizationSlug: organization.slug, accountUserId: 'user-1' }), context);
  assert.equal(bound.status, 200); assert.equal((await bound.json()).status, 'connected');
  const write = writes.find(item => item.name === 'website_bind_supabase_project');
  assert.equal(write.args.p_status, undefined);
  assert.equal(write.args.p_project_ref, providerProject.ref);
  assert.equal(write.args.p_refresh_token, refreshToken);
  assert.equal((await handle(post('bind', { projectId, handoffId, projectRef: providerProject.ref,
    organizationId: 'tayar-org', organizationSlug: 'tayar', accountUserId: 'user-1' }), context)).status, 409);
  console.log('PASS Supabase endpoint: owner auth, PKCE callback, opaque handoff, owned choices and atomic connected binding (mocked HTTP/RPC)');
} finally { await rm(dir, { recursive: true, force: true }); }
