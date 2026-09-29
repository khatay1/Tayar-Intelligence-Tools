import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-project-'));
try {
  const outfile = join(dir, 'vercel.cjs');
  await build({ entryPoints: ['server/website-owned-vercel-project.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const { verifyOwnedVercelProject: verify } = (await import(pathToFileURL(outfile))).default;
  const input = { accessToken: 'user-scoped-vercel-token', userId: 'user_abcdefgh',
    accountId: 'team_abcdefgh', platformAccountId: 'team_tayar1234',
    projectId: 'prj_abcdefgh', repositoryId: '12345678', repositoryOwner: 'customer',
    repositoryName: 'booking-app', productionBranch: 'tayar/booking/production',
    isCurrent: async () => true };
  const project = { id: input.projectId, accountId: input.accountId, paused: false,
    link: { type: 'github', repoId: 12345678, org: input.repositoryOwner,
      repo: input.repositoryName, productionBranch: input.productionBranch } };
  function fixture(overrides = {}) {
    const calls = [];
    let projectReads = 0;
    const fetcher = async (url, init) => {
      calls.push(url); assert.equal(init.headers.Authorization, 'Bearer user-scoped-vercel-token');
      assert.equal(init.redirect, 'error'); assert.equal(init.method, 'GET');
      const path = url.replace('https://api.vercel.com', '');
      if (path === '/v2/user') return Response.json(overrides.profile ?? { user: { id: input.userId } });
      if (path === `/v2/teams/${input.accountId}`) return Response.json(overrides.team ?? {
        id: input.accountId, membership: { uid: input.userId, role: 'OWNER', confirmed: true } });
      assert.equal(path, `/v9/projects/${input.projectId}?teamId=${input.accountId}`);
      projectReads++;
      return Response.json(projectReads === 2 ? overrides.second ?? overrides.project ?? project : overrides.project ?? project);
    };
    return { calls, fetcher };
  }
  const valid = fixture();
  assert.equal(await verify({ ...input, fetcher: valid.fetcher }), true);
  assert.equal(valid.calls.length, 4);
  for (const overrides of [
    { profile: { user: { id: 'other' } } },
    { team: { id: input.accountId, membership: { uid: input.userId, role: 'VIEWER', confirmed: true } } },
    { project: { ...project, accountId: 'team_tayar1234' } },
    { project: { ...project, link: { ...project.link, repoId: 999 } } },
    { second: { ...project, link: { ...project.link, productionBranch: 'main' } } },
    { project: { ...project, paused: true } },
  ]) assert.equal(await verify({ ...input, fetcher: fixture(overrides).fetcher }), false);
  assert.equal(await verify({ ...input, accountId: 'team_tayar1234', fetcher: fixture().fetcher }), false);
  assert.equal(await verify({ ...input, isCurrent: async () => false,
    fetcher: async () => { throw new Error('stale scope must make no request'); } }), false);
  const personal = { ...input, accountId: input.userId };
  assert.equal(await verify({ ...personal, fetcher: async url => {
    if (url.endsWith('/v2/user')) return Response.json({ user: { id: input.userId } });
    assert.equal(url, `https://api.vercel.com/v9/projects/${input.projectId}`);
    return Response.json({ ...project, accountId: input.userId });
  } }), true);
  console.log('PASS owned Vercel project: user/team account, exact GitHub repo/branch, transfer and stale denial (mocked HTTP)');
} finally { await rm(dir, { recursive: true, force: true }); }
