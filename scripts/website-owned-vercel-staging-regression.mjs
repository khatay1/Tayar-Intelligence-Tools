import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-staging-'));
try {
  const out = join(dir, 'staging.cjs');
  await build({ entryPoints: ['server/website-owned-vercel-staging.ts'], outfile: out, bundle: true, platform: 'node', format: 'cjs' });
  const { stageOwnedVercelProductionDeployment: stage } = createRequire(import.meta.url)(out);
  const uid = n => `${n}`.repeat(8) + '-' + `${n}`.repeat(4) + '-4' + `${n}`.repeat(3) + '-8' + `${n}`.repeat(3) + '-' + `${n}`.repeat(12);
  const candidate = { status: 'source-prepared', operationId: uid(1), projectId: uid(2), ownerId: uid(3),
    previewOperationId: uid(4), githubConnectionId: uid(5), previewSourceDigest: 'a'.repeat(64), snapshotDigest: 'b'.repeat(64),
    runtimeDigest: 'c'.repeat(64), sourceDigest: 'd'.repeat(64), headSha: 'e'.repeat(40) };
  const base = { candidate, accessToken: 'customer-access-token', userId: 'user_customer1234', accountId: 'team_customer1234',
    platformAccountId: 'team_platform1234', projectId: 'prj_customer1234', repositoryId: '12345678', repositoryOwner: 'customer',
    repositoryName: 'app', productionBranch: 'main', runtimeEnvironmentReceiptVersion: 2,
    runtimeEnvironmentIds: { SUPABASE_URL: 'env_url1234', SUPABASE_ANON_KEY: 'env_key1234' } };
  const branch = `tayar/${candidate.projectId}/production`;
  const project = { id: base.projectId, name: 'customer-app', accountId: base.accountId, link: { type: 'github',
    repoId: base.repositoryId, org: base.repositoryOwner, repo: base.repositoryName, productionBranch: base.productionBranch } };
  const deployment = { id: 'dpl_staging1234', projectId: base.projectId, ownerId: base.accountId, target: 'production',
    readyState: 'READY', url: 'customer-staged.vercel.app', alias: [], aliasAssigned: false,
    meta: { githubCommitSha: candidate.headSha, githubCommitRef: branch, tayarProductionOperationId: candidate.operationId,
      tayarSourceDigest: candidate.sourceDigest } };
  const environment = Object.entries(base.runtimeEnvironmentIds).map(([key, id]) => ({ key, id, target: ['production'] }));
  function fixture(options = {}) {
    let claimed = false, recorded = null, savedScope, current = true, posts = 0, reads = 0, claims = 0;
    const store = {
      async claim(scope) {
        claims++; assert.equal(scope.sourceBranch, branch); assert.equal(scope.candidate.headSha, candidate.headSha);
        assert.equal(JSON.stringify(scope).includes(base.accessToken), false);
        if (savedScope) assert.deepEqual(scope, savedScope, 'Retries carry identical immutable source/environment identity');
        savedScope = structuredClone(scope);
        if (options.claimFailure) throw Error('private claim failure');
        const issueCreate = !claimed; claimed = true;
        if (options.revokeAtClaim) current = false;
        return { issueCreate, deploymentId: recorded };
      },
      async record(scope, id) {
        assert.deepEqual(scope, savedScope); assert.equal(id, deployment.id); recorded = id;
        if (options.loseRecord) throw Error('private persistence response lost');
      },
    };
    const fetcher = async (resource, init) => {
      const url = new URL(resource); assert.equal(url.origin, 'https://api.vercel.com');
      assert.equal(init.headers.Authorization, `Bearer ${base.accessToken}`);
      if (init.method === 'POST') {
        assert.equal(claimed, true, 'Create is never issued before durable claim'); posts++;
        assert.equal(url.pathname, '/v13/deployments'); assert.equal(url.searchParams.get('teamId'), base.accountId);
        const body = JSON.parse(init.body);
        assert.deepEqual(body, { name: project.name, project: base.projectId, target: 'production', autoAssignCustomDomains: false,
          gitSource: { type: 'github', repoId: base.repositoryId, ref: branch, sha: candidate.headSha },
          meta: { tayarProductionOperationId: candidate.operationId, tayarSourceDigest: candidate.sourceDigest } });
        if (options.loseCreate) throw Error('private uncertain provider response');
        return Response.json(deployment, { status: options.createStatus ?? 201 });
      }
      assert.equal(init.method, 'GET', 'No promotion, domain or environment mutations are allowed');
      if (url.pathname === '/v2/user') return Response.json({ user: { id: base.userId } });
      if (url.pathname === `/v2/teams/${base.accountId}`) return Response.json({ id: base.accountId,
        membership: { uid: base.userId, role: options.memberRole ?? 'OWNER', confirmed: true } });
      if (url.pathname === `/v9/projects/${base.projectId}`) return Response.json(options.project ?? project);
      if (url.pathname === `/v10/projects/${base.projectId}/env`) {
        assert.equal(url.searchParams.get('decrypt'), 'false');
        return Response.json({ envs: options.environment ?? environment });
      }
      if (url.pathname === '/v6/deployments') {
        assert.equal(url.searchParams.get('sha'), candidate.headSha); assert.equal(url.searchParams.get('branch'), branch);
        return Response.json({ deployments: options.discovery ?? [deployment] });
      }
      assert.equal(url.pathname, `/v13/deployments/${deployment.id}`); reads++;
      if (options.revokeAtRead) current = false;
      return Response.json(reads % 2 === 0 ? options.second ?? options.observation ?? deployment : options.observation ?? deployment);
    };
    return { input: { ...base, store, fetcher, isCurrent: async () => current }, stats: () => ({ posts, claims, recorded }) };
  }
  const normal = fixture();
  assert.deepEqual(await stage(normal.input), { status: 'staged', deploymentId: deployment.id, sourceCommitSha: candidate.headSha,
    liveUrl: 'https://customer-staged.vercel.app' });
  assert.equal((await stage(normal.input)).status, 'staged'); assert.equal(normal.stats().posts, 1, 'A claimed retry observes only');
  const lost = fixture({ loseCreate: true });
  assert.equal((await stage(lost.input)).status, 'staged'); assert.equal((await stage(lost.input)).status, 'staged');
  assert.equal(lost.stats().posts, 1, 'Lost create response discovers exact operation without another POST');
  for (const options of [{ loseCreate: true, discovery: [] }, { createStatus: 429, discovery: [] }, { createStatus: 500, discovery: [] }]) {
    const absent = fixture(options);
    assert.equal((await stage(absent.input)).status, 'observing'); assert.equal((await stage(absent.input)).deploymentId, null);
    assert.equal(absent.stats().posts, 1, 'An absent deployment after uncertainty never authorizes automatic recreation');
  }
  const unclaimed = fixture({ claimFailure: true }); await assert.rejects(stage(unclaimed.input), /staging is unavailable/);
  assert.equal(unclaimed.stats().posts, 0);
  const automaticBranch = fixture();
  await assert.rejects(stage({ ...automaticBranch.input, productionBranch: branch }), /staging is unavailable/);
  assert.equal(automaticBranch.stats().posts, 0, 'The exported source branch must not be the automatic Production branch');
  for (const options of [
    { memberRole: 'MEMBER' }, { project: { ...project, accountId: base.platformAccountId } },
    { project: { ...project, link: { ...project.link, repoId: '9999' } } },
    { environment: environment.map(row => ({ ...row, target: ['preview'] })) },
    { environment: environment.map(row => ({ ...row, id: 'env_replaced1234' })) },
    { environment: [...environment, environment[0]] }, { revokeAtClaim: true },
  ]) {
    const bad = fixture(options); await assert.rejects(stage(bad.input), /staging is unavailable/); assert.equal(bad.stats().posts, 0);
  }
  for (const observation of [
    { ...deployment, alias: ['live.example.com'] }, { ...deployment, aliasAssigned: 12345 },
    { ...deployment, target: null }, { ...deployment, ownerId: base.platformAccountId },
    { ...deployment, meta: { ...deployment.meta, githubCommitSha: 'f'.repeat(40) } },
    { ...deployment, meta: { ...deployment.meta, tayarProductionOperationId: uid(6) } },
    { ...deployment, url: 'attacker.example.com' },
  ]) { const bad = fixture({ observation }); await assert.rejects(stage(bad.input), /staging is unavailable/); }
  const ambiguous = fixture({ loseCreate: true, discovery: [deployment, { ...deployment, id: 'dpl_another1234' }] });
  await assert.rejects(stage(ambiguous.input), /staging is unavailable/); assert.equal(ambiguous.stats().posts, 1);
  const wrongOperation = fixture({ loseCreate: true, discovery: [{ ...deployment, meta: { ...deployment.meta, tayarProductionOperationId: uid(6) } }] });
  assert.equal((await stage(wrongOperation.input)).status, 'observing', 'Another operation with the same commit cannot be recovered');
  const unstable = fixture({ second: { ...deployment, readyState: 'BUILDING' } });
  await assert.rejects(stage(unstable.input), /staging is unavailable/);
  const changed = fixture({ revokeAtRead: true }); await assert.rejects(stage(changed.input), /staging is unavailable/);
  const recording = fixture({ loseRecord: true }); await assert.rejects(stage(recording.input), /staging is unavailable/);
  await assert.rejects(stage(recording.input), /staging is unavailable/); assert.equal(recording.stats().posts, 1);
  for (const state of ['BUILDING', 'ERROR', 'CANCELED']) {
    const pending = fixture({ observation: { ...deployment, readyState: state, url: undefined } });
    assert.equal((await stage(pending.input)).status, state === 'BUILDING' ? 'observing' : 'deployment-failed');
  }
  console.log('PASS staged Vercel transport: durable claim ordering, skip-domain request, exact source/actor/environment, lost-response observation, no recreation and alias refusal (mocked provider/store; no activation)');
} finally { await rm(dir, { recursive: true, force: true }); }
