import assert from 'node:assert/strict';
import handler from '../api/website-domain.js';
const projectId = '22222222-2222-2222-8222-222222222222';
const userId = '11111111-1111-1111-1111-111111111111';
const originalFetch = globalThis.fetch;
let existing, requests, providerStatus, misconfigured, storeFailure, deleteStatus, verified;
function reset() { existing = null; requests = []; providerStatus = 200; misconfigured = false; storeFailure = false; deleteStatus = 200; verified = true; }
async function call(body) {
  const res = { statusCode: 200, setHeader() {}, end(value) { this.data = JSON.parse(value); } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer test' }, body: Buffer.isBuffer(body) ? body : { projectId, ...body } }, res);
  return res;
}
try {
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input); const method = options.method || 'GET';
    requests.push({ path: url.pathname, method });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: userId });
    if (url.pathname === '/rest/v1/projects') {
      assert.equal(url.searchParams.get('type'), 'eq.website-builder');
      assert.equal(url.searchParams.get('deleted_at'), 'is.null');
      return Response.json([{ id: projectId, user_id: userId }]);
    }
    if (url.pathname === '/rest/v1/website_custom_domains') {
      if (method === 'GET') return Response.json(existing ? [existing] : []);
      if (storeFailure) return Response.json({ error: 'database unavailable' }, { status: 500 });
      if (method === 'DELETE') { existing = null; return new Response(null, { status: 204 }); }
      const next = JSON.parse(options.body);
      existing = { ...next, id: 'domain-id' };
      return Response.json([existing]);
    }
    if (method === 'DELETE') return Response.json({}, { status: deleteStatus });
    if (url.pathname.endsWith('/verify')) return Response.json({ verified: true });
    if (url.pathname.endsWith('/config')) return Response.json({ misconfigured });
    return Response.json(providerStatus === 200 ? { verified, name: 'www.example.com' } : { error: { message: 'provider rejected' } }, { status: providerStatus });
  };
  reset();
  assert.equal((await call({ action: 'unknown' })).statusCode, 400);
  assert.equal(requests.filter((r) => r.method !== 'GET').length, 0);
  assert.equal((await call({ action: 'check', hostname: 'www.example.com' })).statusCode, 400);
  assert.equal(existing, null);
  const buffer = Buffer.from(JSON.stringify({ projectId, action: 'connect', hostname: 'www.example.com' }));
  assert.equal((await call(buffer)).statusCode, 200);
  assert.equal(existing.status, 'verified');
  assert.equal((await call({ action: 'check', hostname: 'other.example.com' })).statusCode, 400);
  console.log('PASS action validation, Buffer JSON parsing, project eligibility and check hostname isolation');

  misconfigured = true;
  assert.equal((await call({ action: 'check' })).statusCode, 200);
  assert.equal(existing.status, 'misconfigured', 'ownership verification alone does not imply DNS readiness');
  misconfigured = false; verified = false;
  assert.equal((await call({ action: 'check' })).statusCode, 200);
  assert.equal(existing.status, 'verified');
  assert.ok(requests.some((r) => r.path.endsWith('/verify') && r.method === 'POST'));
  console.log('PASS independent DNS readiness and ownership challenge verification');

  reset(); providerStatus = 409;
  assert.equal((await call({ action: 'connect', hostname: 'www.example.com' })).statusCode, 409);
  assert.equal(existing, null);
  assert.equal(requests.filter((r) => r.method === 'DELETE').length, 0);
  reset(); providerStatus = 404;
  assert.equal((await call({ action: 'connect', hostname: 'www.example.com' })).statusCode, 502);
  assert.equal(existing, null);
  reset(); storeFailure = true;
  assert.equal((await call({ action: 'connect', hostname: 'www.example.com' })).statusCode, 500);
  assert.ok(requests.some((r) => r.method === 'DELETE' && r.path.includes('/domains/')));
  assert.equal(existing, null);
  console.log('PASS provider errors never become ready mappings; failed persistence cleans new registration');

  reset(); await call({ action: 'connect', hostname: 'www.example.com' });
  deleteStatus = 409;
  assert.equal((await call({ action: 'remove' })).statusCode, 409);
  assert.ok(existing, 'failed provider deletion must retain mapping for retry');
  deleteStatus = 404;
  assert.equal((await call({ action: 'remove' })).statusCode, 200);
  assert.equal(existing, null, 'already removed provider domain is safe to detach');
  console.log('PASS failed deletion retains mapping and missing provider domain can detach');
} finally { globalThis.fetch = originalFetch; }
