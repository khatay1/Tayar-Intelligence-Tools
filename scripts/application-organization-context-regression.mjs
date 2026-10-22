import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url), dir = await mkdtemp(join(tmpdir(), 'tayar-organization-context-'));
try {
  await build({ entryPoints: ['src/modules/website-builder/core/application-form-runtime.ts',
    'src/modules/website-builder/core/application-data-view-controller.ts'], bundle: true, platform: 'node', format: 'cjs', outdir: dir,
    alias: { '@': resolve('src') } });
  const { compileApplicationCreateForm } = require(join(dir, 'application-form-runtime.js'));
  const { createApplicationDataViewController } = require(join(dir, 'application-data-view-controller.js'));
  const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const app = { version: 1, auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, roles: [], pageAccess: [],
    tenancy: { mode: 'organizations', organizationTableId: 'organizations' }, tables: [
      { id: 'organizations', key: 'organizations', name: 'Organizations', fields: [{ id: 'organization-name', key: 'name', name: 'Name', type: 'text', required: true }], permissions: [
        { operation: 'create', access: 'authenticated' }, { operation: 'read', access: 'organization' }, { operation: 'read', access: 'owner' },
        { operation: 'update', access: 'owner' }, { operation: 'delete', access: 'owner' }] },
      { id: 'projects', key: 'projects', name: 'Projects', organizationFieldId: 'project-organization', fields: [
        { id: 'project-organization', key: 'organization_id', name: 'Organization', type: 'reference', required: true, referenceTableId: 'organizations' },
        { id: 'project-name', key: 'name', name: 'Name', type: 'text', required: true }], permissions: [
        { operation: 'create', access: 'organization' }, { operation: 'read', access: 'organization' },
        { operation: 'update', access: 'organization' }, { operation: 'delete', access: 'organization' }] },
    ] };
  const section = { id: 'project-form', type: 'contact', title: 'Project', formFields: [
    { id: 'organization-input', name: 'organization_id', label: 'Organization', type: 'text', required: true },
    { id: 'name-input', name: 'name', label: 'Name', type: 'text', required: true }] };
  const formBinding = { operation: 'create', tableId: 'projects', fields: [
    { formFieldId: 'organization-input', tableFieldId: 'project-organization' },
    { formFieldId: 'name-input', tableFieldId: 'project-name' }] };
  const unscoped = compileApplicationCreateForm(app, section, formBinding);
  assert.throws(() => unscoped.values([['name', 'Roadmap']]), /form does not match/);
  const compiled = compileApplicationCreateForm(app, section, formBinding, organizationId.toUpperCase());
  assert.deepEqual(compiled.organization, { id: organizationId, fieldKey: 'organization_id', formName: 'organization_id' });
  assert.deepEqual(compiled.values([['name', 'Roadmap']]), { name: 'Roadmap', organization_id: organizationId });
  assert.throws(() => compiled.values([['name', 'Roadmap'], ['organization_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']]), /form does not match/);

  let created, updated, listed;
  const runtime = { auth: { async currentUser() { return { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', is_anonymous: false }; }, async currentRoles() { return []; } },
    async list(_tableId, options) { listed = options; return []; }, async createOnce(_tableId, values) { created = values; return 'created'; },
    async update(_tableId, _id, values) { updated = values; }, async remove() {} };
  const binding = { tableId: 'projects', columns: ['project-name'], actions: ['create', 'update'], pageSize: 10 };
  assert.throws(() => createApplicationDataViewController(app, binding, runtime, () => organizationId), /active organization/);
  const controller = createApplicationDataViewController(app, binding, runtime, () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', {
    organizationId, keyPrefix: 'tayar-app-form:project:user:page:data:view', storage: { getItem: () => null, setItem() {}, removeItem() {} },
    crypto: { randomUUID: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', subtle: globalThis.crypto.subtle },
  });
  await controller.load(); assert.deepEqual(listed.filters, [{ field: 'organization_id', operator: 'eq', value: organizationId }]);
  await controller.create({ name: 'Roadmap' }); assert.deepEqual(created, { organization_id: organizationId, name: 'Roadmap' });
  await assert.rejects(controller.create({ name: 'Forged', organization_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }), /scope cannot be changed/);
  await controller.update('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { name: 'Updated' }); assert.deepEqual(updated, { name: 'Updated' });
  await assert.rejects(controller.update('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { name: 'Forged', organization_id: organizationId }), /scope cannot be changed/);
  controller.dispose();
  console.log('PASS organization context: active selection injection, scoped reads, hidden form field compatibility and forged-scope denial');
} finally { await rm(dir, { recursive: true, force: true }); }
