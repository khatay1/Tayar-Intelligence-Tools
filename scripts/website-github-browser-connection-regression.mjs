import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-github-browser-'));
try {
  const outfile = join(dir, 'browser.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteGithubBrowserConnection.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { beginWebsiteGitHubConnection: begin, consumeWebsiteGitHubHandoffFragment: consume,
    listWebsiteGitHubChoices: list, selectWebsiteGitHubRepository: select } = (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  let current = true;
  const scope = { ownerId, projectId, loadSequence: 8, isCurrent: () => current };
  const state = new Map();
  const storage = { setItem: (key, value) => state.set(key, value), getItem: key => state.get(key) ?? null,
    removeItem: key => state.delete(key) };
  const calls = [];
  let pause;
  let fetchStarted;
  const transport = { platformUrl: 'https://platform.example', anonKey: 'public-anon-key',
    getSession: async () => ({ ownerId, accessToken: 'header.payload.signature' }),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      fetchStarted?.();
      if (pause) await pause;
      const action = new URL(url).searchParams.get('action');
      const body = action === 'begin' ? { authorizationUrl: `https://github.com/login/oauth/authorize?client_id=Iv1_fixture&state=${'a'.repeat(64)}` }
        : action === 'options' ? { installations: [{ id: '42', accountId: '17', accountLogin: 'owner', userToken: 'leak' }],
          repositories: [{ id: '88', fullName: 'owner/site', defaultBranch: 'main', secret: 'leak' }], hasMore: false }
          : { status: 'connected', connectionId: handoffId, repositoryId: '88', version: 1 };
      return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify(body) };
    } };
  const authorizationUrl = await begin({ scope, transport, environment: 'production', storage });
  assert.match(authorizationUrl, /^https:\/\/github.com\/login\/oauth\/authorize/);
  assert.equal(calls[0].options.headers.authorization, 'Bearer header.payload.signature');
  assert.deepEqual(JSON.parse(calls[0].options.body), { projectId, environment: 'production' });
  const location = { hash: `#tayar_github_handoff=${handoffId}`, pathname: '/builder', search: '' };
  let cleaned = false;
  const history = { state: null, replaceState: (_state, _title, url) => { assert.equal(url, '/builder'); cleaned = true; } };
  const nextScope = { ...scope, loadSequence: 1 };
  const handoff = consume({ scope: nextScope, location, history, storage });
  assert.equal(cleaned, true);
  assert.deepEqual(handoff, { id: handoffId, ownerId, projectId, loadSequence: 1 });
  assert.equal(state.size, 0);
  const choices = await list({ scope: nextScope, transport, handoff, installationId: '42', page: 1 });
  assert.deepEqual(choices.installations, [{ id: '42', accountId: '17', accountLogin: 'owner' }]);
  assert.deepEqual(choices.repositories, [{ id: '88', fullName: 'owner/site', defaultBranch: 'main' }]);
  assert.ok(!JSON.stringify(choices).includes('leak'));
  assert.deepEqual(await select({ scope: nextScope, transport, handoff, installationId: '42', repositoryId: '88' }),
    { connectionId: handoffId, version: 1 });
  const before = calls.length;
  await assert.rejects(list({ scope: { ...nextScope, ownerId: '44444444-4444-4444-8444-444444444444' }, transport, handoff, page: 1 }), /changed/);
  assert.equal(calls.length, before);
  let releaseFetch;
  pause = new Promise(resolve => { releaseFetch = resolve; });
  const started = new Promise(resolve => { fetchStarted = resolve; });
  const stale = list({ scope: nextScope, transport, handoff, page: 1 });
  await started;
  current = false;
  releaseFetch();
  await assert.rejects(stale, /unavailable|changed/);
  assert.equal(consume({ scope: nextScope, location: { ...location, hash: `#tayar_github_handoff=${handoffId}&extra=1` }, history, storage }), null);
  console.log('PASS GitHub browser handoff: fragment cleanup, owner scope, sanitized options and stale response refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
