import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-custom-operation-client-'));
try {
  const outfile = join(dir, 'client.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-custom-operation-client.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile });
  const require = createRequire(import.meta.url);
  const { createPublishedCustomOperationClient, PublishedCustomOperationClientError } = require(outfile);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const releaseId = '33333333-3333-4333-8333-333333333333';
  const userId = '44444444-4444-4444-8444-444444444444';
  const token = 'header.payload.signature';
  let calls = 0, captured;
  const auth = {
    async getSession() { return { data: { session: { access_token: token } }, error: null }; },
    async getUser(value) { return { data: { user: value === token ? { id: userId, is_anonymous: false } : null }, error: null }; },
  };
  const client = createPublishedCustomOperationClient({ auth }, {
    ownerId, projectId, releaseId, applicationOrigin: 'https://app.example.test', operationIds: ['adjust_stock'],
  }, async (request, init) => {
    calls++;
    captured = { url: String(request), init };
    return Response.json({ result: { changed: 1 } });
  });
  assert.deepEqual(await client.execute('adjust_stock', { sku: 'A-1', delta: -1 }, userId), { changed: 1 });
  assert.equal(calls, 1);
  assert.equal(new URL(captured.url).origin, 'https://app.example.test');
  assert.equal(new URL(captured.url).pathname, '/api/application-operation');
  assert.equal(new URL(captured.url).searchParams.get('ownerId'), ownerId);
  assert.equal(new URL(captured.url).searchParams.get('projectId'), projectId);
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.credentials, 'same-origin');
  assert.equal(captured.init.redirect, 'error');
  assert.equal(captured.init.headers.authorization, `Bearer ${token}`);
  assert.deepEqual(JSON.parse(captured.init.body), {
    releaseId, operationId: 'adjust_stock', input: { sku: 'A-1', delta: -1 },
  });

  await assert.rejects(client.execute('unlisted', {}, userId), error => error.code === 'operation-not-found');
  const cyclic = {}; cyclic.self = cyclic;
  await assert.rejects(client.execute('adjust_stock', cyclic, userId), error => error.code === 'invalid-input');
  assert.equal(calls, 1);

  const envelopeBoundaryInput = { payload: 'x'.repeat(32 * 1024 - 64) };
  assert.ok(new TextEncoder().encode(JSON.stringify(envelopeBoundaryInput)).byteLength < 32 * 1024);
  const envelopeBoundary = createPublishedCustomOperationClient({ auth }, {
    ownerId, projectId, releaseId, applicationOrigin: 'https://app.example.test', operationIds: ['adjust_stock'],
  }, async () => { calls++; return Response.json({ result: true }); });
  await assert.rejects(envelopeBoundary.execute('adjust_stock', envelopeBoundaryInput, userId),
    error => error.code === 'invalid-input', 'request envelope must fit the server route limit');
  assert.equal(calls, 1, 'oversized request envelope is rejected before network access');

  const nearLimitResult = 'x'.repeat(32 * 1024 - 4);
  const responseBody = JSON.stringify({ result: nearLimitResult });
  assert.ok(new TextEncoder().encode(responseBody).byteLength > 32 * 1024);
  assert.ok(new TextEncoder().encode(responseBody).byteLength < 33 * 1024);
  const responseBoundary = createPublishedCustomOperationClient({ auth }, {
    ownerId, projectId, releaseId, applicationOrigin: 'https://app.example.test', operationIds: ['adjust_stock'],
  }, async () => new Response(responseBody, { headers: { 'content-type': 'application/json', 'content-length': String(new TextEncoder().encode(responseBody).byteLength) } }));
  assert.equal(await responseBoundary.execute('adjust_stock', {}, userId), nearLimitResult,
    'valid maximum-sized operation output fits the response envelope');

  const anonymous = createPublishedCustomOperationClient({ auth: {
    async getSession() { return { data: { session: { access_token: token } }, error: null }; },
    async getUser() { return { data: { user: { id: userId, is_anonymous: true } }, error: null }; },
  } }, { ownerId, projectId, releaseId, applicationOrigin: 'https://app.example.test', operationIds: ['adjust_stock'] }, async () => {
    calls++; return Response.json({ result: null });
  });
  await assert.rejects(anonymous.execute('adjust_stock', {}, userId), error => error.code === 'not-authorized');
  assert.equal(calls, 1);

  const denied = createPublishedCustomOperationClient({ auth }, {
    ownerId, projectId, releaseId, applicationOrigin: 'https://app.example.test', operationIds: ['adjust_stock'],
  }, async () => new Response(JSON.stringify({ error: 'not_authorized' }), { status: 403 }));
  await assert.rejects(denied.execute('adjust_stock', {}, userId), error => error instanceof PublishedCustomOperationClientError && error.code === 'not-authorized');
  console.log('Published custom operation browser client regression passed.');
} finally { await rm(dir, { recursive: true, force: true }); }
