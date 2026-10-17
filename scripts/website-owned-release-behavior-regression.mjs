import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const dir = await mkdtemp(join(tmpdir(), 'tayar-release-behavior-'));
const previousEnvironment = process.env.VERCEL_ENV;
try {
  const helperFile = join(dir, 'helper.cjs');
  await build({ stdin: { contents: `export {compileWebsiteOwnedApplicationSource} from './server/website-owned-source-compiler';
    export {verifyOwnedDeployedBehavior} from './server/website-owned-behavior-verification';
    export {readOwnedReleaseIdentity} from './server/website-owned-release-identity';
    export {createSection} from './src/modules/website-builder/core/defaults';`, resolveDir: process.cwd(), loader: 'ts' },
    outfile: helperFile, bundle: true, platform: 'node', format: 'cjs' });
  const { compileWebsiteOwnedApplicationSource: compile, verifyOwnedDeployedBehavior: verify,
    readOwnedReleaseIdentity: readIdentity, createSection } = createRequire(import.meta.url)(helperFile);
  const projectId = '11111111-1111-4111-8111-111111111111';
  const hero = createSection('hero'); hero.buttonUrl = '#hero';
  hero.elements = hero.elements.map(element => element.type === 'button' ? { ...element, href: '#hero' } : element);
  const snapshot = { siteName: 'Reference clinic', homePageId: 'home',
    application: createApplicationReferenceProjects().find(item => item.domain === 'clinic').definition,
    pages: [{ id: 'home', name: 'Home', slug: 'home', sections: [hero] }] };
  const files = await compile(snapshot, { projectId, applicationOrigin: 'https://customer.example',
    expectedProjectRef: 'abcdefghijklmnopqrst', backend: { projectRef: 'abcdefghijklmnopqrst',
      url: 'https://abcdefghijklmnopqrst.supabase.co', publishableKey: 'sb_publishable_behavior_fixture' },
    environment: 'production', platformOrigin: 'https://platform.example',
    platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co' });
  const identity = await readIdentity(files), runtime = files.find(file => file.path === 'api/application.js');
  assert.ok(runtime); const runtimeFile = join(dir, 'application.cjs'); await writeFile(runtimeFile, runtime.content);
  process.env.VERCEL_ENV = 'production';
  const handler = createRequire(import.meta.url)(runtimeFile);
  const liveUrl = 'https://customer-staged.vercel.app';
  const requestFor = challenge => new Request(`${liveUrl}/api/application?tayarRoute=release-behavior-proof&challenge=${challenge}`);
  const challenge = crypto.randomUUID(), response = await handler(requestFor(challenge));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { ...identity, behaviorVersion: 1, challenge,
    checks: ['auth-shell', 'anonymous-session-denial', 'unknown-route-denial'] });
  let calls = 0, lastChallenge;
  const fetcher = async (url, init) => { calls++; assert.equal(url.origin, liveUrl); assert.equal(init.credentials, 'omit');
    assert.notEqual(url.searchParams.get('challenge'), lastChallenge); lastChallenge = url.searchParams.get('challenge');
    return handler(new Request(url, init)); };
  const input = { projectId, liveUrl, files, isCurrent: async () => true, fetcher };
  await verify(input); await verify(input); assert.equal(calls, 2);
  const failure = error => error.message === 'Customer deployed behavior verification is unavailable.';
  for (const mutation of [value => { value.runtimeDigest = '0'.repeat(64); }, value => { value.challenge = 'cached'; },
    value => { value.behaviorVersion = 2; }, value => { value.checks.pop(); }, value => { value.secret = 'must-not-escape'; }]) {
    await assert.rejects(verify({ ...input, fetcher: async (url, init) => {
      const value = await (await fetcher(url, init)).json(); mutation(value);
      return Response.json(value, { headers: { 'cache-control': 'private, no-store' } });
    } }), failure);
  }
  await assert.rejects(verify({ ...input, liveUrl: 'https://customer.example' }), failure);
  await assert.rejects(verify({ ...input, isCurrent: async () => false }), failure);
  assert.equal((await handler(new Request(requestFor(crypto.randomUUID()), { method: 'POST' }))).status, 405);
  for (const suffix of ['&challenge=duplicate', '&tayarRoute=release-behavior-proof', '&target=forged']) {
    assert.equal((await handler(new Request(requestFor(crypto.randomUUID()).url + suffix))).status, 400);
  }
  console.log('PASS deployed Production behavior proof: actual compiled runtime auth shell, anonymous-session denial, unknown-route denial, fresh challenge, tamper/stale/host refusal and no provider mutation');
} finally {
  if (previousEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previousEnvironment;
  await rm(dir, { recursive: true, force: true });
}
