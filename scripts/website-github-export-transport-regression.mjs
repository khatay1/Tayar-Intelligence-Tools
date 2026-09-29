import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-export-'));
try {
  const outfile = join(dir, 'export.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubExportTransport.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { writeWebsiteGitHubExport: write } = (await import(pathToFileURL(outfile))).default;
  const projectId = '22222222-2222-4222-8222-222222222222';
  const branch = `tayar/${projectId}/production`;
  const digest = 'd'.repeat(64);
  const baseSha = 'a'.repeat(40), blobSha = 'b'.repeat(40), treeSha = 'c'.repeat(40), commitSha = 'e'.repeat(40);
  const connection = { id: '33333333-3333-4333-8333-333333333333', ownerId: '11111111-1111-4111-8111-111111111111',
    projectId, provider: 'github', environment: 'production', accountId: '77', targetId: '88',
    permissions: ['contents:write'], status: 'connected', version: 1, operationId: null,
    verifiedAt: '2026-09-29T00:00:00Z', updatedAt: '2026-09-29T00:00:00Z' };
  const cursor = { projectId, connectionVersion: 1, repositoryId: '88', branch,
    lastHeadSha: null, lastSourceDigest: null };
  const input = { connection, cursor, repositoryFullName: 'user/my-app', token: 't'.repeat(30),
    sourceDigest: digest, files: [{ path: 'src/index.ts', content: 'export const value = 1;' }], isCurrent: async () => true };
  function fixture({ empty = false, existing = false, lost = false, drift = false, wrongRepo = false } = {}) {
    let branchHead = existing ? baseSha : null;
    let writes = 0;
    const calls = [];
    const fetcher = async (url, options) => {
      const path = new URL(url).pathname;
      calls.push({ path, method: options.method, body: options.body && JSON.parse(options.body), authorization: options.headers.Authorization });
      const respond = (value, status = 200) => new Response(JSON.stringify(value), { status });
      if (path === '/repos/user/my-app' && options.method === 'GET') return respond({
        id: wrongRepo ? 99 : 88, owner: { id: 77 }, full_name: 'user/my-app', default_branch: 'main' });
      if (path.endsWith(`/git/ref/heads/${branch}`) && options.method === 'GET') {
        return branchHead ? respond({ object: { sha: branchHead } }) : respond({}, 404);
      }
      if (path.endsWith('/git/ref/heads/main')) return empty ? respond({}, 404) : respond({ object: { sha: baseSha } });
      if (path.endsWith('/git/blobs')) return respond({ sha: blobSha });
      if (path.endsWith('/git/trees')) return respond({ sha: treeSha });
      if (path.endsWith('/git/commits') && options.method === 'POST') return respond({ sha: commitSha, tree: { sha: treeSha } });
      if (path.endsWith(`/git/commits/${commitSha}`)) return respond({ sha: commitSha, tree: { sha: treeSha } });
      if (path.endsWith('/git/refs') || options.method === 'PATCH') {
        writes++;
        assert.equal(options.body && JSON.parse(options.body).force, options.method === 'PATCH' ? false : undefined);
        if (!drift) branchHead = commitSha;
        if (lost) throw new Error('transport response lost');
        return respond({ object: { sha: branchHead } });
      }
      throw new Error(`Unexpected mocked call: ${options.method} ${path}`);
    };
    return { fetcher, calls, getWrites: () => writes };
  }
  const initial = fixture();
  assert.deepEqual(await write({ ...input, fetcher: initial.fetcher }),
    { status: 'written', headSha: commitSha, treeSha });
  assert.equal(initial.getWrites(), 1);
  assert.equal(initial.calls.find(x => x.path.endsWith('/git/refs')).body.ref, `refs/heads/${branch}`);
  assert(initial.calls.every(x => x.authorization === `Bearer ${input.token}`));
  const uncertain = fixture({ lost: true });
  assert.equal((await write({ ...input, fetcher: uncertain.fetcher })).status, 'written');
  await assert.rejects(write({ ...input, fetcher: fixture({ drift: true, lost: true }).fetcher }), /outcome is uncertain/);
  await assert.rejects(write({ ...input, fetcher: fixture({ empty: true }).fetcher }), /repository is empty/);
  await assert.rejects(write({ ...input, fetcher: fixture({ existing: true }).fetcher }), /branch changed/);
  await assert.rejects(write({ ...input, fetcher: fixture({ wrongRepo: true }).fetcher }), /repository changed/);
  for (const path of ['../escape', '.env', 'src/project-backup.json', 'src/private.key', 'src/secret.ts']) {
    await assert.rejects(write({ ...input, files: [{ path, content: 'x' }], fetcher: fixture().fetcher }), /manifest/);
  }
  const update = fixture({ existing: true });
  assert.equal((await write({ ...input, cursor: { ...cursor, lastHeadSha: baseSha,
    lastSourceDigest: 'f'.repeat(64) }, fetcher: update.fetcher })).status, 'written');
  assert.equal(update.calls.find(x => x.method === 'PATCH').body.force, false);
  const unchanged = fixture({ existing: true });
  assert.equal((await write({ ...input, cursor: { ...cursor, lastHeadSha: baseSha,
    lastSourceDigest: digest }, fetcher: unchanged.fetcher })).status, 'unchanged');
  assert.equal(unchanged.getWrites(), 0);
  await assert.rejects(write({ ...input, isCurrent: async () => false, fetcher: fixture().fetcher }), /scope changed/);
  console.log('PASS GitHub export transport: mocked remote identity, initial/update, non-force ref, readback, uncertainty, empty/conflict');
} finally { await rm(dir, { recursive: true, force: true }); }
