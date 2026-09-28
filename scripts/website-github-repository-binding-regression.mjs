import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-bind-'));
try {
  const outfile = join(dir, 'binding.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubRepositoryBindingService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { bindWebsiteGitHubRepository: bind } = (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  const token = 'fixture-user-token-1234567890123456';
  let writes = 0;
  let consumes = 0;
  let recorded;
  const client = { async rpc(name, args) {
    if (name === 'website_consume_connection_handoff') {
      consumes++;
      assert.deepEqual(args, { p_id: handoffId, p_owner_id: ownerId, p_project_id: projectId, p_provider: 'github' });
      return { data: { environment: 'production', userToken: token }, error: null };
    }
    assert.equal(name, 'website_record_infrastructure_connection');
    writes++; recorded = args;
    return { data: 1, error: null };
  } };
  const fetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    const payload = url.includes('/repositories?')
      ? { repositories: [{ id: 88, owner: { id: 17 }, full_name: 'owner/site', default_branch: 'main', permissions: { push: true } }] }
      : { installations: [{ id: 42, account: { id: 17, login: 'owner' }, permissions: { contents: 'write' }, suspended_at: null }] };
    return { ok: true, headers: { get() { return null; } }, async text() { return JSON.stringify(payload); } };
  };
  const input = { client, ownerId, projectId, handoffId, installationId: '42', repositoryId: '88',
    isCurrentOwner: () => true, fetcher, now: () => '2026-09-28T20:00:00Z' };
  const result = await bind(input);
  assert.match(result.connectionId, /^[0-9a-f-]{36}$/i);
  assert.equal(result.repositoryFullName, 'owner/site');
  assert.equal(result.version, 1);
  assert.equal(writes, 1);
  assert.equal(recorded.p_project_id, projectId);
  assert.equal(recorded.p_account_id, '17');
  assert.equal(recorded.p_target_id, '88');
  assert.equal(recorded.p_expected_version, 0);
  assert.equal(recorded.p_status, 'connected', 'Repo access alone is not deployment readiness');
  assert.ok(!JSON.stringify(recorded).includes(token), 'Grant is not stored in the connection registry');
  const before = consumes;
  await assert.rejects(bind({ ...input, isCurrentOwner: () => false }), /could not be verified/);
  assert.equal(consumes, before, 'Stale user never consumes custody');
  await assert.rejects(bind({ ...input, repositoryId: '99' }), /could not be verified/);
  assert.equal(writes, 1, 'Unselected repository never reaches registry');
  console.log('PASS GitHub binding: owner handoff, observed installation/repo, metadata-only CAS and no fake ready');
} finally { await rm(dir, { recursive: true, force: true }); }
