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
  const { validWebsiteWebhookDestination: valid, deliverSignedWebsiteWebhook: deliver } = (await import(pathToFileURL(outfile))).default;
  for (const value of ['http://example.com', 'https://127.0.0.1/hook', 'https://[::1]/hook', 'https://localhost/hook', 'https://dev.internal/hook', 'https://example.com:8443/hook', 'https://user:pass@example.com/hook', 'https://example.com/hook?api_key=secret', 'https://example.com/hook#fragment']) assert.equal(valid(value), false, value);
  assert.equal(valid('https://hooks.example.com/notify'), true);
  let sent = 0;
  const send = async (_url, options) => { sent++; assert.equal(options.redirect, 'error'); assert.equal(options.method, 'POST'); assert.match(options.headers['X-Tayar-Signature'], /^[a-f0-9]{64}$/); assert.equal(options.body, '{"event":"test"}'); return new Response(null, { status: 204 }); };
  await assert.rejects(deliver('https://hooks.example.com/notify', '{}', '', send), /signing/);
  await assert.rejects(deliver('https://127.0.0.1/hook', '{}', 'secret', send), /destination/);
  assert.equal(sent, 0, 'No network call before validation and signing');
  const response = await deliver('https://hooks.example.com/notify', '{"event":"test"}', 'secret', send);
  assert.equal(response.status, 204);
  assert.equal(sent, 1);
  console.log('PASS outbound webhook refuses unsigned or unsafe targets and forbids redirects');
} finally { await rm(dir, { recursive: true, force: true }); }
