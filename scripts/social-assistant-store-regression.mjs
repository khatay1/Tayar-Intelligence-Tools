import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-social-assistant-store-'));
try {
  await build({ entryPoints: ['server/social-assistant-store.ts', 'server/social-assistant-engine.ts'], bundle: true, platform: 'node', format: 'cjs', outdir: dir });
  const store = (await import(pathToFileURL(join(dir, 'social-assistant-store.js')))).default;
  const { createSocialAssistantEngineHandler } = (await import(pathToFileURL(join(dir, 'social-assistant-engine.js')))).default;
  const userId = '11111111-1111-4111-8111-111111111111';
  const scope = { scopeId: '22222222-2222-4222-8222-222222222222', conversationId: '33333333-3333-4333-8333-333333333333', messageId: '44444444-4444-4444-8444-444444444444' };
  const knowledge = { id: 'hours', scopeId: scope.scopeId, question: 'What are your opening hours', answer: 'Open 09:00 to 17:00.', language: 'en', approved: true, sensitive: false };
  let anonymous = false, budget = true, rpcError = false, modelCalls = 0, reservations = 0;
  let context = { input: { enabled: true, automationEnabled: true, scopeId: scope.scopeId, messageId: scope.messageId, text: knowledge.question, language: 'en', humanAssigned: false, knowledge: [knowledge] }, externalClassification: { approved: false, redactedText: null } };
  const client = { auth: { async getUser(token) { assert.equal(token, 'verified-user-session-token'); return { data: { user: { id: userId, is_anonymous: anonymous } } }; } },
    async rpc(name, args) {
      assert.deepEqual(args, { p_scope_id: scope.scopeId, p_conversation_id: scope.conversationId, p_message_id: scope.messageId });
      if (rpcError) return { error: new Error('private database details') };
      if (name === 'get_social_hub_assistant_context') return { data: structuredClone(context) };
      if (name === 'reserve_social_hub_assistant_classification') { reservations++; return { data: budget }; }
      assert.fail('Unexpected RPC');
    } };
  const config = { platformOrigin: 'https://abcdefghijklmnopqrst.supabase.co', publicApiKey: 'sb_publishable_fixture_public_key', applicationOrigin: 'https://app.example',
    fetcher: async (url, options) => {
      assert.equal(url, 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/ai-engine');
      assert.ok(!options.body.includes(knowledge.answer)); modelCalls++;
      return Response.json({ json: { answerId: knowledge.id } });
    } };
  const request = () => new Request('https://app.example/api/social-assistant', { method: 'POST', headers: { origin: config.applicationOrigin, authorization: 'Bearer verified-user-session-token' }, body: JSON.stringify(scope) });
  const host = store.createSocialAssistantRpcHost(client);
  assert.equal(await host.loadContext({ userId }, scope), null, 'RPC context cannot be read before verified authentication');
  const handler = createSocialAssistantEngineHandler(config, host);
  const local = await (await handler(request())).json();
  assert.equal(local.decision.kind, 'suggestion'); assert.equal(local.decision.text, knowledge.answer); assert.equal(modelCalls, 0);
  const trustedInput = { ...context.input, text: 'When may I visit the shop' };
  context = { input: trustedInput, externalClassification: { approved: true, redactedText: trustedInput.text } };
  const classified = await (await handler(request())).json();
  assert.equal(classified.decision.kind, 'suggestion'); assert.equal(modelCalls, 1); assert.equal(reservations, 1);
  budget = false; assert.equal((await (await handler(request())).json()).decision.kind, 'handoff'); assert.equal(modelCalls, 1);
  assert.equal(await host.reserveClassification({ userId: scope.scopeId }, scope), false);
  context.input.knowledge[0].scopeId = userId;
  assert.equal((await handler(request())).status, 404, 'malformed cross-scope RPC results are denied');
  anonymous = true; assert.equal((await handler(request())).status, 401); anonymous = false;
  rpcError = true; const failed = await handler(request()); assert.equal(failed.status, 404); assert.ok(!(await failed.text()).includes('database details'));
  for (const environment of [{}, { SOCIAL_HUB_ENABLED: 'true' }, { SOCIAL_HUB_ENABLED: 'true', SOCIAL_ASSISTANT_ENABLED: 'true', SUPABASE_URL: 'https://attacker.example' }]) {
    assert.equal((await store.createSocialAssistantDeployment(environment)(request())).status, 503);
  }
  console.log('PASS Social Assistant RPC host: verified user, exact scoped context, local/model suggestion, quota denial, foreign data denial, sanitized errors and separate disabled flag');
} finally { await rm(dir, { recursive: true, force: true }); }
