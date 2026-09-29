import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-auth-settings-'));
const originalFetch = globalThis.fetch;
try {
  const outfile = join(dir, 'auth.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationAuthSettingsService.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { assertDedicatedApplicationAuthSettings: verify,
    assertOwnedApplicationAuthSettings: verifyOwned } = (await import(pathToFileURL(outfile))).default;
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [] };
  const good = { external: { email: true, anonymous_users: false, google: false }, disable_signup: false, mailer_autoconfirm: false };
  let settings = good;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    assert.equal(url, `${backend.url}/auth/v1/settings`);
    assert.deepEqual(init.headers, { apikey: backend.publishableKey, Accept: 'application/json' });
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    return new Response(JSON.stringify(settings));
  };
  await verify(app, backend, platformUrl);
  await verifyOwned(app, backend, backend.projectRef);
  const beforeOwnedMismatch = calls;
  await assert.rejects(() => verifyOwned(app, backend, 'aaaaaaaaaaaaaaaaaaaa'), /identity/);
  assert.equal(calls, beforeOwnedMismatch);
  for (const invalid of [null, [], {}, { ...good, disable_signup: 'false' }, { ...good, disable_signup: true }, { ...good, mailer_autoconfirm: true }, { ...good, external: { ...good.external, email: false } }, { ...good, external: { email: true } }, { ...good, external: { ...good.external, anonymous_users: true } }, { ...good, external: { ...good.external, google: true } }, { ...good, saml_enabled: true }, { ...good, passkeys_enabled: true }]) {
    settings = invalid;
    await assert.rejects(() => verify(app, backend, platformUrl));
  }
  settings = { ...good, disable_signup: true };
  await verify({ ...app, auth: { ...app.auth, signUpEnabled: false } }, backend, platformUrl);
  settings = { ...good, mailer_autoconfirm: true };
  await verify({ ...app, auth: { ...app.auth, emailVerificationRequired: false } }, backend, platformUrl);
  settings = { ...good, external: { ...good.external, email: false }, disable_signup: true };
  await verify({ ...app, auth: { ...app.auth, enabled: false, signUpEnabled: false } }, backend, platformUrl);
  const before = calls;
  await assert.rejects(() => verify(app, { ...backend, url: platformUrl, projectRef: 'pnbllxdlskljcakyaylt' }, platformUrl));
  assert.equal(calls, before, 'Never query platform auth as an application backend');
  globalThis.fetch = async () => { throw new Error('sensitive-transport-detail'); };
  await assert.rejects(() => verify(app, backend, platformUrl), error => error.message === 'Dedicated application authentication settings are unavailable.');
  console.log('PASS real Auth settings contract: email/signup/confirmation parity, anonymous and unsupported provider denial, exact dedicated target and safe transport errors');
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
