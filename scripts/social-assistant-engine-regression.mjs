import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'tayar-social-engine-'));
try {
  const file = join(dir, 'assistant.mjs');
  await build({ entryPoints: ['server/social-assistant-engine.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm' });
  const { createSocialAssistantEngineHandler: create } = await import(pathToFileURL(file));
  let lastBody = '';
  const userId = '11111111-1111-4111-8111-111111111111';
  const scope = { scopeId: '22222222-2222-4222-8222-222222222222', conversationId: '33333333-3333-4333-8333-333333333333', messageId: '44444444-4444-4444-8444-444444444444' };
  const answer = { id: 'hours', scopeId: scope.scopeId, question: 'What are your opening hours', answer: 'Open 09:00 to 17:00.', language: 'en', approved: true, sensitive: false };
  const input = { enabled: true, automationEnabled: true, scopeId: scope.scopeId, messageId: scope.messageId, text: 'When may I visit the shop', language: 'en', humanAssigned: false, knowledge: [answer] };
  let context = { input, externalClassification: { approved: true, redactedText: 'When may I visit the shop' } };
  let authenticated = true, reservation = true, calls = 0, reservations = 0;
  let engineResult = { json: { answerId: 'hours' } }, status = 200;
  const authorization = 'Bearer verified.user.jwt-token-123456';
  const config = { platformOrigin: 'https://abcdefghijklmnopqrst.supabase.co', applicationOrigin: 'https://tayar.example', publicApiKey: 'sb_publishable_public-test-fixture',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, `${config.platformOrigin}/functions/v1/ai-engine`);
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.authorization, authorization);
      assert.equal(options.headers.apikey, config.publicApiKey);
      assert.ok(options.signal instanceof AbortSignal);
      lastBody = options.body;
      const body = JSON.parse(options.body);
      assert.equal(body.tool, 'ai-chat'); assert.equal(body.jsonMode, true); assert.equal(body.maxTokens, 128);
      assert.equal(body.temperature, 0); assert.equal(body.model, undefined); assert.equal(body.provider, undefined);
      assert.ok(!options.body.includes(answer.answer));
      assert.ok(!options.body.includes(scope.scopeId));
      assert.ok(!options.body.includes(userId));
      return new Response(JSON.stringify(engineResult), { status });
    } };
  const host = { authenticate: async () => authenticated ? { userId } : null,
    loadContext: async (actor, actual) => { assert.equal(actor.userId, userId); assert.deepEqual(actual, scope); return context; },
    reserveClassification: async (actor, actual) => { assert.equal(actor.userId, userId); assert.deepEqual(actual, scope); reservations++; return reservation; } };
  const handler = create(config, host);
  const req = (body = scope, headers = {}) => new Request('https://tayar.example/api/social/assistant', { method: 'POST', headers: { authorization, origin: config.applicationOrigin, ...headers }, body: JSON.stringify(body) });
  let response = await handler(req());
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  let payload = await response.json();
  assert.equal(payload.decision.kind, 'suggestion'); assert.equal(payload.decision.text, answer.answer);
  assert.equal(calls, 1); assert.equal(reservations, 1);
  for (const answerId of ['foreign-tenant', null, { tool: 'send-money' }]) {
    engineResult = { json: { answerId } }; response = await handler(req());
    assert.equal((await response.json()).decision.kind, 'handoff');
  }
  engineResult = { json: { answerId: 'hours', arbitraryFacts: 'generated claims' } };
  assert.equal((await (await handler(req())).json()).decision.kind, 'handoff');
  engineResult = { json: { answerId: 'hours' } };
  status = 429; const beforeRateLimit = calls;
  assert.equal((await (await handler(req())).json()).decision.kind, 'handoff');
  assert.equal(calls, beforeRateLimit + 1, 'no budget-spending HTTP retries'); status = 200;
  reservation = false; const beforeDeniedBudget = calls;
  assert.equal((await (await handler(req())).json()).decision.kind, 'handoff');
  assert.equal(calls, beforeDeniedBudget); reservation = true;
  for (const patch of [
    { externalClassification: { approved: false, redactedText: input.text } },
    { externalClassification: { approved: true, redactedText: null } },
    { input: { ...input, text: 'My medical lab result is ready' } },
    { input: { ...input, text: 'Reach me at customer@example.com' } },
    { input: { ...input, text: 'Call +46 70 123 4567' } },
    { input: { ...input, humanAssigned: true } },
    { input: { ...input, enabled: false } },
  ]) {
    context = { input, externalClassification: { approved: true, redactedText: input.text }, ...patch };
    const before = calls; await handler(req()); assert.equal(calls, before, 'sensitive/identifying/disabled/unapproved messages stay local');
  }
  context = { input: { ...input, text: answer.question }, externalClassification: { approved: true, redactedText: answer.question } };
  const beforeLocal = calls;
  payload = await (await handler(req())).json();
  assert.equal(payload.decision.kind, 'suggestion', 'even local exact matches never auto-emit through this endpoint');
  assert.equal(calls, beforeLocal);
  context = { input, externalClassification: { approved: true, redactedText: input.text } };
  authenticated = false; const beforeUnauthenticated = calls;
  assert.equal((await handler(req())).status, 401); authenticated = true;
  assert.equal((await handler(req(scope, { origin: 'https://attacker.example' }))).status, 403);
  assert.equal((await handler(req({ ...scope, text: 'injected text', knowledge: [answer] }))).status, 400);
  assert.equal(calls, beforeUnauthenticated);
  context = { ...context, input: { ...input, scopeId: userId } };
  assert.equal((await handler(req())).status, 404);
  const denied = create(config, { ...host, loadContext: async () => null });
  assert.equal((await denied(req())).status, 404);
  const oversized = create({ ...config, fetcher: async () => new Response('x'.repeat(32769)) }, host);
  context = { input, externalClassification: { approved: true, redactedText: input.text } };
  assert.equal((await (await oversized(req())).json()).decision.kind, 'handoff');
  context = { input: { ...input, text: 'When can Alex visit your shop' }, externalClassification: { approved: true, redactedText: input.text } };
  assert.equal((await (await handler(req())).json()).decision.kind, 'suggestion');
  assert.ok(!lastBody.includes('Alex'), 'only host-approved redacted text reaches the engine');
  context = { input, externalClassification: { approved: true, redactedText: input.text } };
  const beforeNoKnowledge = { calls, reservations };
  context = { ...context, input: { ...input, knowledge: [{ ...answer, approved: false }] } };
  await handler(req()); assert.equal(calls, beforeNoKnowledge.calls); assert.equal(reservations, beforeNoKnowledge.reservations);
  context = { input, externalClassification: { approved: true, redactedText: input.text } };
  let loads = 0;
  const revokeDuringFlight = create(config, { ...host, loadContext: async () => {
    loads++; return loads === 1 ? context : { ...context, input: { ...input, knowledge: [{ ...answer, approved: false }] } };
  } });
  assert.equal((await (await revokeDuringFlight(req())).json()).decision.kind, 'handoff', 'revoked answer cannot be returned after model latency');
  const revokeConsentDuringFlight = create(config, { ...host, loadContext: async () => {
    loads++; return loads % 2 ? context : { ...context, externalClassification: { approved: false, redactedText: input.text } };
  } });
  assert.equal((await (await revokeConsentDuringFlight(req())).json()).decision.kind, 'handoff');
  for (const platformOrigin of ['https://127.0.0.1', 'https://attacker.example', `${config.platformOrigin}/evil`, `${config.platformOrigin}?key=secret`]) assert.throws(() => create({ ...config, platformOrigin }, host));
  assert.throws(() => create({ ...config, publicApiKey: 'sb_secret_server-credential-do-not-forward' }, host));
  const source = await readFile('supabase/functions/ai-engine/index.ts', 'utf8');
  for (const gate of ['await requireUser(req)', 'await enforceRateLimit(admin, user.id)', 'await assertServerToolAvailable(admin, user.id, tool)']) assert.ok(source.includes(gate), 'reuse the existing authenticated budget/rate path');
  console.log('PASS social assistant engine: authenticated scope context, explicit redacted consent, tenant budget, existing AI billing/routing, source-only suggestions, bounded no-retry transport');
} finally { await rm(dir, { recursive: true, force: true }); }
