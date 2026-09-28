import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.tayar-secret-ui-'));
try {
  const outfile = join(dir, 'panel.cjs');
  await build({ entryPoints: ['src/modules/website-builder/v2-ui/BuilderIntegrationsMaxPanel.tsx'],
    bundle: true, platform: 'node', format: 'cjs', outfile, external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
    plugins: [{ name: 'localizer', setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/ui-localization-cms$/ }, () => ({ path: 'localizer', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useLocalizer = () => text => text;', loader: 'js' }));
    } }],
  });
  const { BuilderIntegrationsMaxPanel: Panel } = require(outfile);
  const connection = { id: 'hook', providerId: 'webhook', name: 'Webhook', enabled: true, status: 'disconnected',
    environments: ['production'], config: { url: 'https://example.com/hook' }, secrets: {}, events: ['custom'],
    createdAt: '2026-09-28T00:00:00.000Z', updatedAt: '2026-09-28T00:00:00.000Z' };
  const render = (environments, onSetSecret) => renderToStaticMarkup(React.createElement(Panel, {
    config: { version: 1, connections: [{ ...connection, environments }] }, onChange() {}, onSetSecret,
  }));
  assert.match(render(['production']), /type="password"[^>]*autoComplete="new-password"/);
  assert.doesNotMatch(render(['production'], async () => {}), /type="password"[^>]*disabled/);
  assert.match(render(['preview', 'production'], async () => {}), /Choose exactly one environment/);
  assert.match(render(['preview', 'production'], async () => {}), /type="password"[^>]*disabled/);
  assert.match(render(['production']), /Secure secret storage is not connected yet/);
  const configured = renderToStaticMarkup(React.createElement(Panel, {
    config: { version: 1, connections: [{ ...connection, secrets: { signingSecret: { ref: 'secret://website/dddddddd-dddd-4ddd-8ddd-dddddddddddd/hook/signingSecret/production' } } }] },
    onChange() {}, onSetSecret: async () => {},
  }));
  assert.match(configured, /Configured — enter to replace/);
  const stale = renderToStaticMarkup(React.createElement(Panel, {
    config: { version: 1, connections: [{ ...connection, environments: ['staging'], secrets: { signingSecret: { ref: 'secret://website/dddddddd-dddd-4ddd-8ddd-dddddddddddd/hook/signingSecret/production' } } }] },
    onChange() {}, onSetSecret: async () => {},
  }));
  assert.doesNotMatch(stale, /Configured — enter to replace/);
  console.log('PASS integration secret panel: enabled only with a secure writer and one environment');
} finally { await rm(dir, { recursive: true, force: true }); }
