import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-release-client-'));
try {
  const outfile = join(dir, 'client.cjs');
  const built = await build({ entryPoints: ['src/modules/website-builder/services/websiteApplicationReleaseClient.ts'], bundle: true, platform: 'node', format: 'cjs', outfile, metafile: true });
  assert.ok(!Object.keys(built.metafile.inputs).some(path => /ReleaseService|RenderService|ReleaseEndpoint/.test(path)), 'Browser read client must not import privileged server services');
  const { createWebsiteApplicationReleaseClient: createClient } = (await import(pathToFileURL(outfile))).default;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const versionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const valid = { projectId, operation: 'status', privateMode: true, versionId, publishingAvailable: false };
  let calls = [], response = { data: { ...valid, secret: 'sb_secret_MUST_NOT_ESCAPE' }, error: null };
  const client = createClient({ functions: { async invoke(name, options) { calls.push({ name, body: options.body }); return response; } } });
  assert.deepEqual(await client.read(projectId, () => true), { privateMode: true, versionId, publishingAvailable: false });
  assert.deepEqual(calls[0], { name: 'website-application-release', body: { operation: 'status', projectId } });
  for (const data of [null, { ...valid, projectId: versionId }, { ...valid, privateMode: false }, { ...valid, publishingAvailable: 'true' }, { ...valid, versionId: '<script>' }, { ...valid, operation: 'publish' }]) {
    response = { data, error: null };
    await assert.rejects(() => client.read(projectId, () => true), /Private release status is unavailable/);
  }
  response = { data: null, error: { message: 'sb_secret_MUST_NOT_ESCAPE' } };
  await assert.rejects(() => client.read(projectId, () => true), reason => !reason.message.includes('sb_secret'));
  calls = [];
  await assert.rejects(() => client.read(projectId, () => false));
  await assert.rejects(() => client.read('local', () => true));
  assert.equal(calls.length, 0);
  let current = true, resolveRequest;
  const delayed = createClient({ functions: { invoke: () => new Promise(resolve => { resolveRequest = resolve; }) } });
  const pending = delayed.read(projectId, () => current);
  current = false;
  resolveRequest({ data: valid, error: null });
  await assert.rejects(() => pending, /unavailable/);
  for (const status of ['selected', 'recorded', 'unresolved']) {
    response = { data: { projectId, operation: 'outcome', versionId, status }, error: null };
    assert.equal(await client.inspect(projectId, versionId, () => true), status);
  }
  response = { data: { projectId, operation: 'outcome', versionId: projectId, status: 'selected' }, error: null };
  await assert.rejects(() => client.inspect(projectId, versionId, () => true));
  const panelOutfile = join(dir, 'panel.cjs');
  await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Panel from './src/modules/website-builder/v2-ui/BuilderApplicationReleasePanel'; export const render = props => renderToStaticMarkup(React.createElement(Panel, props));`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', outfile: panelOutfile, jsx: 'automatic', alias: { '@': resolve('src') }, plugins: [{ name: 'panel-fixtures', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(supabase|ui-localization-cms)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path.endsWith('supabase') ? 'export const supabase = {functions:{invoke(){throw new Error("Rendering must not start a request");}}};' : 'export const useLocalizer = () => text => text;' }));
  } }] });
  const { render } = (await import(pathToFileURL(panelOutfile))).default;
  const html = render({ projectId: null });
  assert.match(html, /Save a cloud project/);
  assert.match(html, /disabled=""/);
  assert.match(html, /Check release result/);
  assert.doesNotMatch(html, /type="password"|sb_secret_/);
  const saved = render({ projectId });
  assert.match(saved, /Private release status/);
  assert.doesNotMatch(saved, /<button[^>]*>Publish</);
  console.log('PASS private release read client: scope/shape filtering, secret-safe errors, stale result denial and non-publishing panel rendering');
} finally { await rm(dir, { recursive: true, force: true }); }
