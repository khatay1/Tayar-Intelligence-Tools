import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-install-token-'));
try {
  const outfile = join(dir, 'token.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubInstallationTokenService.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { mintWebsiteGitHubRepositoryToken: mint } = (await import(pathToFileURL(outfile))).default;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKeyPkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const now = Date.parse('2026-09-29T01:00:00Z');
  const input = { clientId: 'Iv1_fixture', privateKeyPkcs8, accountId: '17', repositoryId: '88', now: () => now };
  const token = 'fixture-installation-token-1234567890123456';
  let posts = 0;
  const fetcher = async (url, options) => {
    const jwt = options.headers.Authorization.replace('Bearer ', '');
    const [head, claim, signature] = jwt.split('.');
    assert.equal(JSON.parse(Buffer.from(head, 'base64url')).alg, 'RS256');
    const body = JSON.parse(Buffer.from(claim, 'base64url'));
    assert.equal(body.iss, input.clientId);
    assert.ok(body.exp - body.iat <= 600);
    assert.equal(verify('RSA-SHA256', Buffer.from(`${head}.${claim}`), publicKey, Buffer.from(signature, 'base64url')), true);
    let payload;
    if (url.includes('/app/installations?')) {
      payload = [{ id: 42, account: { id: 17 }, permissions: { contents: 'write' }, suspended_at: null }];
    } else {
      assert.equal(url, 'https://api.github.com/app/installations/42/access_tokens');
      assert.deepEqual(JSON.parse(options.body), { repository_ids: [88], permissions: { contents: 'write' } });
      posts++;
      payload = { token, expires_at: new Date(now + 3_600_000).toISOString(), permissions: { contents: 'write' },
        repositories: [{ id: 88, owner: { id: 17 }, full_name: 'owner/site', default_branch: 'main' }] };
    }
    return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify(payload) };
  };
  const result = await mint({ ...input, fetcher });
  assert.deepEqual(result, { token, expiresAt: new Date(now + 3_600_000).toISOString(),
    repositoryId: '88', repositoryFullName: 'owner/site', defaultBranch: 'main' });
  assert.equal(posts, 1);
  await assert.rejects(mint({ ...input, accountId: '18', fetcher }), /unavailable/);
  assert.equal(posts, 1, 'Wrong owner cannot mint a repository token');
  await assert.rejects(mint({ ...input, repositoryId: '9007199254740993', fetcher }), /unavailable/);
  assert.equal(posts, 1, 'Unsafe numeric repository ID cannot round to another repo');
  const badRepository = async (url, options) => {
    const response = await fetcher(url, options);
    if (!url.includes('/access_tokens')) return response;
    return { ...response, text: async () => JSON.stringify({ token, expires_at: new Date(now + 3_600_000).toISOString(),
      permissions: { contents: 'write' }, repositories: [{ id: 99, owner: { id: 17 }, full_name: 'owner/other', default_branch: 'main' }] }) };
  };
  await assert.rejects(mint({ ...input, fetcher: badRepository }), /unavailable/);
  console.log('PASS GitHub installation token: signed App JWT, account match, single-repo write scope and refusal on wrong target');
} finally { await rm(dir, { recursive: true, force: true }); }
