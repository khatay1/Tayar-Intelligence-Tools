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
  let disconnectCommitted = false, runtimeRows = [
    { id: 'env_anon123', key: 'SUPABASE_ANON_KEY', type: 'plain', target: ['production'],
      comment: 'Tayar production runtime 66666666-6666-4666-8666-666666666666' },
    { id: 'env_url123', key: 'SUPABASE_URL', type: 'plain', target: ['production'],
      comment: 'Tayar production runtime 66666666-6666-4666-8666-666666666666' },
    { id: 'env_customer123', key: 'CUSTOMER_VALUE', type: 'plain', target: ['production'] },
  ];
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
      if (name === 'website_reconcile_completed_vercel_runtime_disconnect') return { data: disconnectCommitted
        ? { connectionVersion: 2, receiptVersion: 4 } : null, error: null };
      if (name === 'website_byo_connection_for_worker') return { data: {
        id: handoffId, ownerId, projectId, provider: 'vercel', environment: 'production',
        accountId: grant.teamId, targetId: project.id, permissions: ['project:read'], status: 'connected',
        version: 1, operationId: null, verifiedAt: '2026-10-02T12:00:00.000Z', updatedAt: '2026-10-02T12:00:00.000Z',
      }, error: null };
      if (name === 'website_begin_vercel_runtime_disconnect') return { data: { cleanupRequired: true,
        receiptVersion: 3, accessToken: grant.accessToken, userId: grant.userId, accountId: grant.teamId,
        vercelProjectId: project.id, environment: 'production', gitBranch: null,
        marker: 'Tayar production runtime 66666666-6666-4666-8666-666666666666',
        environmentIds: { SUPABASE_ANON_KEY: 'env_anon123', SUPABASE_URL: 'env_url123' } }, error: null };
      if (name === 'website_reconcile_vercel_runtime_disconnect') return { data: null, error: null };
      if (name === 'website_commit_vercel_runtime_disconnect') { disconnectCommitted = true;
        return { data: { connectionVersion: 2, receiptVersion: 4 }, error: null }; }
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
    if (url.includes(`/v10/projects/${project.id}/env?decrypt=false`)) return Response.json({ envs: runtimeRows });
    if (url.includes(`/v9/projects/${project.id}/env/`) && init.method === 'DELETE') {
      const id = url.split('/').at(-1).split('?')[0]; runtimeRows = runtimeRows.filter(row => row.id !== id);
      return Response.json({});
    }
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
  const disconnectBody = { projectId, connectionId: handoffId, expectedVersion: 1,
    operationId: '77777777-7777-4777-8777-777777777777', commitId: '88888888-8888-4888-8888-888888888888' };
  const disconnected = await handle(post('disconnect', disconnectBody), context);
  assert.equal(disconnected.status, 200);
  assert.deepEqual(await disconnected.json(), { status: 'disconnected', connectionId: handoffId,
    version: 2, installation: 'retained' });
  assert.deepEqual(runtimeRows.map(row => row.id), ['env_customer123']);
  const providerCalls = calls.filter(item => item.name === 'website_begin_vercel_runtime_disconnect').length;
  const retried = await handle(post('disconnect', disconnectBody), context);
  assert.equal(retried.status, 200); assert.equal((await retried.json()).version, 2);
  assert.equal(calls.filter(item => item.name === 'website_begin_vercel_runtime_disconnect').length, providerCalls,
    'completed endpoint retry reconciles before provider access');
  const noOauth = { ...context, integrationSlug: '', clientId: '', clientSecret: '', returnUrl: 'invalid',
    platformAccountId: '' };
  assert.equal((await handle(post('disconnect', disconnectBody), noOauth)).status, 200,
    'disconnect remains available while OAuth installation settings are unavailable');
  assert.equal((await handle(post('disconnect', { ...disconnectBody, commitId: undefined }), context)).status, 400);
  assert.equal(targetReads, 2, 'disconnect never reloads GitHub binding metadata');
  const noGithub = { ...context, loadGithubTarget: async () => null };
  assert.equal((await handle(post('options', { projectId, handoffId }), noGithub)).status, 409);
  console.log('PASS Vercel endpoint: owner auth, opaque OAuth handoff, trusted binding, receipt-aware disconnect and provider-free committed retry (mocked HTTP/RPC)');
} finally { await rm(dir, { recursive: true, force: true }); }
