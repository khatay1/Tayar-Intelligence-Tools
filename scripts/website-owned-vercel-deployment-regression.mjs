import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-deployment-'));
try {
  const outfile = join(dir, 'deployment.cjs');
  await build({ entryPoints: ['server/website-owned-vercel-deployment.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { inspectOwnedVercelDeployment: inspect } = (await import(pathToFileURL(outfile))).default;
  const input = { accessToken: 'customer-vercel-access-token', userId: 'user_customer1234',
    accountId: 'team_customer1234', platformAccountId: 'team_tayar1234',
    projectId: 'prj_booking1234', deploymentId: 'dpl_deployment1234', repositoryId: '12345678',
    repositoryOwner: 'customer', repositoryName: 'booking-app',
    productionBranch: 'tayar/booking/production', sourceCommitSha: 'a'.repeat(40),
    target: 'production', requiredEnvironment: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    isCurrent: async () => true };
  const project = { id: input.projectId, accountId: input.accountId, paused: false,
    link: { type: 'github', repoId: 12345678, org: input.repositoryOwner,
      repo: input.repositoryName, productionBranch: input.productionBranch } };
  const deployment = { id: input.deploymentId, projectId: input.projectId, ownerId: input.accountId,
    target: 'production', readyState: 'READY', url: 'booking-abc.vercel.app',
    meta: { githubCommitSha: input.sourceCommitSha, githubCommitRef: input.productionBranch } };
  function fixture(overrides = {}) {
    let deploymentReads = 0;
    return async (url, init) => {
      assert.equal(init.headers.Authorization, `Bearer ${input.accessToken}`);
      const path = url.replace('https://api.vercel.com', '');
      if (path === '/v2/user') return Response.json({ user: { id: input.userId } });
      if (path === `/v2/teams/${input.accountId}`) return Response.json({ id: input.accountId,
        membership: { uid: input.userId, role: 'OWNER', confirmed: true } });
      if (path.startsWith(`/v9/projects/${input.projectId}`)) return Response.json(overrides.project ?? project);
      if (path.startsWith(`/v10/projects/${input.projectId}/env`)) return Response.json({ envs: overrides.envs ?? [
        { key: 'SUPABASE_URL', target: ['production'], value: 'must-not-return' },
        { key: 'SUPABASE_ANON_KEY', target: ['production'], value: 'must-not-return' }] });
      assert.equal(path, `/v13/deployments/${input.deploymentId}?teamId=${input.accountId}`);
      deploymentReads++;
      return Response.json(deploymentReads === 2 ? overrides.second ?? overrides.deployment ?? deployment
        : overrides.deployment ?? deployment);
    };
  }
  const ready = await inspect({ ...input, fetcher: fixture() });
  assert.deepEqual(ready, { status: 'ready', deploymentId: input.deploymentId,
    missingEnvironment: [], liveUrl: 'https://booking-abc.vercel.app', observedState: 'READY' });
  assert.ok(!JSON.stringify(ready).includes('must-not-return'));
  const sourceBranch='tayar/22222222-2222-4222-8222-222222222222/preview',previewDeployment={...deployment,target:null,
    meta:{...deployment.meta,githubCommitRef:sourceBranch}};
  const preview=await inspect({...input,target:'preview',sourceBranch,fetcher:fixture({deployment:previewDeployment,
    envs:[{key:'SUPABASE_URL',target:['preview'],gitBranch:sourceBranch},{key:'SUPABASE_ANON_KEY',target:['preview'],gitBranch:sourceBranch}]})});
  assert.equal(preview.status,'ready','Preview reads its exact source branch environment');
  const wrongBranch=await inspect({...input,target:'preview',sourceBranch,fetcher:fixture({deployment:previewDeployment,
    envs:[{key:'SUPABASE_URL',target:['preview'],gitBranch:input.productionBranch},{key:'SUPABASE_ANON_KEY',target:['preview'],gitBranch:input.productionBranch}]})});
  assert.deepEqual(wrongBranch.missingEnvironment,['SUPABASE_ANON_KEY','SUPABASE_URL'],'production-branch variables cannot satisfy Preview');
  const missing = await inspect({ ...input, fetcher: fixture({ envs: [
    { key: 'SUPABASE_URL', target: ['production'] }] }) });
  assert.deepEqual(missing.missingEnvironment, ['SUPABASE_ANON_KEY']);
  assert.equal(missing.status, 'setup-incomplete'); assert.equal(missing.liveUrl, null);
  assert.equal((await inspect({ ...input, fetcher: fixture({ deployment: {
    ...deployment, readyState: 'ERROR', url: undefined } }) })).status, 'deployment-failed');
  assert.equal((await inspect({ ...input, fetcher: fixture({ deployment: {
    ...deployment, readyState: 'BUILDING', url: undefined } }) })).status, 'connecting');
  for (const overrides of [
    { project: { ...project, accountId: input.platformAccountId } },
    { deployment: { ...deployment, projectId: 'prj_attacker1234' } },
    { deployment: { ...deployment, meta: { ...deployment.meta, githubCommitSha: 'b'.repeat(40) } } },
    { second: { ...deployment, readyState: 'ERROR', url: undefined } },
  ]) await assert.rejects(inspect({ ...input, fetcher: fixture(overrides) }), /unavailable/);
  await assert.rejects(inspect({ ...input, requiredEnvironment: ['SUPABASE_URL', 'SUPABASE_URL'],
    fetcher: fixture() }), /unavailable/);
  console.log('PASS owned Vercel deployment: exact project/source, env presence, two final observations and safe readiness states (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
