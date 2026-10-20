import assert from 'node:assert/strict';
import { createLocalOpenCodeAgent } from '../server/opencode-local-agent.ts';

const calls = [];
let providerURL = 'http://127.0.0.1:11434/v1';
let oversize = false;
let rejectPrompt = false;
let deleteCount = 0;
const fetcher = async (input, init = {}) => {
  const url = new URL(input);
  const method = init.method ?? 'GET';
  const body = init.body && JSON.parse(init.body);
  calls.push({ method, path: url.pathname, headers: new Headers(init.headers), body, redirect: init.redirect });
  if (url.pathname === '/global/health') return Response.json({ healthy: true, version: '1.0.0' });
  if (url.pathname === '/config') return Response.json({ provider: { ollama: { options: { baseURL: providerURL }, models: { 'local-coder:7b': { name: 'test local model' } } } } });
  if (url.pathname === '/session' && method === 'POST') return Response.json({ id: 'ses_local_1' });
  if (url.pathname === '/session/ses_local_1/message') {
    if (rejectPrompt) return new Response('failure', { status: 503 });
    if (oversize) return Response.json({ unexpected: 'a'.repeat(270_000) });
    return Response.json({ info: {}, parts: [{ type: 'text', text: 'Patched source.' }] });
  }
  if (url.pathname === '/session/ses_local_1/diff') return Response.json([{ file: 'src/app.ts', additions: 1 }]);
  if (url.pathname === '/session/ses_local_1/abort') return Response.json(true);
  if (url.pathname === '/session/ses_local_1' && method === 'DELETE') { deleteCount++; return Response.json(true); }
  throw Error('Unexpected request');
};
const options = {
  enabled: true, endpoint: 'http://127.0.0.1:4096/', serverPassword: 'fixture-password-123',
  workspaceDirectory: '/workspace/fixture_project', isolatedWorkspaceConfirmed: true,
  modelId: 'local-coder:7b', fetcher,
};
const adapter = createLocalOpenCodeAgent(options);
assert.deepEqual(await adapter.probe(), { healthy: true, version: '1.0.0' });
assert.deepEqual(await adapter.run({ task: 'Make a small test change', approved: true }),
  { summary: 'Patched source.', changedFiles: ['src/app.ts'] });
assert.equal(deleteCount, 1);
const prompt = calls.find(c => c.path.endsWith('/message'));
assert.deepEqual(prompt.body.model, { providerID: 'ollama', modelID: 'local-coder:7b' });
assert.equal(prompt.body.tools.bash, false);
assert.equal(prompt.body.tools.webfetch, false);
assert.equal(prompt.body.tools.task, false);
assert.equal(prompt.headers.get('x-opencode-directory'), '/workspace/fixture_project');
assert.equal(prompt.headers.get('authorization'), `Basic ${Buffer.from('opencode:fixture-password-123').toString('base64')}`);
assert.equal(prompt.redirect, 'error');
assert.equal(JSON.stringify(prompt.body).includes('fixture-password-123'), false);
assert.ok(calls.every(c => c.headers.get('authorization')));
for (const candidate of ['http://example.com:4096/', 'https://127.0.0.1:4096/', 'http://127.0.0.1:4096/else', 'http://user@127.0.0.1:4096/', 'http://localhost:4096/', 'http://127.0.0.1:4096/?redirect=evil']) {
  await assert.rejects(createLocalOpenCodeAgent({ ...options, endpoint: candidate }).probe(), e => e.code === 'invalid-configuration');
}
for (const workspaceDirectory of ['/tmp/other', '/workspace/../escape', '/workspace/.env', '/workspace/a/b']) {
  await assert.rejects(createLocalOpenCodeAgent({ ...options, workspaceDirectory }).probe(), e => e.code === 'invalid-configuration');
}
for (const broken of [{ enabled: false }, { enabled: true, isolatedWorkspaceConfirmed: false }, { enabled: true, serverPassword: '' }, { enabled: true, modelId: 'bad?model' }]) {
  await assert.rejects(createLocalOpenCodeAgent({ ...options, ...broken }).probe(), e => ['disabled', 'invalid-configuration'].includes(e.code));
}
const before = calls.length;
await assert.rejects(adapter.run({ task: 'Do work', approved: false }), e => e.code === 'not-approved');
await assert.rejects(adapter.run({ task: 'X'.repeat(6001), approved: true }), e => e.code === 'invalid-configuration');
assert.equal(calls.length, before, 'unapproved and oversized requests make zero API calls');
providerURL = 'https://api.provider.example/v1';
await assert.rejects(adapter.run({ task: 'Do work', approved: true }), e => e.code === 'unsafe-provider');
assert.equal(calls.filter(c => c.path === '/session' && c.method === 'POST').length, 1, 'unsafe provider never creates a session');
providerURL = 'http://127.0.0.1:11434/v1';
rejectPrompt = true;
await assert.rejects(adapter.run({ task: 'Do work', approved: true }), e => e.code === 'unavailable');
assert.equal(deleteCount, 2, 'failed prompt aborts then deletes session');
assert.ok(calls.some(c => c.path.endsWith('/abort')));
rejectPrompt = false;
oversize = true;
await assert.rejects(adapter.run({ task: 'Do work', approved: true }), e => e.code === 'invalid-response');
assert.equal(deleteCount, 3, 'oversized reply deletes session');
console.log('OpenCode local agent regression passed (fully mocked, zero outbound/provider calls).');
