import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-vercel-endpoint-'));
try {
  const outfile = join(dir, 'endpoint.cjs');
  await build({ entryPoints: ['server/website-vercel-connection.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { handleWebsiteVercelConnection: handle } = createRequire(import.meta.url)(outfile);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const callback = 'https://platform.example/functions/v1/website-vercel-connection?action=callback';
  const returnUrl = 'https://tayar.example/builder';
  const grant = { accessToken: 'customer-vercel-access-token', userId: 'user_customer1234',
    teamId: 'team_customer1234', configurationId: 'icfg_customer1234' };
  const target = { repositoryId: '12345678', repositoryOwner: 'customer',
    repositoryName: 'booking-app', productionBranch: 'tayar/booking/production' };
  const project = { id: 'prj_booking1234', name: 'booking-production', accountId: grant.teamId,
    paused: false, link: { type: 'github', repoId: Number(target.repositoryId), org: target.repositoryOwner,
      repo: target.repositoryName, productionBranch: target.productionBranch } };
  let storedPayload = '', handoffId = '', committed = false;
  const calls = [];
  const platform = {
    auth: { getUser: async () => ({ data: { user: { id: ownerId, is_anonymous: false } }, error: null }) },
    from: () => ({ select: () => ({ eq() { return this; }, is() { return this; },
      maybeSingle: async () => ({ data: { id: projectId }, error: null }) }) }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'website_create_connection_oauth_state') return { error: null };
      if (name === 'website_consume_connection_oauth_state') return { data: {
        ownerId, projectId, environment: 'production', provider: 'vercel' }, error: null };
      if (name === 'website_store_connection_handoff') {
        storedPayload = args.p_token; handoffId = args.p_id; return { error: null };
      }
      if (name === 'website_peek_connection_handoff') return {
        data: { environment: 'production', userToken: storedPayload }, error: null };
      if (name === 'website_consume_connection_handoff') return {
        data: { environment: 'production', userToken: storedPayload }, error: null };
      if (name === 'website_reconcile_vercel_project_binding') return { data: committed ? 1 : null, error: null };
      if (name === 'website_bind_vercel_project') { committed = true; return { data: 1, error: null }; }
      throw Error(`Unexpected RPC ${name}`);
    },
  };
  const fetcher = async (url, init) => {
    if (url === 'https://api.vercel.com/v2/oauth/access_token') return Response.json({
      token_type: 'Bearer', access_token: grant.accessToken, user_id: grant.userId,
      team_id: grant.teamId, installation_id: grant.configurationId });
    assert.equal(init.headers.Authorization, `Bearer ${grant.accessToken}`);
    if (url.endsWith('/v2/user')) return Response.json({ user: { id: grant.userId } });
    if (url.endsWith(`/v2/teams/${grant.teamId}`)) return Response.json({ id: grant.teamId,
      membership: { uid: grant.userId, role: 'OWNER', confirmed: true } });
    if (url.includes('/v9/projects?')) return Response.json({ projects: [project,
      { ...project, id: 'prj_attacker123', link: { ...project.link, repoId: 9 } }] });
    if (url.includes(`/v9/projects/${project.id}`)) return Response.json(project);
    throw Error(`Unexpected URL ${url}`);
  };
  let targetReads = 0;
  const context = { platform, integrationSlug: 'tayar-connect', clientId: 'vercel-client-id',
    clientSecret: 'vercel-client-secret-value', callback, returnUrl,
    platformAccountId: 'team_tayar1234', fetcher, loadGithubTarget: async scope => {
      targetReads++; assert.deepEqual(scope, { ownerId, projectId }); return target;
    } };
  const post = (action, body, auth = true) => new Request(callback.replace('action=callback', `action=${action}`), {
    method: 'POST', headers: { 'content-type': 'application/json',
      ...(auth ? { authorization: 'Bearer header.payload.signature' } : {}) }, body: JSON.stringify(body) });
  assert.equal((await handle(post('begin', { projectId, environment: 'production' }, false), context)).status, 401);
  const begin = await handle(post('begin', { projectId, environment: 'production' }), context);
  assert.equal(begin.status, 200);
  const authorizationUrl = new URL((await begin.json()).authorizationUrl);
  assert.equal(authorizationUrl.origin, 'https://vercel.com');
  const rawState = authorizationUrl.searchParams.get('state');
  const returned = await handle(new Request(`${callback}&state=${rawState}&code=provider-code&teamId=${grant.teamId}&configurationId=${grant.configurationId}`), context);
  assert.equal(returned.status, 303);
  assert.match(new URL(returned.headers.get('location')).hash, /^#tayar_vercel_handoff=[0-9a-f-]{36}$/);
  assert.ok(!returned.headers.get('location').includes(grant.accessToken));
  assert.equal(JSON.parse(storedPayload).accessToken, grant.accessToken);
  const options = await handle(post('options', { projectId, handoffId }), context);
  assert.equal(options.status, 200);
  const choices = await options.json();
  assert.deepEqual(choices.projects.map(item => item.projectId), [project.id]);
  assert.ok(!JSON.stringify(choices).includes(grant.accessToken));
  const bound = await handle(post('bind', { projectId, handoffId, userId: grant.userId,
    accountId: grant.teamId, configurationId: grant.configurationId, vercelProjectId: project.id }), context);
  assert.equal(bound.status, 200); assert.equal((await bound.json()).status, 'connected');
  const write = calls.find(item => item.name === 'website_bind_vercel_project');
  assert.equal(write.args.p_access_token, grant.accessToken);
  assert.equal(write.args.p_repository_id, target.repositoryId);
  assert.equal(write.args.p_vercel_project_id, project.id);
  assert.equal(targetReads, 2);
  const noGithub = { ...context, loadGithubTarget: async () => null };
  assert.equal((await handle(post('options', { projectId, handoffId }), noGithub)).status, 409);
  console.log('PASS Vercel endpoint: owner auth, opaque OAuth handoff, trusted GitHub target and atomic connected binding (mocked HTTP/RPC)');
} finally { await rm(dir, { recursive: true, force: true }); }

