import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const dir = await mkdtemp(join(tmpdir(), 'tayar-preview-origin-'));
const previous = { env: process.env.VERCEL_ENV, url: process.env.VERCEL_URL, fetch: globalThis.fetch };
try {
  const bundle = join(dir, 'compiler.cjs');
  await build({ stdin: { contents: "export {compileWebsiteOwnedApplicationSource as compile} from './server/website-owned-source-compiler'; export {createSection} from './src/modules/website-builder/core/defaults';",
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle });
  const { compile, createSection } = (await import(pathToFileURL(bundle))).default;
  const fixture = createApplicationReferenceProjects().find(item => item.domain === 'clinic');
  const publicSection = createSection('hero');
  publicSection.buttonUrl = '#hero';
  publicSection.elements = publicSection.elements.map(element => element.type === 'button' ? { ...element, href: '#hero' } : element);
  const privateSection = structuredClone(publicSection);
  privateSection.title = 'PRIVATE_PAGE_MARKER'; privateSection.elements[0].text = 'PRIVATE_PAGE_MARKER';
  const snapshot = { siteName: 'Clinic reference', homePageId: 'home', application: {
    ...fixture.definition, pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }],
  }, pages: [{ id: 'home', name: 'Home', slug: 'home', sections: [publicSection] },
    { id: 'dashboard', name: 'Dashboard', slug: 'dashboard', sections: [privateSection] }] };
  const projectId = '11111111-1111-4111-8111-111111111111';
  const backend = { url: 'https://abcdefghijklmnopqrst.supabase.co', projectRef: 'abcdefghijklmnopqrst', publishableKey: 'sb_publishable_fixture' };
  const canonicalOrigin = 'https://customer.example';
  const config = { projectId, backend, expectedProjectRef: backend.projectRef, applicationOrigin: canonicalOrigin,
    environment: 'preview', platformOrigin: 'https://platform.example', platformUrl: 'https://zyxwvutsrqponmlkjihg.supabase.co' };
  const files = await compile(snapshot, config), file = join(dir, 'preview.cjs');
  await writeFile(file, files.find(item => item.path === 'api/application.js').content);
  const handler = (await import(pathToFileURL(file))).default;
  const deploymentHost = 'clinic-preview-fixture.vercel.app', origin = `https://${deploymentHost}`;
  process.env.VERCEL_ENV = 'preview'; process.env.VERCEL_URL = deploymentHost;
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64url')}.signature`;
  let authCalls = 0;
  globalThis.fetch = async (resource, init) => {
    authCalls++;
    assert.equal(String(resource), `${backend.url}/auth/v1/user`);
    assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', is_anonymous: false, email_confirmed_at: '2026-10-16T00:00:00Z' });
  };
  const request = (route, options = {}, requestOrigin = origin) => new Request(`${requestOrigin}/api/application?tayarRoute=${route}`, options);
  const publicResponse = await handler(request('home', { headers: { accept: 'text/html' } }));
  assert.equal(publicResponse.status, 200, 'Preview page works on the exact deployment host instead of failing its Production-origin guard');
  assert.match(await publicResponse.text(), /Clinic reference/);
  const protectedResponse = await handler(request('dashboard', { headers: { accept: 'text/html' } }));
  assert.equal(protectedResponse.status, 401);
  const shell = await protectedResponse.text(); assert.doesNotMatch(shell, /PRIVATE_PAGE_MARKER/); assert.match(shell, /application-auth-config/);
  assert.equal(authCalls, 0, 'Anonymous routes do not call upstream Auth');
  const authenticated = await handler(request('dashboard', { headers: { accept: 'text/html', authorization: `Bearer ${token}` } }));
  assert.equal(authenticated.status, 200); const html = await authenticated.text();
  assert.match(html, /PRIVATE_PAGE_MARKER/); assert.ok(html.includes(origin)); assert.equal(authCalls, 1);
  const synchronized = await handler(request('session', { method: 'POST', headers: { origin, authorization: `Bearer ${token}`, 'sec-fetch-site': 'same-origin' } }));
  assert.equal(synchronized.status, 200);
  const cookie = synchronized.headers.get('set-cookie');
  assert.match(cookie, /^__Host-tayar-app-session=/); assert.match(cookie, /Secure; HttpOnly; SameSite=Lax/); assert.doesNotMatch(cookie, /Domain=/i);
  const fromCookie = await handler(request('dashboard', { headers: { cookie: cookie.split(';')[0], accept: 'text/html' } }));
  assert.equal(fromCookie.status, 200); assert.equal(authCalls, 3, 'Navigation revalidates the dedicated Auth identity');
  const beforeDenial = authCalls;
  for (const foreign of [canonicalOrigin, 'https://another-preview.vercel.app']) {
    assert.equal((await handler(request('dashboard', { headers: { authorization: `Bearer ${token}`, host: deploymentHost,
      'x-forwarded-host': deploymentHost, forwarded: `host=${deploymentHost};proto=https` } }, foreign))).status, 403);
  }
  assert.equal((await handler(request('session', { method: 'POST', headers: { origin: canonicalOrigin, authorization: `Bearer ${token}` } }))).status, 403);
  assert.equal(authCalls, beforeDenial, 'Wrong hosts/cross-origin session writes stop before Auth');
  for (const hostname of [undefined, '', 'customer.example', 'https://clinic-preview-fixture.vercel.app',
    'clinic-preview-fixture.vercel.app:444', 'clinic-preview-fixture.vercel.app/path', 'clinic-preview-fixture.vercel.app.evil.example',
    '127.0.0.1', 'fixture.vercel.app\n', '-fixture.vercel.app']) {
    if (hostname === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = hostname;
    assert.equal((await handler(request('dashboard', { headers: { authorization: `Bearer ${token}` } }))).status, 503);
  }
  process.env.VERCEL_URL = deploymentHost;
  for (const environment of [undefined, 'production', 'development', 'custom']) {
    if (environment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = environment;
    assert.equal((await handler(request('dashboard', { headers: { authorization: `Bearer ${token}` } }))).status, 503);
    assert.equal((await handler(new Request(`${origin}/api/application?tayarRoute=release-proof&challenge=${crypto.randomUUID()}`))).status, 503);
  }
  assert.equal(authCalls, beforeDenial, 'Invalid host/environment never executes Auth or secret-bearing routes');
  const productionFiles = await compile(snapshot, { ...config, environment: 'production' }), productionFile = join(dir, 'production.cjs');
  await writeFile(productionFile, productionFiles.find(item => item.path === 'api/application.js').content);
  const production = (await import(pathToFileURL(productionFile))).default;
  process.env.VERCEL_ENV = 'production';
  assert.equal((await production(request('home', {}, canonicalOrigin))).status, 200);
  assert.equal((await production(request('home'))).status, 403, 'VERCEL_URL cannot override the Production canonical domain');
  process.env.VERCEL_ENV = 'preview';
  assert.equal((await production(request('home', {}, canonicalOrigin))).status, 503, 'Production package cannot execute in Preview');
  console.log('PASS generated Preview origin: existing clinic fixture, exact provider host, anonymous denial, scoped login cookie/navigation, forwarded-host refusal and cross-environment execution isolation (Auth transport mocked)');
} finally {
  if (previous.env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.env;
  if (previous.url === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = previous.url;
  globalThis.fetch = previous.fetch;
  await rm(dir, { recursive: true, force: true });
}
