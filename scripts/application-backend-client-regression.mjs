import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-backend-client-'));
try {
  const outfile = join(dir, 'client.cjs');
  await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationBackendClient.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { createWebsiteApplicationBackendClient } = (await import(pathToFileURL(outfile))).default;
  const platformUrl = 'https://pnbllxdlskljcakyaylt.supabase.co';
  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_fixture' };
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], tables: [], pageAccess: [] };
  const secret = 'sb_secret_browser_input_fixture';
  let calls = [];
  let rpcResult = { data: { ...backend, deployedDefinition: app, privateExtra: secret }, error: null };
  let invokeResult = { data: { status: 'linked', backend: { ...backend, privateExtra: secret } }, error: null };
  const client = createWebsiteApplicationBackendClient({
    async rpc(name, body) { calls.push({ name, body }); return rpcResult; },
    functions: { async invoke(name, options) { calls.push({ name, body: options.body }); return invokeResult; } },
  }, platformUrl);
  assert.deepEqual(await client.read(projectId, app), backend, 'Keep only validated public fields');
  assert.equal(calls[0].name, 'website_application_backend_public');
  assert.deepEqual(calls[0].body, { p_project_id: projectId });
  rpcResult = { data: null, error: null };
  assert.equal(await client.read(projectId, app), null);
  for (const data of [{ ...backend }, { ...backend, deployedDefinition: { ...app, roles: [{ id: 'staff', name: 'Staff' }] } }, { ...backend, projectRef: 'pnbllxdlskljcakyaylt', deployedDefinition: app }]) {
    rpcResult = { data, error: null };
    await assert.rejects(() => client.read(projectId, app), /status is unavailable/);
  }
  rpcResult = { data: null, error: { message: secret } };
  await assert.rejects(() => client.read(projectId, app), error => !error.message.includes(secret));
  calls = [];
  const originalApp = JSON.stringify(app);
  assert.deepEqual(await client.link(projectId, app, backend, secret, () => true), backend);
  assert.equal(calls[0].name, 'website-application-backend-link');
  assert.equal(calls[0].body.serviceKey, secret);
  assert.match(calls[0].body.expectedRevision, /^[a-f0-9]{64}$/);
  assert.equal('definition' in calls[0].body, false, 'Send only revision digest; server reads the authoritative saved schema');
  assert.equal(JSON.stringify(app), originalApp, 'Linking never changes editable application data');
  calls = [];
  await assert.rejects(() => client.link(projectId, app, backend, secret, () => false), /project changed/);
  assert.equal(calls.length, 0, 'Switching projects during digest calculation never sends a credential');
  let resolveRequest;
  let current = true;
  const deferred = createWebsiteApplicationBackendClient({ functions: { invoke: () => new Promise(resolve => { resolveRequest = resolve; }) } }, platformUrl);
  const pending = deferred.link(projectId, app, backend, secret, () => current);
  while (!resolveRequest) await new Promise(resolve => setImmediate(resolve));
  current = false;
  resolveRequest(invokeResult);
  await assert.rejects(() => pending, /linking failed/);
  for (const result of [
    { data: null, error: { message: secret } },
    { data: { status: 'linked', backend: { ...backend, publishableKey: 'sb_publishable_foreign' } }, error: null },
    { data: { status: 'ready', backend }, error: null },
  ]) {
    invokeResult = result;
    await assert.rejects(() => client.link(projectId, app, backend, secret, () => true), error => !error.message.includes(secret));
  }
  const panelOutfile = join(dir, 'panel.cjs');
  await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Panel from './src/modules/website-builder/v2-ui/BuilderApplicationBackendPanel'; export const render = props => renderToStaticMarkup(React.createElement(Panel, props));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile: panelOutfile, jsx: 'automatic', alias: { '@': resolve('src') }, plugins: [{ name: 'panel-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(supabase|env|ui-localization-cms)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path.endsWith('supabase') ? 'export const supabase = {};' : args.path.endsWith('/env') ? `export const env = {supabaseUrl:${JSON.stringify(platformUrl)}};` : 'export const useLocalizer = () => text => text;' }));
  } }] });
  const { render } = (await import(pathToFileURL(panelOutfile))).default;
  const html = render({ projectId, definition: app, saved: false });
  assert.match(html, /Save this project before linking a backend/);
  const savedWithoutDefinition = render({ projectId, saved: true });
  assert.match(savedWithoutDefinition, /Add application data and access settings before linking a backend/);
  assert.doesNotMatch(savedWithoutDefinition, /Save this project before linking a backend/);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="new-password"/);
  assert.doesNotMatch(html, /sb_secret_/);
  console.log('PASS backend browser boundary: revision digest, sanitized public config, stale request suppression, safe errors, unchanged project data and password input rendering');
} finally { await rm(dir, { recursive: true, force: true }); }
