import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-infra-panel-'));
try {
  const outfile = join(dir, 'panel.cjs');
  await build({ entryPoints: ['src/modules/website-builder/v2-ui/BuilderInfrastructurePanel.tsx'], bundle: true,
    platform: 'node', format: 'cjs', outfile, external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
    plugins: [{ name: 'localizer', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/ui-localization-cms$/ }, () => ({ path: 'localizer', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useLocalizer = () => text => text;', loader: 'js' }));
    } }],
  });
  const { BuilderInfrastructurePanel: Panel } = require(outfile);
  const render = (props = {}) => renderToStaticMarkup(React.createElement(Panel, { connections: [], projectSaved: true, ...props }));
  const empty = render();
  assert.match(empty, /Connect your accounts after saving the project/);
  assert.match(empty, /Connection setup is not available yet/);
  assert.match(empty, /Connect account/);
  assert.match(empty, /Connect preview/);
  assert.match(empty, /Connect production/);

  const base = { id: '33333333-3333-4333-8333-333333333333', ownerId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222', accountId: 'user-team', targetId: 'target-1',
    permissions: ['contents:write'], version: 1, verifiedAt: '2026-09-28T20:00:00Z', updatedAt: '2026-09-28T20:00:00Z' };
  const slots = [
    { ...base, id: '33333333-3333-4333-8333-333333333331', provider: 'github', environment: 'preview', status: 'connected' },
    { ...base, id: '33333333-3333-4333-8333-333333333332', provider: 'supabase', environment: 'preview', status: 'outdated-schema' },
    { ...base, id: '33333333-3333-4333-8333-333333333334', provider: 'vercel', environment: 'preview', status: 'deployment-failed' },
    { ...base, id: '33333333-3333-4333-8333-333333333335', provider: 'vercel', environment: 'production', status: 'connected' },
  ];
  const ready = render({ connections: slots, availableProviders: ['github', 'supabase', 'vercel'], onConnect: async () => {} });
  assert.doesNotMatch(ready, /Infrastructure ready for publishing/, 'Connected, outdated schema and failed deployment are not readiness');
  assert.match(render({ connections: slots.map(item => ({ ...item, status: 'ready' })), availableProviders: ['github', 'supabase', 'vercel'], onConnect: async () => {} }), /Infrastructure ready for publishing/);
  assert.match(ready, /Manage connection/);
  assert.match(ready, /Manage preview/);
  assert.match(ready, /Manage production/);

  const missingProduction = render({ connections: slots.slice(0, 3),
    availableProviders: ['github', 'supabase', 'vercel'], onConnect: async () => {} });
  assert.doesNotMatch(missingProduction, /Infrastructure ready for publishing/);
  assert.match(missingProduction, /Connect production/);

  const wrongEnvironment = render({ connections: [{ ...slots[0], environment: 'production' }],
    availableProviders: ['github'], onConnect: async () => {} });
  assert.doesNotMatch(wrongEnvironment, /Infrastructure ready for publishing/);
  assert.match(wrongEnvironment, /Connect account/);

  assert.doesNotMatch(render({ connections: slots, requiresStripe: true,
    availableProviders: ['github', 'supabase', 'vercel'], onConnect: async () => {} }), /Infrastructure ready for publishing/);
  assert.match(render({ projectSaved: false, onConnect: async () => {} }), /button type="button" disabled/);
  const unavailable = render({ onConnect: async () => {} });
  assert.match(unavailable, /Connection setup is not available yet/);
  assert.equal((unavailable.match(/<button type="button" disabled/g) ?? []).length, 4);
  console.log('PASS infrastructure panel: publish-contract environments, accepted preflight states, dual Vercel targets and endpoint-gated actions');
} finally { await rm(dir, { recursive: true, force: true }); }
