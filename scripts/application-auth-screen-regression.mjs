import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-auth-screen-'));
const controllers = [];
try {
  const outfile = join(dir, 'controller.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-auth-controller.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createApplicationAuthController: create } = (await import(pathToFileURL(outfile))).default;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', ownerId = '11111111-1111-4111-8111-111111111111';
  const config = { projectId, ownerId, applicationOrigin: `https://${projectId}.apps.tayar.example`, platformOrigin: 'https://tayar.se',
    platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co', backend: { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' },
    returnPath: `/site/${ownerId}/${projectId}/dashboard.html`, signUpEnabled: true, language: 'en',
  };
  const calls = [], listeners = new Set();
  let session = null, fail = false, bridgeFailure = false, syncs = 0, disposed = 0, pause;
  const result = data => ({ data, error: fail ? new Error('PRIVATE_UPSTREAM_ERROR') : null });
  const auth = {
    async getSession() { if (pause) await pause; return result({ session }); },
    onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
    async signInWithPassword(input) { calls.push(['signIn', input]); session = { access_token: 'a.b.c' }; return result({ session }); },
    async signUp(input) { calls.push(['signUp', input]); return result({ session }); },
    async resetPasswordForEmail(...input) { calls.push(['reset', ...input]); return result({}); },
    async updateUser(input) { calls.push(['update', input]); return result({}); },
    async signOut(input) { calls.push(['signOut', input]); session = null; return result({}); },
  };
  const bridge = { async synchronize() { syncs++; if (bridgeFailure) throw new Error('BRIDGE_PRIVATE_ERROR'); }, dispose() { disposed++; } };
  const controller = create(config, { client: { auth }, bridge }); controllers.push(controller);
  assert.equal(await controller.initialize(), 'signed-out');
  await assert.rejects(controller.prepareNavigation());
  assert.equal(await controller.signIn(' user@example.test ', 'password'), 'signed-in');
  assert.equal(calls.at(-1)[1].email, 'user@example.test');
  assert.equal(syncs, 1);
  assert.equal(await controller.prepareNavigation(), config.applicationOrigin + config.returnPath);
  bridgeFailure = true;
  await assert.rejects(controller.prepareNavigation(), { message: 'The account request could not be completed. Please try again.' });
  bridgeFailure = false;
  assert.equal(await controller.signOut(), 'signed-out');
  assert.deepEqual(calls.at(-1), ['signOut', { scope: 'local' }]);
  assert.equal(await controller.signUp('user@example.test', 'password'), 'verification-sent');
  const redirect = new URL(calls.at(-1)[1].options.emailRedirectTo);
  assert.equal(redirect.origin, config.applicationOrigin);
  assert.equal(redirect.pathname, config.returnPath);
  assert.equal(redirect.searchParams.get('applicationAuth'), '1');
  assert.equal(await controller.requestReset('user@example.test'), 'reset-sent');
  assert.equal(new URL(calls.at(-1)[2].redirectTo).searchParams.get('recovery'), '1');
  const before = calls.length;
  await assert.rejects(controller.updatePassword('new-password'));
  assert.equal(calls.length, before, 'Recovery state required before password update');
  listeners.forEach(listener => listener('PASSWORD_RECOVERY'));
  assert.equal(controller.status().state, 'recovery');
  assert.equal(await controller.updatePassword('new-password'), 'password-updated');
  fail = true;
  await assert.rejects(controller.signIn('user@example.test', 'password'), { message: 'The account request could not be completed. Please try again.' });
  fail = false;
  const disabled = create({ ...config, signUpEnabled: false }, { client: { auth }, bridge }); controllers.push(disabled);
  const beforeDisabled = calls.length;
  await assert.rejects(disabled.signUp('user@example.test', 'password'));
  assert.equal(calls.length, beforeDisabled);
  for (const returnPath of ['https://evil.invalid/', '//evil.invalid/', `/site/${ownerId}/${projectId}/../../other/`, `${config.returnPath}?redirect=https://evil.invalid/`, `${config.returnPath}#token`]) {
    assert.throws(() => create({ ...config, returnPath }, { client: { auth }, bridge }));
  }
  let release;
  pause = new Promise(resolve => { release = resolve; });
  const pending = disabled.initialize();
  await assert.rejects(disabled.signIn('user@example.test', 'password'), 'No overlapping account request');
  disabled.dispose(); release();
  await assert.rejects(pending);
  pause = undefined;
  assert.equal(disposed, 1);
  await assert.rejects(disabled.initialize());
  controller.dispose();
  assert.equal(listeners.size, 0);
  console.log('PASS account controller: synchronized navigation, signup/reset redirects, recovery-only update, local logout, safe errors, request serialization and disposal');
} finally { controllers.forEach(controller => controller.dispose()); await rm(dir, { recursive: true, force: true }); }
