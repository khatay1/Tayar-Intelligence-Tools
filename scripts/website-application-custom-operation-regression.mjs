import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-published-custom-operation-'));
try {
  const outfile = join(dir, 'custom-operation.cjs');
  await build({ entryPoints: ['server/website-application-custom-operation.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { runPublishedCustomOperation, PublishedCustomOperationError } = (await import(pathToFileURL(outfile))).default;
  const request = { ownerId: 'owner_1', projectId: 'project_1', releaseId: 'release_1', operationId: 'calculate_1', input: { value: 4 } };
  const order = [];
  const dependencies = {
    enabled: true,
    async authorize(value) { order.push(['authorize', value]); return true; },
    async loadOperation(value) { order.push(['load', value]); return { releaseId: request.releaseId, operationId: request.operationId, source: 'source-from-release' }; },
    async reserveUsage(value) { order.push(['reserve', value]); return 'reservation-1'; },
    async completeUsage(id, value) { order.push(['complete', id, value]); return true; },
    adapter: { async create(options) {
      order.push(['create', options]);
      return { async execute(source, input) { order.push(['execute', source, input]); return { result: 8 }; }, async stop() { order.push(['stop']); } };
    } },
  };

  assert.deepEqual(await runPublishedCustomOperation(request, dependencies), { result: 8 });
  assert.deepEqual(order.map(entry => entry[0]), ['authorize', 'load', 'reserve', 'create', 'execute', 'stop', 'complete']);
  assert.equal(order.find(entry => entry[0] === 'execute')[1], 'source-from-release', 'source is resolved from the immutable release');
  assert.equal(order.find(entry => entry[0] === 'create')[1].networkPolicy, 'deny-all');

  let executed = false;
  const blocked = { ...dependencies, adapter: { async create() { executed = true; throw Error(); } } };
  await assert.rejects(runPublishedCustomOperation(request, { ...blocked, enabled: false }),
    error => error instanceof PublishedCustomOperationError && error.code === 'disabled');
  await assert.rejects(runPublishedCustomOperation(request, { ...blocked, authorize: async () => false }),
    error => error instanceof PublishedCustomOperationError && error.code === 'not-authorized');
  await assert.rejects(runPublishedCustomOperation(request, { ...blocked, reserveUsage: async () => null }),
    error => error instanceof PublishedCustomOperationError && error.code === 'unavailable');
  await assert.rejects(runPublishedCustomOperation(request, { ...blocked, loadOperation: async () => ({ releaseId: 'other_release', operationId: request.operationId, source: 'untrusted' }) }),
    error => error instanceof PublishedCustomOperationError && error.code === 'unavailable');
  await assert.rejects(runPublishedCustomOperation(request, { ...blocked, loadOperation: async () => ({ releaseId: request.releaseId, operationId: 'different_operation', source: 'untrusted' }) }),
    error => error instanceof PublishedCustomOperationError && error.code === 'unavailable');
  await assert.rejects(runPublishedCustomOperation(request, { ...blocked, loadOperation: async () => ({ releaseId: request.releaseId, operationId: request.operationId, source: 'source', ownerId: 'attacker' }) }),
    error => error instanceof PublishedCustomOperationError && error.code === 'unavailable');
  await assert.rejects(runPublishedCustomOperation({ ...request, source: 'client-controlled' }, dependencies),
    error => error instanceof PublishedCustomOperationError && error.code === 'invalid-request');
  assert.equal(executed, false, 'denied or unreserved operations never create an execution sandbox');
  await assert.rejects(runPublishedCustomOperation(request, { ...dependencies, completeUsage: async () => false }),
    error => error instanceof PublishedCustomOperationError && error.code === 'unavailable');
  let finalizedThrownNull = false;
  await assert.rejects(runPublishedCustomOperation(request, {
    ...dependencies,
    async completeUsage() { finalizedThrownNull = true; return true; },
    adapter: { async create() { return { async execute() { throw null; }, async stop() {} }; } },
  }), error => error instanceof PublishedCustomOperationError && error.code === 'execution-failed');
  assert.equal(finalizedThrownNull, true, 'non-Error execution failures are surfaced only after usage is finalized');
  console.log('Published custom operation fail-closed regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
