import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-byo-static-'));
try {
  const outfile = join(dir, 'static.cjs');
  const built = await build({ entryPoints: ['src/modules/website-builder/services/websiteByoStaticSourceCompiler.ts'],
    tsconfig: 'tsconfig.app.json', metafile: true, bundle: true, platform: 'node', format: 'cjs', outfile });
  assert(!Object.keys(built.metafile.inputs).some(path => /src\/lib\/(?:env|supabase)\.ts/.test(path)));
  const { compileWebsiteByoStaticSource: compile } = (await import(pathToFileURL(outfile))).default;
  const defaultsOut = join(dir, 'defaults.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/defaults.ts'], tsconfig: 'tsconfig.app.json',
    bundle: true, platform: 'node', format: 'cjs', outfile: defaultsOut });
  const { createSection } = (await import(pathToFileURL(defaultsOut))).default;
  const application = { version: 1, tables: [], roles: [], auth: { enabled: false,
    signUpEnabled: false, emailVerificationRequired: true }, pageAccess: [] };
  const section = createSection('hero');
  section.title = 'Welcome';
  const snapshot = { application, homePageId: 'home', siteName: 'Customer site',
    pages: [{ id: 'home', name: 'Home', slug: 'home', language: 'en', sections: [section] },
      { id: 'arabic', name: 'Arabic', slug: 'لوحة', language: 'ar', sections: [section] }],
    cloudProjectId: 'PLATFORM_ID_NEVER_EXPORT', supabaseUrl: 'https://platform.invalid',
    supabaseAnonKey: 'PLATFORM_KEY_NEVER_EXPORT' };
  const config = { environment: 'production', platformOrigin: 'https://tayar.example',
    platformUrl: 'https://platform.invalid' };
  const before = JSON.stringify(snapshot);
  const files = await compile(snapshot, config);
  assert.equal(JSON.stringify(snapshot), before);
  assert.deepEqual(files.map(file => file.path), ['vercel.json', 'public/index.html', 'public/لوحة.html']);
  assert.deepEqual(JSON.parse(files[0].content), { $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: null, outputDirectory: 'public', buildCommand: null });
  assert.match(files[1].content, /Customer site/);
  assert(files.every(file => !/PLATFORM_|platform\.invalid|tayar\.example|project-backup\.json/.test(file.content)));
  assert.deepEqual(await compile(snapshot, config), files, 'The static source manifest is deterministic');
  await assert.rejects(compile({ ...snapshot, pages: [{ ...snapshot.pages[0],
    sections: [{ ...section, elements: [] }] }] }, config), /not deterministic/);
  for (const mutation of [
    { application: { ...application, auth: { ...application.auth, enabled: true } } },
    { application: { ...application, tables: [{ id: 'records', key: 'records', name: 'Records',
      fields: [], permissions: [] }] } },
    { pages: [{ ...snapshot.pages[0], sections: [{ ...section, type: 'contact' }] }] },
    { pages: [{ ...snapshot.pages[0], sections: [{ ...section, elements: [{ type: 'embed' }] }] }] },
    { cms: { collections: [{ id: 'items' }] } },
    { integrationsMax: { version: 1, connections: [{ id: 'pay', providerId: 'stripe', enabled: true,
      environments: ['production'] }] } },
  ]) await assert.rejects(compile({ ...snapshot, ...mutation }, config), /BYO/);
  const platformAsset = { ...snapshot, pages: [{ ...snapshot.pages[0], sections: [{ ...section,
    elements: [{ id: 'image', type: 'image', content: 'https://tayar.example/storage/asset.png' }] }] }] };
  await assert.rejects(compile(platformAsset, config), /platform runtime/);
  console.log('PASS BYO static source: deterministic user-owned Vercel files, Unicode route, no platform identity and dynamic refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
