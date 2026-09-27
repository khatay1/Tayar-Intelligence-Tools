import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-browser-bridge-'));
const originals = Object.fromEntries(['window', 'navigator', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const bridges = [];
try {
  const outfile = join(dir, 'bridge.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-browser-session.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createApplicationBrowserSessionBridge: create } = (await import(pathToFileURL(outfile))).default;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const options = { projectId, ownerId: '11111111-1111-4111-8111-111111111111', applicationOrigin: `https://${projectId}.apps.tayar.example`, platformOrigin: 'https://tayar.se' };
  let session = { access_token: 'header.first.signature', refresh_token: 'REFRESH_MUST_NOT_LEAVE' };
  let sessionError = null, fetchFailure = false, inFlight = 0, maximum = 0, pause;
  const callbacks = new Set(), calls = [];
  const client = { auth: {
    async getSession() { return { data: { session }, error: sessionError }; },
    onAuthStateChange(callback) { callbacks.add(callback); return { data: { subscription: { unsubscribe: () => callbacks.delete(callback) } } }; },
  } };
  // A shared, deterministic Web Locks stand-in tests scheduling across bridge
  // instances. This does not claim real browser/tab verification.
  const queues = new Map();
  const locks = { request(name, { signal, mode }, callback) {
    assert.equal(mode, 'exclusive');
    const previous = queues.get(name) ?? Promise.resolve();
    const result = previous.then(() => { signal.throwIfAborted(); return callback(); });
    queues.set(name, result.catch(() => {}));
    return result;
  } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: options.applicationOrigin } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  globalThis.fetch = async (url, init) => {
    calls.push({ url, ...init });
    maximum = Math.max(maximum, ++inFlight);
    try {
      if (pause) { const current = pause; pause = undefined; await current; }
      if (fetchFailure) throw new Error('SECRET_TRANSPORT_ERROR');
      init.signal.throwIfAborted();
      return Response.json({ status: init.method === 'POST' ? 'synchronized' : 'signed-out' });
    } finally { inFlight--; }
  };
  const a = create(client, options), b = create(client, options);
  bridges.push(a, b);
  await a.synchronize();
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].headers.authorization, 'Bearer header.first.signature');
  assert.equal(calls[0].credentials, 'same-origin');
  assert.equal(calls[0].redirect, 'error');
  assert.equal(calls[0].cache, 'no-store');
  assert.equal(calls[0].url, `${options.applicationOrigin}/api/application-session?ownerId=${options.ownerId}&projectId=${projectId}`);
  assert.ok(!JSON.stringify(calls).includes(session.refresh_token));

  let release;
  pause = new Promise(resolve => { release = resolve; });
  const first = a.synchronize();
  await new Promise(resolve => setImmediate(resolve));
  const queued = b.synchronize();
  session = null; // logout in another tab before the queued task acquires its lock
  release();
  await Promise.all([first, queued]);
  assert.equal(maximum, 1);
  assert.equal(calls.at(-1).method, 'DELETE', 'Queued sync reads the latest persisted session, not an earlier event token');
  assert.deepEqual(calls.at(-1).headers, {});

  session = { access_token: 'header.refreshed.signature', refresh_token: 'STILL_PRIVATE' };
  const beforeEvent = calls.length;
  callbacks.forEach(callback => callback('TOKEN_REFRESHED', session));
  assert.equal(calls.length, beforeEvent, 'Auth callback must not await SDK methods while its lock is held');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(calls.at(-1).headers.authorization, 'Bearer header.refreshed.signature');
  session = null;
  callbacks.forEach(callback => callback('SIGNED_OUT', null));
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(calls.at(-1).method, 'DELETE');

  fetchFailure = true;
  await assert.rejects(a.synchronize(), { message: 'Application session synchronization is unavailable.' });
  assert.equal(a.status().unavailable, true);
  fetchFailure = false;
  await a.synchronize();
  assert.equal(a.status().unavailable, false);
  sessionError = new Error('PRIVATE_AUTH_ERROR');
  const beforeError = calls.length;
  await assert.rejects(a.synchronize(), { message: 'Application session synchronization is unavailable.' });
  assert.equal(calls.length, beforeError);
  sessionError = null;
  session = { access_token: 'bad-token' };
  await assert.rejects(a.synchronize());
  assert.equal(calls.length, beforeError);

  assert.throws(() => create(client, { ...options, projectId: options.ownerId }));
  assert.throws(() => create(client, { ...options, applicationOrigin: options.platformOrigin }));
  assert.throws(() => create(client, { ...options, platformOrigin: options.applicationOrigin }));
  window.location.origin = 'https://unrelated.example';
  assert.throws(() => create(client, options));
  window.location.origin = options.applicationOrigin;
  navigator.locks = undefined;
  assert.throws(() => create(client, options));
  navigator.locks = locks;

  session = null;
  pause = new Promise(resolve => { release = resolve; });
  const pending = a.synchronize();
  const denied = assert.rejects(pending, { message: 'Application session synchronization is unavailable.' });
  await new Promise(resolve => setImmediate(resolve));
  const pendingCall = calls.at(-1);
  a.dispose();
  assert.equal(pendingCall.signal.aborted, true);
  release();
  await denied;
  b.dispose();
  assert.equal(callbacks.size, 0);
  await assert.rejects(a.synchronize());
  assert.equal(a.status().disposed, true);
  console.log('PASS simulated browser bridge: latest-session lock ordering, refresh/logout handoff, no refresh-token transport, origin isolation, safe errors and disposal');
} finally {
  bridges.forEach(bridge => bridge.dispose());
  for (const [key, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
  await rm(dir, { recursive: true, force: true });
}
