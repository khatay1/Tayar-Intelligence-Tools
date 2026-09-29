import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-browser-'));
try {
  const outfile = join(dir, 'browser.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteVercelBrowserConnection.ts'],
    bundle: true, platform: 'node', format: 'cjs', outfile });
  const { beginWebsiteVercelConnection: begin, consumeWebsiteVercelHandoffFragment: consume,
    listWebsiteVercelChoices: list, selectWebsiteVercelProject: select } =
    (await import(pathToFileURL(outfile))).default;
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  let current = true, pause, fetchStarted;
  const scope = { ownerId, projectId, loadSequence: 7, isCurrent: () => current };
  const state = new Map();
  const storage = { setItem: (key, value) => state.set(key, value), getItem: key => state.get(key) ?? null,
    removeItem: key => state.delete(key) };
  const calls = [];
  const response = { userId: 'user_customer1234', accountId: 'team_customer1234',
    configurationId: 'icfg_customer1234', projects: [{ projectId: 'prj_booking1234',
      projectName: 'booking-production', accountId: 'team_customer1234', accountType: 'team',
      productionBranch: 'tayar/booking/production', accessToken: 'leak' }] };
  const transport = { platformUrl: 'https://platform.example', anonKey: 'public-anon-key',
    getSession: async () => ({ ownerId, accessToken: 'header.payload.signature' }),
    fetcher: async (url, options) => {
      calls.push({ url, options }); fetchStarted?.(); if (pause) await pause;
      const action = new URL(url).searchParams.get('action');
      const body = action === 'begin' ? { authorizationUrl:
        `https://vercel.com/integrations/tayar-connect/new?state=${'a'.repeat(64)}` }
        : action === 'options' ? response : { status: 'connected', connectionId: handoffId,
          accountId: response.accountId, vercelProjectId: response.projects[0].projectId, version: 1 };
      return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify(body) };
    } };
  const authorizationUrl = await begin({ scope, transport, environment: 'production', storage });
  assert.match(authorizationUrl, /^https:\/\/vercel\.com\/integrations\/tayar-connect\/new/);
  assert.equal(calls[0].options.headers.authorization, 'Bearer header.payload.signature');
  assert.deepEqual(JSON.parse(calls[0].options.body), { projectId, environment: 'production' });
  const location = { hash: `#tayar_vercel_handoff=${handoffId}`, pathname: '/builder', search: '?project=1' };
  let cleaned = false;
  const history = { state: null, replaceState: (_state, _title, url) => {
    assert.equal(url, '/builder?project=1'); cleaned = true; } };
  const nextScope = { ...scope, loadSequence: 8 };
  const handoff = consume({ scope: nextScope, location, history, storage });
  assert.equal(cleaned, true);
  assert.deepEqual(handoff, { id: handoffId, ownerId, projectId, loadSequence: 8 });
  assert.equal(state.size, 0);
  const choices = await list({ scope: nextScope, transport, handoff });
  assert.equal(choices.accountId, response.accountId);
  assert.deepEqual(choices.projects, response.projects.map(({ accessToken: _ignored, ...item }) => item));
  assert.ok(!JSON.stringify(choices).includes('leak'));
  assert.deepEqual(await select({ scope: nextScope, transport, handoff, userId: choices.userId,
    accountId: choices.accountId, configurationId: choices.configurationId,
    vercelProjectId: choices.projects[0].projectId }), { connectionId: handoffId, version: 1 });
  const bindBody = JSON.parse(calls.at(-1).options.body);
  assert.equal(bindBody.vercelProjectId, choices.projects[0].projectId);
  assert.equal('repositoryId' in bindBody, false);
  const before = calls.length;
  await assert.rejects(list({ scope: { ...nextScope, projectId: '44444444-4444-4444-8444-444444444444' },
    transport, handoff }), /changed/);
  assert.equal(calls.length, before);
  let releaseFetch;
  pause = new Promise(resolve => { releaseFetch = resolve; });
  const started = new Promise(resolve => { fetchStarted = resolve; });
  const stale = list({ scope: nextScope, transport, handoff });
  await started; current = false; releaseFetch();
  await assert.rejects(stale, /unavailable|changed/);
  assert.equal(consume({ scope: nextScope, location: { ...location,
    hash: `#tayar_vercel_handoff=${handoffId}&extra=1` }, history, storage }), null);
  console.log('PASS Vercel browser handoff: fragment cleanup, owner scope, sanitized choices, trusted GitHub target and stale response refusal');
} finally { await rm(dir, { recursive: true, force: true }); }

