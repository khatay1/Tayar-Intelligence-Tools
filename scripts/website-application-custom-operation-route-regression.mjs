import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-operation-route-'));
try {
  const outfile = join(dir, 'custom-operation-route.cjs');
  await build({ entryPoints: ['server/website-application-custom-operation-route.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { servePublishedCustomOperationRequest } = (await import(pathToFileURL(outfile))).default;
  const order = [];
  const dependencies = {
    enabled: true,
    async authorize(request, accessToken) { order.push(['authorize', request.ownerId, request.projectId, accessToken]); return true; },
    async loadOperation(input) {
      assert.deepEqual(Object.keys(input).sort(), ['input', 'operationId', 'ownerId', 'projectId', 'releaseId']);
      return { releaseId: 'release_1', operationId: 'op_1', source: 'source-from-release' };
    },
    async reserveUsage(input) {
      assert.deepEqual(Object.keys(input).sort(), ['input', 'operationId', 'ownerId', 'projectId', 'releaseId']);
      return 'reservation-1';
    },
    async completeUsage(_reservationId, input) {
      assert.deepEqual(Object.keys(input).sort(), ['input', 'operationId', 'ownerId', 'projectId', 'releaseId']);
      order.push(['complete']); return true;
    },
    adapter: { async create() { return { async execute() { return { ok: true }; }, async stop() {} }; } },
  };
  const invoke = (body, options = {}) => servePublishedCustomOperationRequest({
    request: new Request(options.url ?? 'https://app.example/api/application-operation', {
      method: options.method ?? 'POST',
      headers: {
        origin: options.origin ?? 'https://app.example',
        authorization: options.authorization ?? 'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signature',
        'content-type': options.contentType ?? 'application/json',
        ...(options.contentLength ? { 'content-length': options.contentLength } : {}),
        ...(options.fetchSite ? { 'sec-fetch-site': options.fetchSite } : {}),
      },
      ...(options.method === 'GET' ? {} : { body }),
    }),
    ownerId: 'owner_1', projectId: 'project_1', applicationOrigin: 'https://app.example', dependencies,
  });

  const success = await invoke(JSON.stringify({ releaseId: 'release_1', operationId: 'op_1', input: { value: 3 } }));
  assert.equal(success.status, 200, `${await success.clone().text()} ${JSON.stringify(order)}`);
  assert.deepEqual(await success.json(), { result: { ok: true } });
  assert.deepEqual(order, [['authorize', 'owner_1', 'project_1', 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyIn0.signature'], ['complete']]);

  assert.equal((await invoke(JSON.stringify({ releaseId: 'release_1', operationId: 'op_1', input: {} }), { authorization: '' })).status, 401);
  assert.equal((await invoke(JSON.stringify({ releaseId: 'release_1', operationId: 'op_1', input: {} }), { authorization: 'Bearer malformed' })).status, 401);

  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{},"source":"client"}')).status, 400);
  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{}}', { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{}}', { fetchSite: 'cross-site' })).status, 403);
  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{}}', { contentType: 'application/jsonp' })).status, 415);
  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{}}', { contentLength: '40000' })).status, 400);
  assert.equal((await invoke(JSON.stringify({ releaseId: 'release_1', operationId: 'op_1', input: 'x'.repeat(33 * 1024) }))).status, 400);
  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{}}', { url: 'https://app.example/api/application-operation?ownerId=other' })).status, 404);
  assert.equal((await invoke('{"releaseId":"release_1","operationId":"op_1","input":{}}', { method: 'GET' })).status, 405);
  console.log('Published custom operation HTTP route regression passed.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
