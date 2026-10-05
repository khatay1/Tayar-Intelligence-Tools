import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const dir = await mkdtemp(join(tmpdir(), 'tayar-password-'));
try {
  const outfile = join(dir, 'password.mjs');
  await build({ entryPoints: ['src/lib/password-update.ts'], outfile, format: 'esm', bundle: true });
  const { passwordUpdateAttributes } = await import(pathToFileURL(outfile));
  const calls = [];
  const user = { id: 'test', email: 'test@example.com', aud: 'authenticated', role: 'authenticated' };
  const client = createClient('https://unit-test.supabase.co', 'unit-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      calls.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null });
      return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const token = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.' + Buffer.from('test-signature').toString('base64url');
  assert.equal((await client.auth.setSession({ access_token: token, refresh_token: 'test-refresh' })).error, null);
  assert.equal((await client.auth.updateUser(passwordUpdateAttributes('new-test-password', 'old-test-password', ' 12345678 '))).error, null);
  const update = calls.find(x => x.method === 'PUT');
  assert.equal(update.body.current_password, 'old-test-password', 'Pinned SDK must forward current_password to Auth');
  assert.equal(update.body.nonce, '12345678');
  assert.equal(update.body.password, 'new-test-password');
  assert.deepEqual(passwordUpdateAttributes('recovery-password'), { password: 'recovery-password' }, 'Recovery keeps its server-verified exemption without demanding the forgotten password');
  assert.deepEqual(passwordUpdateAttributes('new', '', '  '), { password: 'new' });
  console.log('PASS pinned Supabase SDK forwards current password and reauthentication nonce; recovery omits both');
} finally { await rm(dir, { recursive: true, force: true }); }
