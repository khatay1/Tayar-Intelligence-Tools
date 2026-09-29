import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-choice-'));
try {
  const outfile = join(dir, 'vercel-choice.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteVercelProjectChoiceService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { encodeVercelOAuthHandoff, listWebsiteVercelProjectChoices, bindWebsiteVercelProject } =
    (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  const grant = { accessToken: 'customer-vercel-access-token', userId: 'user_customer1234',
    teamId: 'team_customer1234', configurationId: 'icfg_customer1234', receivedAt: new Date().toISOString() };
  const userToken = encodeVercelOAuthHandoff(grant);
  const client = { async rpc(name, args) {
    assert.equal(name, 'website_peek_connection_handoff');
    assert.deepEqual(args, { p_id: handoffId, p_owner_id: ownerId, p_project_id: projectId, p_provider: 'vercel' });
    return { data: { environment: 'production', userToken }, error: null };
  } };
  const expected = { repositoryId: '12345678', repositoryOwner: 'customer',
    repositoryName: 'booking-app', productionBranch: 'tayar/booking/production' };
  const valid = { id: 'prj_correct1234', name: 'booking-production', accountId: grant.teamId, paused: false,
    link: { type: 'github', repoId: 12345678, org: expected.repositoryOwner,
      repo: expected.repositoryName, productionBranch: expected.productionBranch } };
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push(url);
    assert.equal(init.headers.Authorization, `Bearer ${grant.accessToken}`);
    if (url.endsWith('/v2/user')) return Response.json({ user: { id: grant.userId } });
    if (url.endsWith(`/v2/teams/${grant.teamId}`)) return Response.json({ id: grant.teamId,
      membership: { uid: grant.userId, role: 'OWNER', confirmed: true } });
    assert.equal(url, `https://api.vercel.com/v9/projects?limit=100&teamId=${grant.teamId}`);
    return Response.json({ projects: [
      { ...valid, id: 'prj_wrongrepo12', link: { ...valid.link, repoId: 99 } },
      { ...valid, id: 'prj_platform12', accountId: 'team_tayar1234' }, valid,
      { ...valid, id: 'prj_paused1234', paused: true },
      { ...valid, id: 'prj_wrongbranch', link: { ...valid.link, productionBranch: 'main' } },
    ] });
  };
  const base = { client, ownerId, projectId, handoffId, platformAccountId: 'team_tayar1234',
    ...expected, isCurrentOwner: () => true, fetcher };
  const result = await listWebsiteVercelProjectChoices(base);
  assert.equal(result.userId, grant.userId);
  assert.equal(result.accountId, grant.teamId);
  assert.equal(result.configurationId, grant.configurationId);
  assert.deepEqual(result.projects, [{ projectId: valid.id, projectName: valid.name,
    accountId: grant.teamId, accountType: 'team', productionBranch: expected.productionBranch }]);
  assert.equal(calls.length, 3);
  await assert.rejects(listWebsiteVercelProjectChoices({ ...base,
    platformAccountId: grant.teamId }), /unavailable/);
  await assert.rejects(listWebsiteVercelProjectChoices({ ...base,
    isCurrentOwner: () => false }), /unavailable/);
  await assert.rejects(listWebsiteVercelProjectChoices({ ...base, fetcher: async url => {
    if (url.endsWith('/v2/user')) return Response.json({ user: { id: grant.userId } });
    return Response.json({ id: grant.teamId,
      membership: { uid: grant.userId, role: 'VIEWER', confirmed: true } });
  } }), /unavailable/);

  const bindCalls = [];
  const bindClient = { async rpc(name, args) {
    bindCalls.push({ name, args });
    if (name === 'website_reconcile_vercel_project_binding') return { data: null, error: null };
    if (name === 'website_consume_connection_handoff') return {
      data: { environment: 'production', userToken }, error: null };
    assert.equal(name, 'website_bind_vercel_project');
    assert.equal(args.p_access_token, grant.accessToken);
    assert.equal(args.p_account_id, grant.teamId);
    assert.equal(args.p_vercel_project_id, valid.id);
    assert.equal(args.p_repository_id, expected.repositoryId);
    assert.equal(Date.parse(args.p_custody_expires_at) > Date.now() + 89 * 86_400_000, true);
    return { data: 1, error: null };
  } };
  let projectReads = 0;
  const bindFetcher = async url => {
    if (url.endsWith('/v2/user')) return Response.json({ user: { id: grant.userId } });
    if (url.endsWith(`/v2/teams/${grant.teamId}`)) return Response.json({ id: grant.teamId,
      membership: { uid: grant.userId, role: 'OWNER', confirmed: true } });
    assert.equal(url, `https://api.vercel.com/v9/projects/${valid.id}?teamId=${grant.teamId}`);
    projectReads++; return Response.json(valid);
  };
  const binding = { ...base, client: bindClient, userId: grant.userId, accountId: grant.teamId,
    configurationId: grant.configurationId, vercelProjectId: valid.id, fetcher: bindFetcher };
  assert.deepEqual(await bindWebsiteVercelProject(binding), { connectionId: handoffId,
    accountId: grant.teamId, vercelProjectId: valid.id, version: 1 });
  assert.equal(projectReads, 2);
  assert.deepEqual(bindCalls.map(call => call.name), ['website_reconcile_vercel_project_binding',
    'website_consume_connection_handoff', 'website_bind_vercel_project']);
  let recoveryCalls = 0;
  assert.deepEqual(await bindWebsiteVercelProject({ ...binding, client: { async rpc(name, args) {
    recoveryCalls++; assert.equal(name, 'website_reconcile_vercel_project_binding');
    assert.equal(args.p_operation_id, handoffId); return { data: 1, error: null };
  } }, fetcher: async () => { throw new Error('recovery must not replay provider reads'); } }), {
    connectionId: handoffId, accountId: grant.teamId, vercelProjectId: valid.id, version: 1 });
  assert.equal(recoveryCalls, 1);
  await assert.rejects(bindWebsiteVercelProject({ ...binding, accountId: 'team_attacker1234' }), /could not be connected/);
  console.log('PASS Vercel chooser/binding: owner/team proof, exact GitHub target, leased Vault commit and lost-response reconciliation (mocked HTTP/RPC)');
} finally { await rm(dir, { recursive: true, force: true }); }
