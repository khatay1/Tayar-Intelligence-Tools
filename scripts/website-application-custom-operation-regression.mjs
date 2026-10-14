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
  const authorizationOutfile = join(dir, 'custom-operation-authorization.cjs');
  await build({ entryPoints: ['server/website-application-custom-operation-authorization.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: authorizationOutfile });
  const { authorizePublishedCustomOperationActor } = (await import(pathToFileURL(authorizationOutfile))).default;
  const request = { ownerId: 'owner_1', projectId: 'project_1', releaseId: 'release_1', operationId: 'calculate_1', input: { value: 4 } };
  const order = [];
  const dependencies = {
    enabled: true,
    async authorize(value) { order.push(['authorize', value]); return true; },
    async loadOperation(value) { order.push(['load', value]); return { releaseId: request.releaseId, operationId: request.operationId, source: 'source-from-release' }; },
    async reserveUsage(value) { order.push(['reserve', value]); return 'reservation-1'; },
    async completeUsage(id, value, durationMs, status) { order.push(['complete', id, value, durationMs, status]); return true; },
    adapter: { async create(options) {
      order.push(['create', options]);
      return { async execute(source, input) { order.push(['execute', source, input]); return { result: 8 }; }, async stop() { order.push(['stop']); } };
    } },
  };

  assert.deepEqual(await runPublishedCustomOperation(request, dependencies), { result: 8 });
  assert.deepEqual(order.map(entry => entry[0]), ['authorize', 'load', 'reserve', 'create', 'execute', 'stop', 'complete']);
  assert.equal(order.at(-1)[4], 'success');
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
  let failedUsageStatus;
  await assert.rejects(runPublishedCustomOperation(request, {
    ...dependencies,
    async completeUsage(_id, _value, _duration, status) { failedUsageStatus = status; return true; },
    adapter: { async create() { return { async execute() { throw new Error('synthetic failure'); }, async stop() {} }; } },
  }), error => error instanceof PublishedCustomOperationError && error.code === 'execution-failed');
  assert.equal(failedUsageStatus, 'error', 'failed sandbox work remains billable but is not reported as successful');
  console.log('Published custom operation fail-closed regression passed.');

  const backend = { url: 'https://abcdefghijklmnopqrst.supabase.co', publishableKey: 'sb_publishable_test', projectRef: 'abcdefghijklmnopqrst' };
  const authorizationSpec = {
    actors: [{ id: 'staff', name: 'Staff', roleId: 'staff_role' }, { id: 'viewer', name: 'Viewer' }],
    operations: [{ id: 'calculate_1', execution: 'custom', actorIds: ['staff'], source: 'return input;' }],
  };
  const token = 'header.payload.signature';
  const calls = [];
  const authorized = await authorizePublishedCustomOperationActor({ backend, expectedProjectRef: backend.projectRef,
    accessToken: token, specification: authorizationSpec, operationId: 'calculate_1', fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      return String(url).endsWith('/auth/v1/user')
        ? Response.json({ id: '123e4567-e89b-42d3-a456-426614174000', is_anonymous: false, user_metadata: { role: 'staff_role' } })
        : Response.json(['staff_role']);
    } });
  assert.deepEqual(authorized, { userId: '123e4567-e89b-42d3-a456-426614174000' });
  assert.deepEqual(calls.map(call => new URL(call.url).pathname), ['/auth/v1/user', '/rest/v1/rpc/app_my_roles']);
  assert.ok(calls.every(call => call.init.headers.authorization === `Bearer ${token}`
    && call.init.headers.apikey === backend.publishableKey && call.init.redirect === 'error' && call.init.cache === 'no-store'));
  assert.equal(calls[1].init.body, '{}');
  assert.equal(await authorizePublishedCustomOperationActor({ backend, expectedProjectRef: backend.projectRef,
    accessToken: token, specification: authorizationSpec, operationId: 'calculate_1', fetcher: async url => {
      return String(url).endsWith('/auth/v1/user')
        ? Response.json({ id: '123e4567-e89b-42d3-a456-426614174000', is_anonymous: false,
          user_metadata: { role: 'staff_role' } })
        : Response.json({ unexpected: 'shape' });
    } }), null, 'editable user_metadata must not grant an application role');
  assert.equal(await authorizePublishedCustomOperationActor({ backend, expectedProjectRef: backend.projectRef,
    accessToken: token, specification: { ...authorizationSpec, operations: [{ ...authorizationSpec.operations[0], actorIds: ['staff'] }] },
    operationId: 'calculate_1', fetcher: async () => Response.json({ id: '123e4567-e89b-42d3-a456-426614174000' }) }),
  null, 'a malformed role-RPC response must fail closed');
  assert.equal(await authorizePublishedCustomOperationActor({ backend, expectedProjectRef: backend.projectRef,
    accessToken: token, specification: authorizationSpec, operationId: 'calculate_1', fetcher: async () => Response.json({
      id: '123e4567-e89b-42d3-a456-426614174000', is_anonymous: true,
    }) }), null, 'anonymous sessions cannot invoke custom operations');
  assert.equal(await authorizePublishedCustomOperationActor({ backend: { ...backend, url: 'https://attacker.example' },
    expectedProjectRef: backend.projectRef, accessToken: token, specification: authorizationSpec,
    operationId: 'calculate_1', fetcher: async () => { throw new Error('must not fetch'); } }), null,
  'a mismatched backend must be rejected before network access');
  console.log('Published custom operation actor authorization regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
