import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-install-'));
try {
  const outfile = join(dir, 'github.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubInstallationService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { verifyGitHubInstallationRepository: verify } = (await import(pathToFileURL(outfile))).default;
  const installation = { id: 42, account: { id: 17, login: 'owner' }, permissions: { contents: 'write' }, suspended_at: null };
  const repository = { id: 88, owner: { id: 17 }, full_name: 'owner/site', default_branch: 'main',
    archived: false, disabled: false, permissions: { push: true } };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const body = url.includes('/repositories?') ? { repositories: [repository] } : { installations: [installation] };
    return { ok: true, headers: { get() { return null; } }, async text() { return JSON.stringify(body); } };
  };
  const args = { userToken: 'fixture-private-token', installationId: '42', repositoryId: '88', fetcher };
  assert.deepEqual(await verify(args), { installationId: '42', accountId: '17', accountLogin: 'owner',
    repositoryId: '88', repositoryFullName: 'owner/site', defaultBranch: 'main' });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url, options }) => url.startsWith('https://api.github.com/user/installations')
    && options.redirect === 'error' && options.headers.Authorization === 'Bearer fixture-private-token'));
  assert.ok(!JSON.stringify(await verify(args)).includes('fixture-private-token'));
  const test = async (changedInstallation, changedRepository) => {
    const altered = async url => ({ ok: true, headers: { get() { return null; } }, async text() {
      return JSON.stringify(url.includes('/repositories?') ? { repositories: changedRepository ? [changedRepository] : [] }
        : { installations: changedInstallation ? [changedInstallation] : [] });
    } });
    await assert.rejects(verify({ ...args, fetcher: altered }), error => !error.message.includes('fixture-private-token'));
  };
  await test(undefined, repository);
  await test({ ...installation, permissions: { contents: 'read' } }, repository);
  await test({ ...installation, suspended_at: '2026-09-28T00:00:00Z' }, repository);
  await test(installation, { ...repository, owner: { id: 99 } });
  await test(installation, { ...repository, permissions: { push: false } });
  await test(installation, { ...repository, archived: true });
  await assert.rejects(verify({ ...args, installationId: '../42' }), /could not be verified/);
  await assert.rejects(verify({ ...args, fetcher: async () => { throw new Error('fixture-private-token'); } }),
    error => !error.message.includes('fixture-private-token'));
  console.log('PASS GitHub installation: user-grant, account, selected repository, write permission and safe errors');
} finally { await rm(dir, { recursive: true, force: true }); }
