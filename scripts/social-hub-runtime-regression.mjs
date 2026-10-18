import assert from 'node:assert/strict';
import { createServer, request as nodeRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createSocialHubNodeHandler } from '../server/social-hub-http.js';
import { createSocialHubDeployment } from '../server/generated/social-hub-deployment.js';
const origin = 'https://app.example';
const raw = Buffer.from('{"text":"مرحبا","space":  true}');
const calls = [];
const deployment = {
  async connect(request) { calls.push(request); return new Response('callback', { status: 202, headers: { 'cache-control': 'no-store' } }); },
  async webhook(request, id) {
    assert.equal(id, 'a'.repeat(32)); assert.equal(request.headers.get('x-hub-signature-256'), 'sha256=fixture');
    assert.deepEqual(Buffer.from(await request.arrayBuffer()), raw); calls.push(request);
    return new Response(null, { status: 200 });
  },
};
let handler = createSocialHubNodeHandler({ kind: 'webhook', origin, deployment });
const server = createServer((req, res) => void handler(req, res));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
function send(path, { method = 'POST', headers = {}, body = raw } = {}) {
  return new Promise((resolve, reject) => {
    const req = nodeRequest({ host: '127.0.0.1', port: server.address().port, path, method,
      headers: { host: 'app.example', 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=fixture', ...headers } }, res => {
      const chunks = []; res.on('data', x => chunks.push(x)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); req.end(method === 'POST' ? body : undefined);
  });
}
try {
  const valid = await send('/api/social-webhook?id=' + 'a'.repeat(32)); assert.equal(valid.status, 200);
  assert.equal(valid.headers['cache-control'], 'private, no-store'); assert.equal(calls.length, 1);
  assert.equal((await send('/api/social-webhook?id=' + 'a'.repeat(32) + '&id=other')).status, 400);
  assert.equal((await send('/api/social-webhook?id=' + 'a'.repeat(32), { headers: { host: 'attacker.example' } })).status, 503);
  assert.equal((await send('https://attacker.example/api/social-webhook?id=' + 'a'.repeat(32))).status, 503);
  assert.equal((await send('/api/social-webhook?id=' + 'a'.repeat(32), { headers: { 'content-encoding': 'gzip' } })).status, 415);
  assert.equal((await send('/api/social-webhook?id=' + 'a'.repeat(32), { method: 'PUT' })).status, 405);
  handler = createSocialHubNodeHandler({ kind: 'connect', origin, deployment });
  assert.equal((await send('/api/social-connect-callback?state=fixture', { method: 'GET' })).status, 202);
  assert.equal((await send('/api/social-connect?action=start')).status, 202);
  assert.equal((await send('/api/social-connect', { body: 'x'.repeat(16385), headers: { 'content-length': '16385' } })).status, 413);
  const disabled = createSocialHubDeployment({});
  assert.equal((await disabled.connect(new Request(origin))).status, 503);
  assert.equal((await disabled.webhook(new Request(origin), 'a'.repeat(32))).status, 503);
  const malformed = createSocialHubDeployment({ SOCIAL_HUB_ENABLED: 'true', SUPABASE_URL: 'https://attacker.example', SUPABASE_SECRET_KEY: 'fixture' });
  assert.equal((await malformed.webhook(new Request(origin), 'a'.repeat(32))).status, 503);
  for (const file of ['social-connect', 'social-webhook']) {
    const entry = await readFile(`api/${file}.js`, 'utf8'); assert.match(entry, /bodyParser: false/); assert.match(entry, /createSocialHubDeployment\(process.env\)/);
  }
  console.log('PASS Social Hub Node routes: real HTTP raw bytes, fixed host/path, origin rejection, callback routing, body/encoding limits, no-store and disabled deployment');
} finally { await new Promise(resolve => server.close(resolve)); }
