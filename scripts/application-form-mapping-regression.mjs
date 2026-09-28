import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const dir = await mkdtemp(join(tmpdir(), 'tayar-form-ui-'));
try {
  const outfile = join(dir, 'ui.cjs');
  await build({ entryPoints: ['src/modules/website-builder/v2-ui/BuilderApplicationFormMapping.tsx'],
    bundle: true, platform: 'node', format: 'cjs', outfile, external: ['react', 'react/jsx-runtime'], jsx: 'automatic',
    plugins: [{ name: 'localizer', setup(build) {
      build.onResolve({ filter: /^@\/lib\/ui-localization-cms$/ }, () => ({ path: 'localizer', namespace: 'test' }));
      build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const useLocalizer = () => text => text;', loader: 'js' }));
    } }],
  });
  const { BuilderApplicationFormMapping: Mapping } = require(outfile);
  const formFields = [
    { id: 'name', name: 'name', label: 'Name', type: 'text', required: true },
    { id: 'email', name: 'email', label: 'Email', type: 'email', required: true },
  ];
  const section = { id: 'contact', type: 'contact', formFields, formAutomations: [], formSuccessAction: 'message' };
  const table = { id: 'records', key: 'records', name: 'Records', permissions: [{ operation: 'create', access: 'owner' }], fields: formFields.map(item => ({ id: `db_${item.id}`, key: item.name, name: item.label, type: 'text', required: true })) };
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], pageAccess: [], tables: [table] };
  const html = props => renderToStaticMarkup(React.createElement(Mapping, { section, application: app, disabled: false, onChange() {}, ...props }));
  assert.match(html(), /Application form data/);
  assert.match(html(), /Target table/);
  assert.match(html(), /Records/);
  assert.match(html(), /disabled="">Save data binding/);
  const binding = { operation: 'create', tableId: 'records', fields: formFields.map(item => ({ formFieldId: item.id, tableFieldId: `db_${item.id}` })) };
  const savedHtml = html({ section: { ...section, applicationFormBinding: binding } });
  assert.match(savedHtml, /Remove data binding/);
  assert.doesNotMatch(savedHtml, /disabled="">Save data binding/);
  assert.match(html({ application: { ...app, tables: [{ ...table, permissions: [] }] } }), /disabled="">Save data binding/);
  console.log('PASS form mapping SSR: create-permission table filtering, saved mapping, invalid candidate disabled');
} finally { await rm(dir, { recursive: true, force: true }); }
