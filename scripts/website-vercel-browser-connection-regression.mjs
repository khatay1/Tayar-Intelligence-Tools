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
    listWebsiteVercelChoices: list, selectWebsiteVercelProject: select,
    disconnectWebsiteVercelConnection: disconnect } =
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
  const connection = { id: handoffId, ownerId, projectId, provider: 'vercel', environment: 'production',
    accountId: response.accountId, targetId: response.projects[0].projectId, permissions: ['project:read'],
    status: 'connected', version: 1, verifiedAt: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z' };
  const disconnectCalls = [];
  let uncertain = true;
  const disconnectTransport = { ...transport, fetcher: async (url, options) => {
    disconnectCalls.push({ url, options });
    if (uncertain) { uncertain = false; throw new Error('response lost'); }
    return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify({
      status: 'disconnected', connectionId: handoffId, version: 2, installation: 'retained',
    }) };
  } };
  const ids = ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'];
  await assert.rejects(disconnect({ scope: nextScope, transport: disconnectTransport, connection, storage,
    randomUUID: () => ids.shift() }), /unavailable/);
  assert.equal(state.size, 1, 'uncertain response retains the exact disconnect identity');
  const firstDisconnectBody = JSON.parse(disconnectCalls[0].options.body);
  assert.deepEqual(firstDisconnectBody, { projectId, connectionId: handoffId, expectedVersion: 1,
    operationId: '55555555-5555-4555-8555-555555555555',
    commitId: '66666666-6666-4666-8666-666666666666' });
  assert.deepEqual(await disconnect({ scope: nextScope, transport: disconnectTransport, connection, storage,
    randomUUID: () => { throw new Error('retry must reuse IDs'); } }), { connectionId: handoffId, version: 2 });
  assert.deepEqual(JSON.parse(disconnectCalls[1].options.body), firstDisconnectBody);
  assert.equal(state.size, 0, 'verified disconnect clears the pending identity');
  await assert.rejects(disconnect({ scope: nextScope, transport: disconnectTransport,
    connection: { ...connection, ownerId: '44444444-4444-4444-8444-444444444444' }, storage }), /changed/);
  assert.equal(disconnectCalls.length, 2, 'cross-owner disconnect is refused before HTTP');
  let releaseFetch;
  pause = new Promise(resolve => { releaseFetch = resolve; });
  const started = new Promise(resolve => { fetchStarted = resolve; });
  const stale = list({ scope: nextScope, transport, handoff });
  await started; current = false; releaseFetch();
  await assert.rejects(stale, /unavailable|changed/);
  assert.equal(consume({ scope: nextScope, location: { ...location,
    hash: `#tayar_vercel_handoff=${handoffId}&extra=1` }, history, storage }), null);
  console.log('PASS Vercel browser handoff: sanitized binding plus stable receipt-aware disconnect retry and stale scope refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
