import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-infra-slot-'));
try {
  const outfile = join(dir, 'slot.cjs');
  await build({ entryPoints: ['src/modules/website-builder/v2-ui/BuilderInfrastructureSettingsSlot.tsx'],
    bundle: true, platform: 'node', format: 'cjs', outfile, external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
    plugins: [{ name: 'browser-boundaries', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/ui-localization-cms$/ }, () => ({ path: 'localizer', namespace: 'test' }));
      builder.onResolve({ filter: /^@\/lib\/env$/ }, () => ({ path: 'env', namespace: 'test' }));
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: 'supabase', namespace: 'test' }));
      builder.onLoad({ filter: /^localizer$/, namespace: 'test' }, () => ({ contents: 'export const useLocalizer = () => text => text;', loader: 'js' }));
      builder.onLoad({ filter: /^env$/, namespace: 'test' }, () => ({ contents: `export const env = {
        supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabaseAnonKey: 'public',
        websiteGithubConnectionUrl: '', websiteSupabaseConnectionUrl: '', websiteVercelConnectionUrl: '' };`, loader: 'js' }));
      builder.onLoad({ filter: /^supabase$/, namespace: 'test' }, () => ({ contents: `export const supabase = {
        auth: { getSession: async () => ({ error: null, data: { session: null } }) }, rpc: async () => ({ error: null, data: [] }) };`, loader: 'js' }));
    } }],
  });
  const { BuilderInfrastructureSettingsSlot: Slot } = require(outfile);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const html = props => renderToStaticMarkup(React.createElement(Slot, props));
  const unsaved = html({ loadSequence: 1 });
  assert.match(unsaved, /data-testid="byo-infrastructure-panel"/);
  assert.match(unsaved, /Connection setup is not available yet/);
  assert.equal((unsaved.match(/<button type="button" disabled/g) ?? []).length, 3);
  const anonymous = html({ ownerId, projectId, ownerIsAnonymous: true, loadSequence: 2 });
  assert.doesNotMatch(anonymous, /infrastructure-connection-container/);
  const server = html({ ownerId, projectId, loadSequence: 2 });
  assert.match(server, /data-testid="byo-infrastructure-panel"/);
  assert.doesNotMatch(server, /infrastructure-connection-container/);
  const source = await readFile('src/modules/website-builder/v2-ui/BuilderInfrastructureSettingsSlot.tsx', 'utf8');
  assert.match(source, /createWebsiteConnectionEndpointCatalog/);
  assert.match(source, /createWebsiteInfrastructureController/);
  assert.match(source, /session[.]user[.]id !== ownerId/);
  assert.match(source, /window[.]sessionStorage/);
  const presentation = await readFile('src/modules/website-builder/v2-ui/WebsiteBuilderPresentation.tsx', 'utf8');
  assert.match(presentation, /<BuilderInfrastructureSettingsSlot projectId={cloudProjectId} ownerId={user[?][.]id} ownerIsAnonymous={user[?][.]is_anonymous}/);
  const example = await readFile('.env.example', 'utf8');
  for (const name of ['GITHUB', 'SUPABASE', 'VERCEL'])
    assert.match(example, new RegExp(`^VITE_WEBSITE_${name}_CONNECTION_URL=""$`, 'm'));
  console.log('PASS Infrastructure settings slot: saved/auth scope, SSR fail-closed panel, empty endpoint defaults and editor reachability');
} finally { await rm(dir, { recursive: true, force: true }); }
