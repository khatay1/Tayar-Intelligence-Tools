import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-runtime-verification-'));
try {
  const identityFile = join(dir, 'identity.cjs'), verifierFile = join(dir, 'verifier.cjs');
  await Promise.all([
    build({ entryPoints: ['server/website-owned-release-identity.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: identityFile }),
    build({ entryPoints: ['server/website-owned-runtime-verification.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: verifierFile }),
  ]);
  const { bindOwnedReleaseIdentity: bind, readOwnedReleaseIdentity: read, serveOwnedReleaseIdentity: serve } = (await import(pathToFileURL(identityFile))).default;
  const { verifyOwnedDeployedRuntime: verify } = (await import(pathToFileURL(verifierFile))).default;
  const projectId = '11111111-1111-4111-8111-111111111111';
  const files = [{ path: 'api/application.js', content: await bind('module.exports = () => {};\n', projectId, 'preview') }];
  const identity = await read(files);
  assert.deepEqual(await read(structuredClone(files)), identity);
  assert.equal((await read([{ ...files[0], content: await bind('module.exports = () => 1;\n', projectId, 'preview') }])).runtimeDigest === identity.runtimeDigest, false);
  for (const broken of [[], [files[0], files[0]], [{ ...files[0], content: files[0].content + '\n' }],
    [{ ...files[0], content: files[0].content.replace(projectId, 'not-a-project') }], [{ ...files[0], content: files[0].content.replace('"version":1', '"version":2') }]]) {
    await assert.rejects(read(broken));
  }
  const input = { projectId, environment: 'preview', liveUrl: 'https://customer-preview.vercel.app', files, isCurrent: async () => true };
  let calls = 0, lastChallenge;
  const fetcher = async (url, init) => {
    calls++;
    assert.equal(url.origin, input.liveUrl);
    assert.equal(url.pathname, '/api/application');
    assert.deepEqual(Object.keys(init.headers), ['accept']);
    assert.equal(init.redirect, 'error'); assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store');
    assert.equal(init.method, 'GET'); assert.equal(init.signal.aborted, false);
    assert.notEqual(url.searchParams.get('challenge'), lastChallenge); lastChallenge = url.searchParams.get('challenge');
    return serve(new Request(url, init), identity);
  };
  await verify({ ...input, fetcher }); await verify({ ...input, fetcher }); assert.equal(calls, 2);
  const failure = error => error.message === 'Customer deployed runtime verification is unavailable.';
  for (const liveUrl of ['http://customer-preview.vercel.app', 'https://customer-preview.vercel.app/',
    'https://customer-preview.vercel.app/path', 'https://customer-preview.vercel.app:444',
    'https://customer-preview.vercel.app?url=anything', 'https://customer-preview.vercel.app#fragment',
    'https://customer-preview.vercel.app.evil.example', 'https://customer.example', 'https://127.0.0.1',
    'https://user:password@customer-preview.vercel.app']) {
    await assert.rejects(verify({ ...input, liveUrl, fetcher }), failure);
  }
  await assert.rejects(verify({ ...input, projectId: 'foreign', fetcher }), failure);
  await assert.rejects(verify({ ...input, environment: 'production', fetcher }), failure);
  await assert.rejects(verify({ ...input, isCurrent: async () => false, fetcher }), failure);
  assert.equal(calls, 2, 'Invalid/stale scope fails before a network request');
  for (const mutation of [v => { v.projectId = 'foreign'; }, v => { v.environment = 'production'; },
    v => { v.runtimeDigest = '0'.repeat(64); }, v => { v.challenge = 'cached'; }, v => { v.version = 2; },
    v => { v.secret = 'must-not-escape'; }, v => { delete v.runtimeDigest; }]) {
    await assert.rejects(verify({ ...input, fetcher: async (url, init) => {
      const value = await (await fetcher(url, init)).json(); mutation(value);
      return Response.json(value, { headers: { 'cache-control': 'no-store' } });
    } }), failure);
  }
  let cached;
  const cachedFetcher = async (url, init) => {
    if (!cached) cached = await (await fetcher(url, init)).json();
    return Response.json(cached, { headers: { 'cache-control': 'no-store' } });
  };
  await verify({ ...input, fetcher: cachedFetcher });
  await assert.rejects(verify({ ...input, fetcher: cachedFetcher }), failure, 'Fresh challenge rejects replayed/cached proof');
  for (const response of [() => new Response('login', { status: 401 }), () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }),
    () => Response.json(identity), () => new Response('html', { headers: { 'content-type': 'text/html', 'cache-control': 'no-store' } }),
    () => new Response('{broken', { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }),
    () => Response.json([], { headers: { 'cache-control': 'no-store' } }),
    () => new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })]) {
    await assert.rejects(verify({ ...input, fetcher: async () => response() }), failure);
  }
  for (const declared of [false, true]) {
    let cancelled = false;
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1025)); }, cancel() { cancelled = true; } });
    await assert.rejects(verify({ ...input, fetcher: async () => new Response(body, { headers: {
      'content-type': 'application/json', 'cache-control': 'no-store', ...(declared ? { 'content-length': '1025' } : {}),
    } }) }), failure);
    assert.equal(cancelled, true, 'Oversized declared or streamed response is cancelled');
  }
  let current = true;
  await assert.rejects(verify({ ...input, isCurrent: async () => current, fetcher: async (url, init) => {
    const response = await fetcher(url, init); current = false; return response;
  } }), failure);
  await assert.rejects(verify({ ...input, fetcher: async () => { throw Error('sb_secret_must_not_escape'); } }), failure);
  const originalSetTimeout = globalThis.setTimeout;
  try {
    globalThis.setTimeout = (callback, ms) => { assert.equal(ms, 8000); return originalSetTimeout(callback, 1); };
    await assert.rejects(verify({ ...input, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Error('deadline')), { once: true });
    }) }), failure, 'Unresponsive deployment is bounded by the shared request/body deadline');
  } finally { globalThis.setTimeout = originalSetTimeout; }
  const request = new Request(`${input.liveUrl}/api/application?tayarRoute=release-proof&challenge=${crypto.randomUUID()}`);
  assert.equal(serve(new Request(request, { method: 'POST' }), identity).status, 405);
  for (const suffix of ['&challenge=duplicate', '&tayarRoute=release-proof', '&backend=forged']) {
    assert.equal(serve(new Request(request.url + suffix), identity).status, 400);
  }
  // Exercise the real Preview adapter's callback and its actual network verifier.
  // Only custody/source/store/worker orchestration are isolated; the proof path
  // must consume the captured source, not a client flag or a provider READY bit.
  const adapterFile = join(dir, 'adapter.cjs');
  await build({ entryPoints: ['server/website-byo-publish-adapters.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: adapterFile,
    plugins: [{ name: 'trusted-source-fixtures', setup(builder) {
      builder.onResolve({ filter: /website-owned-source-capture$/ }, () => ({ path: 'capture', namespace: 'fixture' }));
      builder.onLoad({ filter: /^capture$/, namespace: 'fixture' }, () => ({ contents: 'export async function captureWebsiteOwnedApplicationSource(){return globalThis.__runtimeCaptured;} export async function captureWebsiteOwnedProductionSource(){throw Error("Production source must not be used by a Preview proof");}' }));
      builder.onResolve({ filter: /website-byo-publish-store$/ }, () => ({ path: 'store', namespace: 'fixture' }));
      builder.onLoad({ filter: /^store$/, namespace: 'fixture' }, () => ({ contents: 'export function createWebsiteByoPublishStore(){return {read:async()=>({sourceDigest:globalThis.__runtimeCaptured.sourceDigest})};} export async function initializeWebsiteByoPublishOperation(){}' }));
      builder.onResolve({ filter: /\/website-byo-publish-worker$/ }, () => ({ path: 'worker', namespace: 'fixture' }));
      builder.onLoad({ filter: /^worker$/, namespace: 'fixture' }, () => ({ contents: "export async function runByoPublishWorker(input){await input.verifyDeployedRuntime(globalThis.__runtimeCheckpoint);return {status:'ready'};}" }));
    } }],
  });
  const { runWebsiteOwnedByoPublish: publish } = (await import(pathToFileURL(adapterFile))).default;
  globalThis.__runtimeCaptured = { sourceDigest: 'a'.repeat(64), files, isCurrent: async () => true };
  globalThis.__runtimeCheckpoint = { sourceDigest: 'a'.repeat(64), liveUrl: input.liveUrl };
  const options = { client: {}, projectId, ownerId: '22222222-2222-4222-8222-222222222222',
    operationId: '33333333-3333-4333-8333-333333333333', githubConnectionId: '44444444-4444-4444-8444-444444444444',
    vercelConnectionId: '55555555-5555-4555-8555-555555555555', environment: 'preview', platformVercelAccountId: 'team_platform',
    ownerCurrent: async () => true, fetcher };
  assert.equal((await publish(options)).status, 'ready');
  const beforeAdapterFailure = calls;
  globalThis.__runtimeCheckpoint.sourceDigest = 'b'.repeat(64);
  await assert.rejects(publish(options), /BYO publish adapters unavailable/);
  assert.equal(calls, beforeAdapterFailure, 'A different immutable source cannot use the saved deployment');
  globalThis.__runtimeCheckpoint.sourceDigest = 'a'.repeat(64);
  globalThis.__runtimeCaptured.isCurrent = async () => false;
  await assert.rejects(publish(options), /BYO publish adapters unavailable/);
  assert.equal(calls, beforeAdapterFailure);
  console.log('PASS owned deployed runtime verification: exact artifact identity, real handler handshake, replay/tamper/stale/host refusal, no credentials, bounded streams and sanitized failures');
} finally { delete globalThis.__runtimeCaptured; delete globalThis.__runtimeCheckpoint; await rm(dir, { recursive: true, force: true }); }
