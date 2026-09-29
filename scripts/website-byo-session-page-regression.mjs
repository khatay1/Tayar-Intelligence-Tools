import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-byo-session-'));
const oldFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'runtime.cjs');
  await build({ stdin: { contents: `export { handleOwnedWebsiteApplicationBrowserSession, ownedApplicationRequestWithBrowserSession } from './src/modules/website-builder/services/websiteApplicationSessionService';
    export { serveOwnedWebsiteApplicationPage } from './src/modules/website-builder/services/websiteApplicationPageService';
    export { serveOwnedApplicationRoute } from './src/modules/website-builder/services/websiteOwnedApplicationRouteService';`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile });
  const { handleOwnedWebsiteApplicationBrowserSession: sync,
    ownedApplicationRequestWithBrowserSession: withCookie,
    serveOwnedWebsiteApplicationPage: serve, serveOwnedApplicationRoute: route } = (await import(pathToFileURL(outfile))).default;
  const origin = 'https://customer-app.example';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan',
    publishableKey: 'sb_publishable_customer_fixture' };
  const definition = { version: 1, tables: [], roles: [], auth: { enabled: true,
    signUpEnabled: true, emailVerificationRequired: true },
    pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] };
  const context = { applicationOrigin: origin, backend, expectedProjectRef: backend.projectRef, definition };
  const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64url')}.fixture_signature`;
  let active = true, calls = [];
  globalThis.fetch = async (resource, init) => {
    const url = resource instanceof Request ? resource.url : String(resource);
    calls.push(url);
    assert(url.startsWith(backend.url));
    assert.equal(new Headers(init.headers).get('apikey'), backend.publishableKey);
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    if (url.endsWith('/auth/v1/logout?scope=local')) { active = false; return new Response(null, { status: 204 }); }
    assert(url.endsWith('/auth/v1/user'));
    return active ? Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      is_anonymous: false, email_confirmed_at: '2026-09-29T00:00:00Z' })
      : Response.json({ message: 'Invalid token' }, { status: 401 });
  };
  const sessionRequest = (method = 'POST', extraHeaders = {}) => new Request(`${origin}/api/application-session`, {
    method, headers: { origin, 'sec-fetch-site': 'same-origin', ...(method === 'POST' ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
  });
  const confirmed = await sync(sessionRequest(), context);
  assert.equal(confirmed.status, 200);
  assert.equal((await confirmed.json()).status, 'synchronized');
  const cookie = confirmed.headers.get('set-cookie').split(';')[0];
  assert.match(confirmed.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/);
  assert(!confirmed.headers.get('set-cookie').includes('Domain='));
  let reads = 0;
  const navigate = async cookieHeader => {
    const request = withCookie(new Request(`${origin}/dashboard.html`, { headers: cookieHeader ? { cookie: cookieHeader } : {} }), context);
    return serve({ request, pageId: 'dashboard', pageIds: new Set(['dashboard']), definition,
      backend, expectedProjectRef: backend.projectRef,
      async loadPage() { reads++; return new Response('private-customer-page', { headers: { 'content-type': 'text/html' } }); } });
  };
  assert.equal((await navigate('')).status, 401);
  const page = await navigate(cookie);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), 'private-customer-page');
  assert.equal(reads, 1);
  assert.match(page.headers.get('cache-control'), /no-store/);
  const manifest = { ...context, projectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    pages: [{ path: '/dashboard.html', pageId: 'dashboard', language: 'en', sections: [] }] };
  let routeReads = 0;
  const load = async pageId => { routeReads++; assert.equal(pageId, 'dashboard');
    return new Response('<!doctype html><html><body><h1>Private</h1></body></html>',
      { headers: { 'content-type': 'text/html; charset=utf-8' } }); };
  const routeRequest = (path, headers = {}, method = 'GET') => new Request(`${origin}${path}`, { method, headers });
  const routedSession = await route(sessionRequest(), manifest, load);
  assert.equal(routedSession.status, 200);
  assert.match(routedSession.headers.get('set-cookie'), /HttpOnly/);
  assert.equal((await route(routeRequest('/dashboard.html'), manifest, load)).status, 401);
  const authShell = await route(routeRequest('/dashboard.html?applicationAuth=1', { accept: 'text/html' }), manifest, load);
  assert.equal(authShell.status, 200);
  assert((await authShell.text()).includes('customer-app.example'));
  assert.equal(routeReads, 0, 'Account shell and denied page cannot read private HTML');
  const routePage = await route(routeRequest('/dashboard.html', { cookie, accept: 'text/html' }), manifest, load);
  assert.equal(routePage.status, 200);
  const privateHtml = await routePage.text();
  assert(privateHtml.includes('data-tayar-application-runtime'));
  assert(!privateHtml.includes('tayar.se'));
  assert.equal(routeReads, 1);
  assert.equal((await route(routeRequest('/missing.html', { cookie }), manifest, load)).status, 404);
  assert.equal((await route(routeRequest('/dashboard.html', { cookie }, 'POST'), manifest, load)).status, 405);
  assert.equal((await route(new Request('https://evil.example/dashboard.html', { headers: { cookie } }), manifest, load)).status, 403);
  assert.equal((await route(routeRequest('/dashboard.html', { cookie }),
    { ...manifest, pages: [...manifest.pages, manifest.pages[0]] }, load)).status, 503);
  assert.equal((await route(routeRequest('/dashboard.html', { cookie }),
    { ...manifest, expectedProjectRef: 'aaaaaaaaaaaaaaaaaaaa' }, load)).status, 503);
  assert.equal(routeReads, 1);
  assert.equal((await sync(sessionRequest('POST', { origin: 'https://evil.example' }), context)).status, 403);
  assert.equal((await sync(sessionRequest('POST', { 'sec-fetch-site': 'cross-site' }), context)).status, 403);
  assert.equal((await sync(sessionRequest(), { ...context, expectedProjectRef: 'aaaaaaaaaaaaaaaaaaaa' })).status, 503);
  assert.throws(() => withCookie(new Request('https://evil.example/dashboard.html', { headers: { cookie } }),
    { ...context, expectedProjectRef: 'aaaaaaaaaaaaaaaaaaaa' }), /backend identity/);
  const foreign = withCookie(new Request('https://evil.example/dashboard.html', { headers: { cookie } }), context);
  assert.equal(foreign.headers.get('authorization'), null);
  const deleted = await sync(sessionRequest('DELETE', { cookie }), context);
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await navigate(cookie)).status, 401, 'Cookie is revalidated by customer Auth on every protected request');
  assert.equal(reads, 1);
  assert(calls.every(url => url.startsWith(backend.url)), 'No Tayar platform calls');
  console.log('PASS BYO session/page: customer origin, Auth cookie, protected delivery, CSRF, logout and fresh denial');
} finally { globalThis.fetch = oldFetch; await rm(dir, { recursive: true, force: true }); }
