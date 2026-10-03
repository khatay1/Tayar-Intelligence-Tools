import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-bind-'));
try {
  const outfile = join(dir, 'binding.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubRepositoryBindingService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { bindWebsiteGitHubRepository: bind } = (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  const token = 'ghu_fixture_user_token_1234567890';
  const grant = JSON.stringify({ accessToken: token, receivedAt: '2026-10-03T20:00:00.000Z',
    expiresIn: null, refreshToken: null, refreshTokenExpiresIn: null });
  let writes = 0, consumes = 0, recorded;
  const client = { async rpc(name, args) {
    if (name === 'website_reconcile_github_repository_binding') return { data: null, error: null };
    if (name === 'website_consume_connection_handoff') {
      consumes++;
      assert.deepEqual(args, { p_id: handoffId, p_owner_id: ownerId, p_project_id: projectId, p_provider: 'github' });
      return { data: { environment: 'production', userToken: grant }, error: null };
    }
    assert.equal(name, 'website_bind_github_repository');
    writes++; recorded = args;
    return { data: 1, error: null };
  } };
  const fetcher = async (url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    const payload = url.includes('/repositories?')
      ? { repositories: [{ id: 88, owner: { id: 17 }, full_name: 'owner/site', default_branch: 'main',
        permissions: { push: true } }] }
      : { installations: [{ id: 42, account: { id: 17, login: 'owner' },
        permissions: { contents: 'write' }, suspended_at: null }] };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const input = { client, ownerId, projectId, handoffId, installationId: '42', repositoryId: '88',
    isCurrentOwner: () => true, fetcher, now: () => '2026-10-03T20:00:00Z' };
  const result = await bind(input);
  assert.equal(result.connectionId, handoffId, 'Initial identity is stable across a lost response');
  assert.equal(result.repositoryFullName, 'owner/site');
  assert.equal(result.version, 1);
  assert.equal(writes, 1);
  assert.equal(recorded.p_project_id, projectId);
  assert.equal(recorded.p_owner_id, ownerId);
  assert.equal(recorded.p_account_id, '17');
  assert.equal(recorded.p_installation_id, '42');
  assert.equal(recorded.p_repository_id, '88');
  assert.equal(recorded.p_repository_full_name, 'owner/site');
  assert.equal(recorded.p_default_branch, 'main');
  assert.equal(recorded.p_expected_version, 0);
  assert.equal(recorded.p_access_token, token);
  assert.equal(recorded.p_refresh_token, null);
  assert.equal(recorded.p_access_expires_at, null);
  assert.ok(Date.parse(recorded.p_custody_expires_at) > Date.parse('2026-10-03T20:00:00Z'));
  assert.equal(recorded.p_operation_id, handoffId);

  const before = consumes;
  await assert.rejects(bind({ ...input, isCurrentOwner: () => false }), /could not be verified/);
  assert.equal(consumes, before, 'Stale user never consumes custody');
  await assert.rejects(bind({ ...input, repositoryId: '99' }), /could not be verified/);
  assert.equal(writes, 1, 'Unselected repository never reaches atomic binding');

  let retryConsumes = 0, saved = null;
  const uncertainClient = { async rpc(name, args) {
    if (name === 'website_reconcile_github_repository_binding') {
      assert.equal(args.p_operation_id, handoffId);
      return { data: saved && args.p_repository_id === '88' && args.p_installation_id === '42' ? saved : null, error: null };
    }
    if (name === 'website_consume_connection_handoff') {
      retryConsumes++;
      return { data: { environment: 'production', userToken: grant }, error: null };
    }
    assert.equal(name, 'website_bind_github_repository');
    saved = 1;
    return { data: null, error: new Error('transport timeout after commit') };
  } };
  const uncertainInput = { ...input, client: uncertainClient };
  const recovered = await bind(uncertainInput);
  assert.deepEqual(recovered, { connectionId: handoffId, repositoryId: '88', version: 1 });
  const replay = await bind(uncertainInput);
  assert.deepEqual(replay, recovered);
  assert.equal(retryConsumes, 1, 'A committed replay does not consume OAuth handoff twice');
  await assert.rejects(bind({ ...uncertainInput, repositoryId: '99' }), /could not be verified/);
  assert.equal(retryConsumes, 2, 'Different target cannot claim the committed result');
  console.log('PASS GitHub binding: one-use OAuth handoff, verified repo, atomic metadata+Vault custody and replay reconciliation');
} finally { await rm(dir, { recursive: true, force: true }); }
