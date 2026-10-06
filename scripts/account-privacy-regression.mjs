import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const baseline = process.argv.includes('--baseline');
const dir = await mkdtemp(join(tmpdir(), 'tayar-account-privacy-'));
const map = new Map();
const storage = { getItem: key => map.get(key) ?? null, setItem: (key,value) => map.set(key,value), removeItem: key => map.delete(key) };
globalThis.window = { localStorage: storage };
globalThis.localStorage = storage;
async function load(path, name) {
  const outfile = join(dir, name + '.mjs');
  const input = baseline ? { stdin: { contents: execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' }), resolveDir: dirname(join(process.cwd(), path)), sourcefile: path, loader: 'ts' } } : { entryPoints: [path] };
  await build({ ...input, outfile, bundle: true, format: 'esm', platform: 'node', tsconfig: 'tsconfig.app.json' });
  return import(pathToFileURL(outfile));
}
try {
  const invoice = await load('src/modules/invoice-generator/invoice-model.ts','invoice');
  const a = { ...invoice.createDefaultDraft(), customerName: 'PRIVATE-A' };
  invoice.saveDraft(a, 'account-a');
  assert.equal(invoice.loadDraft('account-a').customerName, 'PRIVATE-A');
  assert.equal(invoice.loadDraft('account-b').customerName, '', 'Account B must not load account A invoice');
  invoice.saveDraft({ ...a, customerName: 'PRIVATE-B' }, 'account-b');
  invoice.clearSavedDraft('account-b');
  assert.equal(invoice.loadDraft('account-a').customerName, 'PRIVATE-A');
  storage.setItem(invoice.STORAGE_KEY, JSON.stringify({ ...a, customerName: 'LEGACY-UNOWNED' }));
  assert.equal(invoice.loadDraft('account-c').customerName, '', 'Never adopt an unowned legacy draft');
  const website = await load('src/modules/website-builder/core/editor-project-lifecycle.ts','website');
  const project = { pages: [], sections: [], siteName: 'PRIVATE-A' };
  website.saveLocalWebsiteProject(project, 'account-a');
  website.saveActiveWebsiteProjectId('project-a', 'account-a');
  website.saveRecoveryWebsiteProject(project, 'test', 'account-a');
  assert.equal(website.loadLocalWebsiteProject('account-a').siteName, 'PRIVATE-A');
  assert.equal(website.loadLocalWebsiteProject('account-b'), null);
  assert.equal(website.loadActiveWebsiteProjectId('account-b'), null);
  assert.equal(website.hasRecoveryWebsiteProject('account-b'), false);
  assert.equal(website.loadRecoveryWebsiteProject('account-b'), null);
  website.saveLocalWebsiteProject({ ...project, siteName: 'PRIVATE-B' }, 'account-b');
  website.clearLocalWebsiteProjects('account-b');
  assert.equal(website.loadLocalWebsiteProject('account-a').siteName, 'PRIVATE-A');
  assert.equal(website.loadRecoveryWebsiteProject('account-a').project.siteName, 'PRIVATE-A');
  storage.setItem(website.STORAGE_KEY, JSON.stringify({ ...project, siteName: 'LEGACY-UNOWNED' }));
  assert.equal(website.loadLocalWebsiteProject('account-c'), null);
  const { verifiedSignOut } = await load('src/lib/verified-sign-out.ts','signout');
  let status = 500;
  const authStore = new Map();
  const client = createClient('https://unit-test.supabase.co', 'unit-test-key', {
    auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'test-auth', storage: { getItem: key => authStore.get(key) ?? null, setItem: (key,value) => authStore.set(key,value), removeItem: key => authStore.delete(key) } },
    global: { fetch: async (url) => String(url).endsWith('/user') ? new Response(JSON.stringify({ id: 'account-a', aud: 'authenticated', role: 'authenticated' }), { status: 200 }) : new Response(status === 204 ? null : JSON.stringify({ message: 'Temporary auth failure' }), { status }) },
  });
  const token = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'),'test'].join('.');
  assert.equal((await client.auth.setSession({ access_token: token, refresh_token: 'test-refresh' })).error, null);
  await assert.rejects(verifiedSignOut(client.auth));
  assert.ok((await client.auth.getSession()).data.session, 'Failure must not be presented as successful signout');
  status = 204;
  await verifiedSignOut(client.auth);
  assert.equal((await client.auth.getSession()).data.session, null);
  assert.equal(authStore.has('test-auth'), false, 'Successful signout must clear persisted login');
  const app = await readFile('src/App.tsx','utf8');
  assert.match(app, /key=\{user.id\}[^]*?<Workspace/, 'Workspace state must reset when identity changes');
  console.log('PASS account-separated invoice, website draft/recovery/active identity, legacy isolation, and real SDK logout failure/success');
} finally { await rm(dir,{ recursive:true,force:true }); }
