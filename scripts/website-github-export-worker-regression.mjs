import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-export-worker-'));
try {
  const outfile = join(dir, 'worker.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubExportWorker.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { exportWebsiteProjectToOwnedGitHub: run } = (await import(pathToFileURL(outfile))).default;
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const projectId = '22222222-2222-4222-8222-222222222222';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const connectionId = '33333333-3333-4333-8333-333333333333';
  const operationId = '44444444-4444-4444-8444-444444444444';
  const branch = `tayar/${projectId}/production`;
  const head = 'a'.repeat(40), tree = 'b'.repeat(40), base = 'c'.repeat(40);
  const content = '<html>Ready</html>';
  const blob = createHash('sha1').update(`blob ${Buffer.byteLength(content)}\0`).update(content).digest('hex');
  const connection = { id: connectionId, ownerId, projectId, provider: 'github', environment: 'production',
    accountId: '17', targetId: '88', status: 'connected', permissions: ['contents:write'], version: 2,
    operationId: null, verifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const snapshot = { pages: [{ id: 'home', title: 'Ready' }], application: { version: 1 } };
  function fixture({ lostCursor = false, existing = false, tamperRecovery = false } = {}) {
    let currentConnection = structuredClone(connection);
    let cursor = null, branchHead = existing ? head : null, cursorWrites = 0, refWrites = 0;
    let committedMessage = '', failCursor = lostCursor;
    const reader = {
      readSavedProject: async () => ({ projectId, ownerId, snapshot: structuredClone(snapshot) }),
      readConnection: async () => structuredClone(currentConnection),
    };
    const client = { async rpc(name, args) {
      if (name === 'website_github_export_cursor_for_worker') return { data: cursor, error: null };
      if (name === 'website_initialize_github_export_cursor') {
        assert.equal(args.p_branch, branch);
        cursor = { projectId, connectionVersion: 2, repositoryId: '88', environment: 'production', branch,
          lastHeadSha: null, lastSourceDigest: null, version: 1 };
        return { data: 1, error: null };
      }
      if (name === 'website_reconcile_github_export_cursor') return { data: null, error: null };
      if (name === 'website_commit_github_export_cursor') {
        cursorWrites++;
        if (failCursor) { failCursor = false; return { data: null, error: new Error('DB result unavailable') }; }
        cursor = { ...cursor, lastHeadSha: args.p_new_head, lastSourceDigest: args.p_source_digest, version: 2 };
        return { data: 2, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    } };
    const fetcher = async (url, options) => {
      const path = new URL(url).pathname;
      const respond = (value, status = 200) => new Response(JSON.stringify(value), { status });
      if (path === '/app/installations' && url.includes('?')) return respond([{ id: 42, account: { id: 17 },
        permissions: { contents: 'write' }, suspended_at: null }]);
      if (path === '/app/installations/42/access_tokens') return respond({ token: 'fixture-token-1234567890123456',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(), permissions: { contents: 'write' },
        repositories: [{ id: 88, owner: { id: 17 }, full_name: 'owner/site', default_branch: 'main' }] });
      if (path === '/repos/owner/site') return respond({ id: 88, owner: { id: 17 },
        full_name: 'owner/site', default_branch: 'main' });
      if (path.endsWith(`/git/ref/heads/${branch}`) && options.method === 'GET') {
        return branchHead ? respond({ object: { sha: branchHead } }) : respond({}, 404);
      }
      if (path.endsWith('/git/ref/heads/main')) return respond({ object: { sha: base } });
      if (path.endsWith('/git/blobs')) return respond({ sha: blob });
      if (path.endsWith('/git/trees')) return respond({ sha: tree });
      if (path.endsWith('/git/commits') && options.method === 'POST') {
        committedMessage = JSON.parse(options.body).message;
        return respond({ sha: head, tree: { sha: tree } });
      }
      if (path.endsWith(`/git/commits/${head}`)) return respond({ sha: head, tree: { sha: tree },
        message: committedMessage, parents: [{ sha: base }] });
      if (path.endsWith(`/git/trees/${tree}`)) return respond({ sha: tree, truncated: false,
        tree: [{ path: 'index.html', mode: '100644', type: 'blob', sha: tamperRecovery ? base : blob }] });
      if (path.endsWith('/git/refs')) { refWrites++; branchHead = head; return respond({ object: { sha: head } }); }
      throw new Error(`Unexpected GitHub call ${options.method} ${path}`);
    };
    return { reader, client, fetcher, switchOwner: () => { currentConnection = { ...connection, ownerId: crypto.randomUUID() }; },
      cursorWrites: () => cursorWrites, refWrites: () => refWrites };
  }
  const baseInput = { projectId, ownerId, connectionId, operationId, environment: 'production',
    compile: async saved => [{ path: 'index.html', content: `<html>${saved.pages[0].title}</html>` }],
    appClientId: 'Iv1_fixture', appPrivateKeyPkcs8: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() };
  const success = fixture();
  await assert.rejects(run({ ...baseInput, ...success, expectedSourceDigest: '0'.repeat(64) }), /source changed/);
  assert.equal(success.refWrites(), 0, 'Digest mismatch is refused before a remote write');
  assert.deepEqual(await run({ ...baseInput, ...success }), { status: 'exported', headSha: head });
  assert.equal(success.cursorWrites(), 1);
  assert.equal(success.refWrites(), 1);
  const uncertain = fixture({ lostCursor: true });
  assert.deepEqual(await run({ ...baseInput, ...uncertain }), { status: 'recovery-required', headSha: head });
  assert.equal(uncertain.cursorWrites(), 1);
  assert.deepEqual(await run({ ...baseInput, ...uncertain }), { status: 'exported', headSha: head });
  assert.equal(uncertain.refWrites(), 1, 'Recovery verifies the existing ref instead of writing it again');
  const tampered = fixture({ lostCursor: true, tamperRecovery: true });
  assert.equal((await run({ ...baseInput, ...tampered })).status, 'recovery-required');
  await assert.rejects(run({ ...baseInput, ...tampered }), /branch changed/);
  assert.equal(tampered.refWrites(), 1, 'Mismatched remote source cannot be reconciled');
  const conflict = fixture({ existing: true });
  await assert.rejects(run({ ...baseInput, ...conflict }), /branch exists without/);
  assert.equal(conflict.refWrites(), 0);
  const switched = fixture(); switched.switchOwner();
  await assert.rejects(run({ ...baseInput, ...switched }), /source changed/);
  assert.equal(switched.refWrites(), 0);
  console.log('PASS GitHub export worker: mocked scoped token, cursor, remote write, lost cursor response and existing branch');
} finally { await rm(dir, { recursive: true, force: true }); }
