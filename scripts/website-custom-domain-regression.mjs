import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile('supabase/migrations/20260920090000_website_custom_domains.sql', 'utf8');
const grantFix = await readFile('supabase/migrations/20260920143000_restrict_website_custom_domain_writes.sql', 'utf8');
const client = await readFile('src/modules/website-builder/services/websiteDomainService.ts', 'utf8');
assert.match(migration, /enable row level security/i);
assert.match(migration, /revoke all .* anon/i);
assert.match(migration, /grant select .* authenticated/i);
assert.doesNotMatch(migration, /grant select, insert|for insert to authenticated|for update to authenticated/i);
assert.match(migration, /revoke all .* authenticated/i);
assert.match(grantFix, /revoke insert, update, delete/i);
assert.doesNotMatch(client, /SERVICE_ROLE|VERCEL_TOKEN|VERCEL_PROJECT_ID/);

const domainApi = (await import('../api/website-domain.js')).default;
const publishedApi = (await import('../api/published-site.js')).default;
const middleware = (await import('../middleware.js')).default;

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.VERCEL_TOKEN = 'vercel';
process.env.VERCEL_PROJECT_ID = 'tayar-project';
process.env.TAYAR_CANONICAL_ORIGIN = 'https://tayar.se';

function responseCapture() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(value = '') { this.body = String(value); },
  };
}

const originalFetch = globalThis.fetch;
try {
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    requests.push({ target, options });
    if (target.endsWith('/auth/v1/user')) return Response.json({ id: '11111111-1111-1111-1111-111111111111' });
    if (target.includes('/rest/v1/projects?')) return Response.json([{ id: '22222222-2222-2222-8222-222222222222', user_id: '11111111-1111-1111-1111-111111111111' }]);
    if (target.includes('/rest/v1/website_custom_domains?project_id=')) return Response.json([]);
    if (target.includes('/v10/projects/tayar-project/domains')) return Response.json({ name: 'www.example.com', verified: false, verification: [{ type: 'TXT', domain: '_vercel', value: 'verify-me' }] });
    if (target.includes('/rest/v1/website_custom_domains?on_conflict=')) return Response.json([{ id: 'domain', hostname: 'www.example.com', status: 'pending', verification: [] }]);
    throw new Error(`Unexpected request: ${target}`);
  };
  const req = { method: 'POST', headers: { authorization: 'Bearer user-token' }, body: { action: 'connect', projectId: '22222222-2222-2222-8222-222222222222', hostname: 'https://www.example.com/path' } };
  const invalidRes = responseCapture();
  await domainApi(req, invalidRes);
  assert.equal(invalidRes.statusCode, 400, 'protocols and paths are rejected instead of silently normalized by the API');
  const validRes = responseCapture();
  await domainApi({ ...req, body: { ...req.body, hostname: 'www.example.com' } }, validRes);
  assert.equal(validRes.statusCode, 200);
  assert.ok(requests.some((entry) => entry.target.includes('api.vercel.com/v10/projects/tayar-project/domains')));
  assert.ok(requests.some((entry) => entry.options.headers?.Authorization === 'Bearer service'));

  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes('/rest/v1/website_custom_domains?')) return Response.json([{ project_id: 'project-1', user_id: 'owner-1' }]);
    if (target.includes('/storage/v1/object/public/published-sites/owner-1/project-1/index.html')) return new Response('<html><body>Custom site</body></html>', { status: 200 });
    if (target.includes('/storage/v1/object/public/published-sites/owner-1/project-1/about.html')) return new Response('<html><body>Clean route</body></html>', { status: 200 });
    if (target.includes('/storage/v1/object/public/published-sites/owner-1/project-1/about')) return new Response('missing', { status: 404 });
    throw new Error(`Unexpected published request: ${target}`);
  };
  const publishedRes = responseCapture();
  await publishedApi({ method: 'GET', url: '/api/published-site?hostname=www.example.com&file=index.html', headers: { host: 'tayar.se' } }, publishedRes);
  assert.equal(publishedRes.statusCode, 200);
  assert.match(publishedRes.body, /Custom site/);
  const cleanRouteRes = responseCapture();
  await publishedApi({ method: 'GET', url: '/api/published-site?hostname=www.example.com&file=about', headers: { host: 'tayar.se' } }, cleanRouteRes);
  assert.equal(cleanRouteRes.statusCode, 200);
  assert.match(cleanRouteRes.body, /Clean route/);

  let proxyUrl = '';
  globalThis.fetch = async (url) => { proxyUrl = String(url); return new Response('proxied'); };
  assert.equal(await middleware(new Request('https://tayar.se/')), undefined, 'platform requests bypass customer routing');
  const proxied = await middleware(new Request('https://www.example.com/sv/index.html'));
  assert.equal(await proxied.text(), 'proxied');
  assert.match(proxyUrl, /hostname=www\.example\.com/);
  assert.match(proxyUrl, /file=sv%2Findex\.html/);
  const denied = await middleware(new Request('https://www.example.com/', { method: 'POST' }));
  assert.equal(denied.status, 405);
  console.log('PASS domain ownership, server-secret isolation, Vercel registration, hostname routing and method safety');
} finally {
  globalThis.fetch = originalFetch;
}
