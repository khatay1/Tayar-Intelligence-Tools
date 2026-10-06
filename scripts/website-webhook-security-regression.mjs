import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-webhook-'));
try {
  const outfile = join(dir, 'webhook.cjs');
  await build({ entryPoints: ['supabase/functions/_shared/website-webhook-security.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { validWebsiteWebhookDestination: valid, deliverSignedWebsiteWebhook: deliver, publicWebhookAddress: publicAddress, sendPinnedWebsiteWebhook: pinned } = (await import(pathToFileURL(outfile))).default;
  for (const value of ['http://example.com', 'https://127.0.0.1/hook', 'https://[::1]/hook', 'https://localhost/hook', 'https://dev.internal/hook', 'https://example.com:8443/hook', 'https://user:pass@example.com/hook', 'https://example.com/hook?api_key=secret', 'https://example.com/hook#fragment']) assert.equal(valid(value), false, value);
  assert.equal(valid('https://hooks.example.com/notify'), true);
  for (const host of ['fcloud.example.com', 'fdomain.example.com', 'feb.example.com']) {
    assert.equal(valid(`https://${host}/notify`), true, 'IPv6 prefix checks must not reject DNS names');
  }
  let sent = 0;
  const send = async (_url, options) => { sent++; assert.equal(options.redirect, 'error'); assert.equal(options.method, 'POST'); assert.match(options.headers['X-Tayar-Signature'], /^[a-f0-9]{64}$/); assert.equal(options.body, '{"event":"test"}'); return new Response(null, { status: 204 }); };
  await assert.rejects(deliver('https://hooks.example.com/notify', '{}', '', send), /signing/);
  await assert.rejects(deliver('https://127.0.0.1/hook', '{}', 'secret', send), /destination/);
  assert.equal(sent, 0, 'No network call before validation and signing');
  const response = await deliver('https://hooks.example.com/notify', '{"event":"test"}', 'secret', send);
  assert.equal(response.status, 204);
  assert.equal(sent, 1);
  for (const address of ['127.0.0.1', '10.1.2.3', '100.64.0.1', '169.254.169.254', '172.31.255.255', '192.168.1.2', '192.0.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1', 'bad', '1.2.3.999']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('93.184.216.34'), true);
  let connected = 0, closed = 0, resolved = 0, wire = '';
  const network = {
    async resolve() { resolved++; return ['93.184.216.34']; },
    async connect(address, hostname) {
      connected++;
      assert.equal(address, '93.184.216.34'); assert.equal(hostname, 'hooks.example.com');
      let response = new TextEncoder().encode('HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n');
      return { async write(bytes) { const n = Math.min(bytes.length, 7); wire += new TextDecoder().decode(bytes.subarray(0, n)); return n; },
        async read(bytes) { const n = Math.min(bytes.length, response.length, 9); if (!n) return null; bytes.set(response.subarray(0, n)); response = response.subarray(n); return n; }, close() { closed++; } };
    },
  };
  assert.equal((await pinned('https://hooks.example.com/notify', { body: '{}' }, network)).status, 204);
  assert.equal(resolved, 1, 'DNS is resolved only once, even if it changes after validation');
  assert.match(wire, /host: hooks.example.com/i); assert.match(wire, /content-length: 2/i); assert.equal(closed, 1);
  for (const answers of [[], ['10.0.0.1'], ['93.184.216.34', '127.0.0.1'], ['::ffff:127.0.0.1']]) {
    await assert.rejects(pinned('https://hooks.example.com/', {}, { ...network, resolve: async () => answers }), /DNS/);
  }
  assert.equal(connected, 1, 'Unsafe/mixed DNS answers never open a socket');
  const responseNetwork = (text) => ({ ...network, connect: async () => ({ async write(bytes) { return bytes.length; }, async read(bytes) { bytes.set(new TextEncoder().encode(text).subarray(0, bytes.length)); return Math.min(text.length, bytes.length); }, close() { closed++; } }) });
  await assert.rejects(pinned('https://hooks.example.com/', {}, responseNetwork('HTTP/1.1 302 Found\r\nLocation: https://127.0.0.1/\r\n\r\n')), /redirects/);
  await assert.rejects(pinned('https://hooks.example.com/', {}, responseNetwork('X'.repeat(8192))), /too large/);
  const abort = new AbortController();
  let closeOnAbort = 0;
  const pending = pinned('https://hooks.example.com/', { signal: abort.signal }, { ...network, connect: async () => ({ async write(bytes) { return bytes.length; }, read: () => new Promise(() => {}), close() { closeOnAbort++; } }) });
  await new Promise(resolve => setTimeout(resolve, 0)); abort.abort(new Error('cancelled'));
  await assert.rejects(pending, /cancelled/); assert.ok(closeOnAbort >= 1);
  console.log('PASS signed webhook: unsafe/mixed DNS blocked, pinned IP and TLS hostname, redirects denied, bounded headers, partial IO and abort cleanup');
} finally { await rm(dir, { recursive: true, force: true }); }
