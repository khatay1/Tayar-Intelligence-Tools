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
  assert.match(empty, /Connect account[^<]*<\/button>/);
  assert.match(empty, /button type="button" disabled/);
  const base = { id: '33333333-3333-4333-8333-333333333333', ownerId: '11111111-1111-4111-8111-111111111111',
    projectId: '22222222-2222-4222-8222-222222222222', environment: 'production', accountId: 'user-team', targetId: 'user/site',
    permissions: ['contents:write'], version: 1, verifiedAt: '2026-09-28T20:00:00Z', updatedAt: '2026-09-28T20:00:00Z' };
  const connected = render({ connections: [{ ...base, provider: 'github', status: 'connected' }], onConnect: async () => {} });
  assert.doesNotMatch(connected, /Infrastructure ready for publishing/);
  assert.match(connected, /Manage connection/);
  const ready = render({ connections: ['github', 'supabase', 'vercel'].map(provider => ({ ...base, provider, status: 'ready' })), onConnect: async () => {} });
  assert.match(ready, /Infrastructure ready for publishing/);
  assert.match(ready, /Not required/);
  assert.doesNotMatch(render({ connections: ['github', 'supabase', 'vercel'].map(provider => ({ ...base, provider, status: 'ready' })), requiresStripe: true }), /Infrastructure ready for publishing/);
  assert.match(render({ projectSaved: false, onConnect: async () => {} }), /button type="button" disabled/);
  console.log('PASS infrastructure panel: no false readiness, optional Stripe and disabled connect without a real handler');
} finally { await rm(dir, { recursive: true, force: true }); }
