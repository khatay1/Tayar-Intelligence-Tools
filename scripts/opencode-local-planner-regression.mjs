import assert from 'node:assert/strict';
import { planWithLocalOpenCode, validateLocalOpenCodeConfig } from '../server/opencode-local-planner.mjs';

const base = {
  enabled: true,
  sandboxed: true,
  offline: true,
  baseUrl: 'http://127.0.0.1:4096',
  providerID: 'ollama',
  modelID: 'qwen2.5-coder:7b',
};
const rejects = async (config, prompt = 'Inspect this isolated project') =>
  assert.rejects(planWithLocalOpenCode({ config, prompt, fetcher: () => {
    throw new Error('network should not be reached');
  }}));
for (const config of [
  { ...base, enabled: false }, { ...base, sandboxed: false },
  { ...base, offline: false }, { ...base, baseUrl: 'https://127.0.0.1:4096' },
  { ...base, baseUrl: 'http://localhost:4096' },
  { ...base, baseUrl: 'http://127.0.0.1:4096@evil.com' },
  { ...base, baseUrl: 'http://127.0.0.1:4096/path' },
  { ...base, baseUrl: 'http://127.0.0.1:4096/?x=1' },
  { ...base, baseUrl: 'http://127.0.0.1:4096#hash' },
  { ...base, providerID: 'openai' }, { ...base, providerID: 'opencode' },
  { ...base, modelID: 'gpt-5' }, // Not inherently a cloud endpoint, local custom IDs permitted.
]) {
  if (config.modelID === 'gpt-5') {
    assert.equal(validateLocalOpenCodeConfig(config).modelID, 'gpt-5');
  } else {
    await rejects(config);
  }
}
for (const modelID of ['my-cloud-model', 'remote-llm', '', '../bad model']) {
  await rejects({ ...base, modelID });
}
await rejects(base, '');
await rejects(base, 'x'.repeat(11000));

const calls = [];
let diff = [];
let model = 'qwen2.5-coder:7b';
let answer = 'Inspect the modules before proposing changes.';
let cleanup = true;
let large = false;
const fetcher = async (input, init) => {
  const url = new URL(input);
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ url, init, body });
  assert.equal(url.origin, 'http://127.0.0.1:4096');
  assert.equal(init.redirect, 'error');
  assert.equal(init.cache, 'no-store');
  if (large && url.pathname.endsWith('/message')) {
    return new Response('x'.repeat(200 * 1024), { status: 200 });
  }
  if (url.pathname === '/session' && init.method === 'POST') {
    return Response.json({ id: 'ses_test_123' });
  }
  if (url.pathname === '/session/ses_test_123/message' && init.method === 'POST') {
    assert.deepEqual(body.model, { providerID: 'ollama', modelID: base.modelID });
    assert.equal(body.agent, 'plan');
    assert.equal(body.tools['*'], false);
    assert.equal(body.tools.bash, undefined);
    assert.deepEqual(Object.entries(body.tools).filter(([,value]) => value)
      .map(([key]) => key).sort(), ['glob', 'grep', 'read']);
    return Response.json({
      info: { role: 'assistant', providerID: 'ollama', modelID: model },
      parts: [{ type: 'text', text: answer }],
    });
  }
  if (url.pathname === '/session/ses_test_123/diff' && init.method === 'GET') {
    return Response.json(diff);
  }
  if (url.pathname === '/session/ses_test_123' && init.method === 'DELETE') {
    return Response.json(cleanup);
  }
  throw new Error('unexpected mocked endpoint');
};
const input = { config: base, prompt: 'Inspect this isolated project', fetcher };
assert.deepEqual(await planWithLocalOpenCode(input), {
  plan: answer, providerID: 'ollama', modelID: base.modelID, mode: 'read-only',
});
assert.equal(calls.filter(x => x.init.method === 'DELETE').length, 1);
assert.equal(calls.filter(x => x.init.method === 'POST').length, 2);
calls.length = 0;
diff = [{ path: 'src/App.tsx', additions: 1 }];
await assert.rejects(planWithLocalOpenCode(input), { code: 'unexpected-file-mutation' });
assert.equal(calls.filter(x => x.init.method === 'DELETE').length, 1);
diff = [];
model = 'openai';
await assert.rejects(planWithLocalOpenCode(input), { code: 'invalid-model-response' });
model = base.modelID;
answer = 'x'.repeat(17 * 1024);
await assert.rejects(planWithLocalOpenCode(input), { code: 'invalid-plan' });
answer = 'safe output';
cleanup = false;
await assert.rejects(planWithLocalOpenCode(input), { code: 'session-cleanup-failed' });
cleanup = true;
large = true;
await assert.rejects(planWithLocalOpenCode(input), { code: 'response-too-large' });
large = false;
assert.equal(calls.filter(x => x.init.method === 'DELETE').length >= 5, true);
console.log('OpenCode local read-only planner regression passed.');
