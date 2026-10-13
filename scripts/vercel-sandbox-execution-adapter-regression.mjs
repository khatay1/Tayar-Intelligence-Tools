import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-vercel-sandbox-'));
try {
  const entry = join(dir, 'adapter.ts'), outfile = join(dir, 'adapter.cjs');
  await writeFile(entry, [
    `export { runIsolatedCustomCode } from ${JSON.stringify(resolve('server/isolated-code-execution'))};`,
    `export { createVercelSandboxExecutionAdapter } from ${JSON.stringify(resolve('server/vercel-sandbox-execution-adapter'))};`,
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { runIsolatedCustomCode, createVercelSandboxExecutionAdapter } = (await import(pathToFileURL(outfile))).default;
  const calls = [];
  let resultText = JSON.stringify({ value: 7 });
  let exitCode = '0';
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, headers: new Headers(init.headers), body });
    if (url.pathname === '/v2/sandboxes' && method === 'POST') {
      return Response.json({ session: { id: 'sbx_test_1' } }, { status: 201 });
    }
    if (url.pathname.endsWith('/cmd') && method === 'POST') {
      return Response.json({ command: { id: 'cmd_test_1' } }, { status: 201 });
    }
    if (url.pathname.endsWith('/cmd/cmd_test_1') && method === 'GET') {
      return Response.json({ command: { exitCode } });
    }
    if (url.pathname.endsWith('/cmd/cmd_test_1/logs') && method === 'GET') {
      return new Response(`${JSON.stringify({ stream: 'stdout', data: resultText })}\n`, {
        status: 200, headers: { 'content-type': 'application/x-ndjson' },
      });
    }
    if (url.pathname.endsWith('/stop') && method === 'POST') return Response.json({ session: { id: 'sbx_test_1' } });
    throw new Error(`Unexpected mocked request: ${method} ${url.pathname}`);
  };

  const adapter = createVercelSandboxExecutionAdapter({ token: 'test-only-token', projectId: 'prj_test', teamId: 'team_test', fetcher });
  const request = { source: 'return { value: input.left + input.right }', input: { left: 3, right: 4 }, timeoutMs: 1000 };
  assert.deepEqual(await runIsolatedCustomCode(request, adapter), { value: 7 });

  const createCall = calls.find(call => call.url.pathname === '/v2/sandboxes');
  assert.equal(createCall.url.origin, 'https://api.vercel.com');
  assert.equal(createCall.url.searchParams.get('teamId'), 'team_test');
  assert.equal(createCall.headers.get('authorization'), 'Bearer test-only-token');
  assert.deepEqual(createCall.body.networkPolicy, {
    mode: 'custom', allowedDomains: [], allowedCIDRs: [], deniedCIDRs: [],
  });
  assert.deepEqual(createCall.body.resources, { vcpus: '1', memory: '2048' });
  assert.equal(createCall.body.runtime, 'node22');
  assert.equal(createCall.body.projectId, 'prj_test');
  assert.equal(createCall.body.persistent, false);
  assert.equal(createCall.body.timeout, 31000, 'VM expiry includes bounded startup time');
  for (const key of ['env', 'source', 'mounts', 'networkId']) assert.equal(key in createCall.body, false);

  const commandCall = calls.find(call => call.url.pathname.endsWith('/cmd') && call.method === 'POST');
  assert.equal(commandCall.body.command, 'node');
  assert.equal(commandCall.body.sudo, false);
  assert.equal(commandCall.body.wait, false);
  assert.equal(commandCall.body.timeout, request.timeoutMs);
  assert.equal(commandCall.body.args[2], request.source);
  assert.deepEqual(JSON.parse(commandCall.body.args[3]), request.input);
  assert.equal(JSON.stringify(commandCall.body).includes('test-only-token'), false);
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/stop')).length, 1);

  calls.length = 0;
  exitCode = '1';
  await assert.rejects(runIsolatedCustomCode(request, adapter), error => error.code === 'execution-failed');
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/stop')).length, 1, 'failed commands must stop the VM');

  calls.length = 0;
  exitCode = '0';
  resultText = 'x'.repeat(32 * 1024 + 1);
  await assert.rejects(runIsolatedCustomCode(request, adapter), error => error.code === 'output-too-large');
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/stop')).length, 1, 'oversized output must stop the VM');

  assert.throws(() => createVercelSandboxExecutionAdapter({ token: '' }), /credentials are unavailable/);
  assert.throws(() => createVercelSandboxExecutionAdapter({ token: 'test-token', projectId: 'prj_test', teamId: 'bad/team' }), /team scope is invalid/);
  assert.throws(() => createVercelSandboxExecutionAdapter({ token: 'test-token', projectId: 'bad/project' }), /project scope is invalid/);
  console.log('Vercel Sandbox execution adapter regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
