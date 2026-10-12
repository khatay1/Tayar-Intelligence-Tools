import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-isolated-code-'));
try {
  const outfile = join(dir, 'isolated-code.cjs');
  await build({ entryPoints: ['server/isolated-code-execution.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { runIsolatedCustomCode, IsolatedExecutionError } = (await import(pathToFileURL(outfile))).default;
  const request = { source: 'export default input => ({ total: input.a + input.b })', input: { a: 2, b: 5 }, timeoutMs: 150 };
  const created = [], counters = { stopped: 0 };
  const fakeAdapter = {
    async create(options) {
      created.push(options);
      return {
        async execute(source, input) {
          assert.equal(source, request.source);
          assert.deepEqual(input, request.input);
          return { total: 7 };
        },
        async stop() { counters.stopped += 1; },
      };
    },
  };

  assert.deepEqual(await runIsolatedCustomCode(request, fakeAdapter), { total: 7 });
  assert.deepEqual(created[0], {
    runtime: 'node22', networkPolicy: 'deny-all', persistent: false,
    timeoutMs: 150, resources: { vcpus: 1 },
  });
  assert.equal(counters.stopped, 1, 'successful execution must discard its sandbox');
  await assert.rejects(runIsolatedCustomCode(request), error => error instanceof IsolatedExecutionError && error.code === 'adapter-unavailable');
  await assert.rejects(runIsolatedCustomCode({ ...request, timeoutMs: 10_001 }, fakeAdapter), error => error.code === 'invalid-request');
  await assert.rejects(runIsolatedCustomCode({ ...request, input: { value: undefined } }, fakeAdapter), error => error.code === 'invalid-request');
  const unsafeInput = {};
  Object.defineProperty(unsafeInput, 'value', { enumerable: true, get() { throw new Error('getter must not escape'); } });
  await assert.rejects(runIsolatedCustomCode({ ...request, input: unsafeInput }, fakeAdapter), error => error.code === 'invalid-request');
  await assert.rejects(runIsolatedCustomCode({ ...request, source: 'x'.repeat(64 * 1024 + 1) }, fakeAdapter), error => error.code === 'invalid-request');

  const timeoutAdapter = { async create() {
    return { execute: () => new Promise(() => {}), async stop() { counters.stopped += 1; } };
  } };
  await assert.rejects(runIsolatedCustomCode(request, timeoutAdapter), error => error.code === 'execution-timeout');
  assert.equal(counters.stopped, 2, 'timed-out execution must stop its sandbox');

  const oversizedAdapter = { async create() {
    return { async execute() { return 'x'.repeat(32 * 1024 + 1); }, async stop() { counters.stopped += 1; } };
  } };
  await assert.rejects(runIsolatedCustomCode(request, oversizedAdapter), error => error.code === 'output-too-large');
  assert.equal(counters.stopped, 3, 'oversized output must stop its sandbox');
  console.log('Isolated custom code execution boundary regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
