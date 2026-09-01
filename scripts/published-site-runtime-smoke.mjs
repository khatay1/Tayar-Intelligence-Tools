import assert from 'node:assert/strict';
import handler from '../api/published-site.js';

const originalFetch = globalThis.fetch;
const originalSupabaseUrl = process.env.SUPABASE_URL;
process.env.SUPABASE_URL = 'https://example.supabase.co';

function createResponseRecorder() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    end(body) {
      this.body = body ?? '';
    },
  };
}

async function execute({
  method = 'GET',
  url,
  headers = { host: 'tayar.se' },
  fetchImpl,
}) {
  const res = createResponseRecorder();
  const calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return fetchImpl(...args);
  };

  await handler({ method, url, headers }, res);
  return { res, calls };
}

const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await check('Published index renders inline HTML instead of source text', async () => {
  const html = '<!doctype html><html><body><h1>Tayar</h1></body></html>';
  const { res, calls } = await execute({
    url: '/site/owner-1/project-1/index.html',
    fetchImpl: async () =>
      new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(res.headers.get('content-disposition'), 'inline');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-tayar-published-site'), '1');
  assert.match(res.headers.get('content-security-policy') || '', /sandbox allow-scripts/);
  assert.doesNotMatch(res.headers.get('content-security-policy') || '', /allow-same-origin/);
  assert.equal(Buffer.isBuffer(res.body), true);
  assert.equal(res.body.toString('utf8'), html);
  assert.equal(calls.length, 1);
  assert.match(String(calls[0][0]), /published-sites\/owner-1\/project-1\/index\.html$/);
});

await check('Published HEAD request returns headers without a body', async () => {
  const { res } = await execute({
    method: 'HEAD',
    url: '/site/owner-1/project-1/index.html',
    fetchImpl: async () => new Response('<html></html>', { status: 200 }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(res.body, '');
});

await check('Preview pages are noindex and routed to preview storage', async () => {
  const { res, calls } = await execute({
    url: '/preview/owner-1/project-1/token-1/index.html',
    fetchImpl: async () => new Response('<html>preview</html>', { status: 200 }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(
    String(calls[0][0]),
    /published-sites\/owner-1\/project-1\/previews\/token-1\/index\.html$/,
  );
});

await check('Missing HTML falls back to 404.html but keeps HTTP 404', async () => {
  let call = 0;
  const { res, calls } = await execute({
    url: '/site/owner-1/project-1/missing.html',
    fetchImpl: async () => {
      call += 1;
      if (call === 1) return new Response('missing', { status: 404 });
      return new Response('<html>custom 404</html>', { status: 200 });
    },
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(res.body.toString('utf8'), '<html>custom 404</html>');
  assert.equal(calls.length, 2);
  assert.match(String(calls[1][0]), /published-sites\/owner-1\/project-1\/404\.html$/);
});

await check('Archived release files cannot be exposed through live routes', async () => {
  const { res, calls } = await execute({
    url: '/site/owner-1/project-1/versions/release-1/index.html',
    fetchImpl: async () => new Response('should-not-run', { status: 200 }),
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body, 'Published page not found');
  assert.equal(calls.length, 0);
});

await check('Path traversal is rejected before storage access', async () => {
  const { res, calls } = await execute({
    url: '/site/owner-1/project-1/%2E%2E/secret.html',
    fetchImpl: async () => new Response('should-not-run', { status: 200 }),
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body, 'Invalid published-site path');
  assert.equal(calls.length, 0);
});

await check('Static assets receive deterministic inline content types', async () => {
  const { res } = await execute({
    url: '/site/owner-1/project-1/assets/site.css',
    fetchImpl: async () => new Response('body{}', { status: 200 }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal(res.headers.get('content-disposition'), 'inline');
});

globalThis.fetch = originalFetch;
if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
else process.env.SUPABASE_URL = originalSupabaseUrl;

const failed = checks.filter((item) => !item.ok);
console.log(`Published-site runtime smoke: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const item of checks) {
  console.log(`  ${item.ok ? '✓' : '✗'} ${item.name}${item.error ? `: ${item.error}` : ''}`);
}
if (failed.length) process.exit(1);
