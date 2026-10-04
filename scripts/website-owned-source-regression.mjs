import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-owned-source-'));
const oldFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'compiler.cjs');
  const compilerBuild = await build({ entryPoints: ['server/website-owned-source-compiler.ts'], bundle: true,
    metafile: true, platform: 'node', format: 'cjs', outfile });
  assert(!Object.keys(compilerBuild.metafile.inputs).some(path => /node_modules\/esbuild|website-owned-source-compiler\.ts.*esbuild/.test(path)),
    'Owned source compilation must not require esbuild at request time');
  const { compileWebsiteOwnedApplicationSource: compile } = (await import(pathToFileURL(outfile))).default;
  const defaultsFile = join(dir, 'defaults.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/defaults.ts'], bundle: true,
    platform: 'node', format: 'cjs', outfile: defaultsFile });
  const { createSection } = (await import(pathToFileURL(defaultsFile))).default;
  const section = createSection('hero'); section.title = 'Owner App';
  const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan',
    publishableKey: 'sb_publishable_customer_fixture' };
  const config = { projectId: id, applicationOrigin: 'https://customer-app.example', expectedProjectRef: backend.projectRef,
    backend, environment: 'production', platformOrigin: 'https://tayar.example',
    platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co' };
  const snapshot = { homePageId: 'home', siteName: 'Owner App', application: { version: 1, tables: [], roles: [],
    auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
    pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }] },
    pages: [{ id: 'home', name: 'Home', slug: 'home', language: 'en', sections: [section] },
      { id: 'dashboard', name: 'Dashboard', slug: 'dashboard', language: 'en', sections: [section] }],
    supabaseUrl: config.platformUrl, supabaseAnonKey: 'PLATFORM_KEY_NEVER_EXPORT' };
  const before = JSON.stringify(snapshot);
  const files = await compile(snapshot, config);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(files.map(file => file.path), ['package.json', 'vercel.json', 'api/application.js']);
  assert.deepEqual(await compile(snapshot, config), files);
  assert(files.every(file => !file.path.startsWith('public/')));
  assert(files.every(file => !file.content.includes(config.platformUrl) && !file.content.includes(config.platformOrigin)
    && !file.content.includes('PLATFORM_KEY_NEVER_EXPORT')));
  const vercel = JSON.parse(files[1].content);
  assert.deepEqual(vercel.rewrites.map(item => item.source),
    ['/api/application-session', '/index.html', '/dashboard.html', '/']);
  const runtimeFile = join(dir, 'runtime.cjs');
  await writeFile(runtimeFile, files[2].content);
  const handler = (await import(pathToFileURL(runtimeFile))).default;
  const origin = config.applicationOrigin;
  const request = (route, headers = {}) => new Request(`${origin}/api/application?tayarRoute=${route}`, { headers });
  let verified = 0;
  globalThis.fetch = async resource => {
    assert.equal(String(resource), `${backend.url}/auth/v1/user`);
    verified++;
    return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', is_anonymous: false,
      email_confirmed_at: '2026-09-29T00:00:00Z' });
  };
  assert.equal((await handler(request('dashboard'))).status, 401);
  assert.equal((await handler(request('dashboard', { accept: 'text/html' }))).status, 401);
  const shell = await handler(request('dashboard', { accept: 'text/html' }));
  assert((await shell.text()).includes('application-auth-config'));
  const token = 'header.payload.signature';
  const privatePage = await handler(request('dashboard', { authorization: `Bearer ${token}`, accept: 'text/html' }));
  assert.equal(privatePage.status, 200);
  assert((await privatePage.text()).includes('data-tayar-application-runtime'));
  assert.equal(verified, 1);
  assert.equal((await handler(request('unknown'))).status, 404);
  assert.equal((await handler(new Request('https://wrong.example/api/application?tayarRoute=dashboard'))).status, 403);
  assert.equal(verified, 1, 'Denied requests cannot call upstream Auth without credentials');
  for (const mutation of [
    { ...snapshot, cms: { collections: [{ id: 'news' }] } },
    { ...snapshot, pages: [{ ...snapshot.pages[0], sections: [{ ...section, type: 'contact' }] }] },
  ]) await assert.rejects(compile(mutation, config));
  const restrictedLeak = structuredClone(snapshot);
  restrictedLeak.pages[0].sections[0].title = 'rk_live_restricted_customer_key_123456';
  await assert.rejects(compile(restrictedLeak, config), /unsupported source/);
  await assert.rejects(compile(snapshot, { ...config, expectedProjectRef: 'aaaaaaaaaaaaaaaaaaaa' }));
  console.log('PASS owned source: deterministic private function package, exact routes, Auth gate, no public HTML or platform material');
} finally { globalThis.fetch = oldFetch; await rm(dir, { recursive: true, force: true }); }
