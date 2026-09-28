import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-published-form-'));
try {
  const outfile = join(dir, 'forms.cjs');
  await build({ stdin: { contents: `export { preparePublishedApplicationForms } from './src/modules/website-builder/core/application-published-forms';
    export { compileApplicationCreateForm } from './src/modules/website-builder/core/application-form-runtime';
    export { createSection } from './src/modules/website-builder/core/defaults';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'cjs', outfile });
  const { preparePublishedApplicationForms: prepare, compileApplicationCreateForm: compile, createSection } = (await import(pathToFileURL(outfile))).default;
  const section = createSection('contact');
  section.formAutomations = [{ enabled: false, secret: 'PRIVATE_AUTOMATION_SECRET' }];
  const application = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], pageAccess: [],
    tables: [{ id: 'records', key: 'records', name: 'Records', permissions: [{ operation: 'create', access: 'owner' }],
      fields: section.formFields.map((field, index) => ({ id: `db_${index}`, key: field.name, name: field.label, type: 'text', required: true })) }] };
  section.applicationFormBinding = { operation: 'create', tableId: 'records', fields: section.formFields.map((field, index) => ({ formFieldId: field.id, tableFieldId: `db_${index}` })) };
  const prepared = prepare(application, 'private-page', [section]);
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].pageId, 'private-page');
  assert.doesNotMatch(JSON.stringify(prepared), /PRIVATE_AUTOMATION_SECRET/);
  const entries = section.formFields.map(field => [field.name, field.type === 'email' ? 'user@example.com' : 'Example']);
  assert.deepEqual(compile(application, prepared[0].section, prepared[0].binding).values(entries), Object.fromEntries(entries));
  section.formFields[0].name = 'changed';
  assert.notEqual(prepared[0].section.formFields[0].name, 'changed', 'Private response captures a distinct form shape');
  assert.deepEqual(prepare(application, 'private-page', [createSection('hero')]), []);
  assert.throws(() => prepare(application, 'private-page', [section, section]), /Invalid application form section/);
  assert.throws(() => prepare(application, '', [section]), /Invalid application form page/);
  const invalid = structuredClone(prepared[0].section);
  invalid.applicationFormBinding = { operation: 'create', tableId: 'records', fields: [] };
  assert.throws(() => prepare(application, 'private-page', [invalid]), /form does not match/);
  console.log('PASS published form projection: validated binding, minimal private-page metadata, no automation secrets and duplicate/malformed refusal');
} finally { await rm(dir, { recursive: true, force: true }); }
