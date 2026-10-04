import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-infra-container-'));
try {
  const outfile = join(dir, 'container.cjs');
  await build({ entryPoints: ['src/modules/website-builder/v2-ui/BuilderInfrastructureConnectionContainer.tsx'],
    bundle: true, platform: 'node', format: 'cjs', outfile, external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
    plugins: [{ name: 'localizer', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/ui-localization-cms$/ }, () => ({ path: 'localizer', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useLocalizer = () => text => text;', loader: 'js' }));
    } }],
  });
  const { BuilderInfrastructureConnectionContainer: Container } = require(outfile);
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const handoffId = '33333333-3333-4333-8333-333333333333';
  const scope = { ownerId, projectId, loadSequence: 9, isCurrent: () => true };
  const transport = { platformUrl: 'https://abcdefghijklmnopqrst.supabase.co', anonKey: 'public',
    getSession: async () => ({ ownerId, accessToken: 'header.payload.signature' }) };
  const render = handoff => {
    const state = { connections: [], handoff, loading: false, error: '' };
    const controller = { availableProviders: Object.freeze(['github', 'supabase', 'vercel']),
      transportFor: provider => provider === handoff?.provider || !handoff ? transport : null,
      getState: () => state, refresh: async () => state, consumeHandoff: () => handoff,
      clearHandoff() {}, begin: async () => '', dispose() {} };
    return renderToStaticMarkup(React.createElement(Container, { controller, scope, projectSaved: true }));
  };
  const base = render(null);
  assert.match(base, /data-testid="infrastructure-connection-container"/);
  assert.match(base, /data-testid="byo-infrastructure-panel"/);
  assert.doesNotMatch(base, /repository-chooser|project-chooser/);
  for (const provider of ['github', 'supabase', 'vercel']) {
    const html = render({ provider, handoff: { id: handoffId, ownerId, projectId, environment: 'preview', loadSequence: 9 } });
    const expected = provider === 'github' ? 'github-repository-chooser' : `${provider}-project-chooser`;
    assert.match(html, new RegExp(`data-testid="${expected}"`));
  }
  const source = await readFile('src/modules/website-builder/v2-ui/BuilderInfrastructureConnectionContainer.tsx', 'utf8');
  assert.match(source, /controller[.]consumeHandoff\(\)/);
  assert.match(source, /controller[.]refresh\(\)/);
  assert.match(source, /controller[.]dispose\(\)/);
  assert.match(source, /provider === 'stripe'/);
  assert.match(source, /controller[.]begin\(provider, environment\)/);
  assert.match(source, /handoff[.]handoff[.]environment/);
  const editor = await readFile('src/modules/website-builder/WebsiteBuilderTool.tsx', 'utf8');
  assert.doesNotMatch(editor, /BuilderInfrastructureConnectionContainer/);
  console.log('PASS Infrastructure container: status panel, three chooser transitions, refresh lifecycle and unmounted editor boundary');
} finally { await rm(dir, { recursive: true, force: true }); }
