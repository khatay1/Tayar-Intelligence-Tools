import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-application-'));
try {
  async function load(name) {
    const outfile = join(temp, `${name}.cjs`);
    await build({ entryPoints: [`src/modules/website-builder/core/${name}.ts`], bundle: true, alias: { '@': resolve('src') }, define: { 'import.meta.env': '{}' }, platform: 'node', format: 'cjs', outfile });
    return (await import(pathToFileURL(outfile))).default;
  }
  const [model, validation, operations, command, history, snapshots, loaders, readiness] = await Promise.all([
    'application-model', 'application-validation', 'application-operations', 'editor-command',
    'editor-history', 'editor-project-snapshot', 'editor-apply-project-handler', 'application-publish-readiness',
  ].map(load));
  const base = { cloudProjectId: 'project-a', pages: [{ id: 'home', name: 'Home', sections: [{ id: 'hero', type: 'hero', elements: [] }] }] };
  const empty = model.createApplicationDefinition();
  assert.deepEqual(validation.readApplicationDefinition(undefined), empty, 'Old projects have a safe empty application model');
  const table = {
    id: 'vehicles', key: 'vehicles', name: 'Vehicles',
    fields: [{ id: 'vehicle-name', key: 'name', name: 'Name', type: 'text', required: true }],
    permissions: [{ operation: 'read', access: 'public' }],
  };
  const review = project => ({ projectId: project.cloudProjectId ?? null, fingerprint: operations.applicationFingerprint(project), reviewed: true });
  const apply = (project, plan, source = 'manual', approval = review(project), previousHistory = history.createEditorHistory()) => command.runEditorCommand(project, operations.createApplicationCommand(plan, approval, source), { history: previousHistory });
  const manual = apply(base, [{ type: 'put_table', table }]);
  assert.equal(manual.transaction.ok, true);
  assert.equal(base.application, undefined, 'Original state must never mutate');
  const ai = apply(manual.project, [
    { type: 'set_auth', auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true } },
    { type: 'put_role', role: { id: 'manager', name: 'Manager' } },
    { type: 'put_table', table: { ...table, permissions: [...table.permissions, { operation: 'update', access: 'role', roleId: 'manager' }] } },
    { type: 'set_page_access', rules: [{ pageId: 'home', access: 'role', roleId: 'manager' }] },
  ], 'ai', review(manual.project), manual.history);
  assert.equal(ai.transaction.ok, true);
  assert.equal(ai.project.application.tables.length, 1, 'AI edits the manually created table');
  assert.equal(ai.history.past.at(-1).source, 'ai');
  const undone = history.undoEditorHistory(ai.project, ai.history);
  assert.deepEqual(undone.value, manual.project);
  const redone = history.redoEditorHistory(undone.value, undone.history);
  assert.deepEqual(redone.value, ai.project);

  for (const [plan, approval] of [
    [[{ type: 'remove_role', roleId: 'manager' }], review(ai.project)],
    [[{ type: 'put_table', table: { ...table, fields: [{ ...table.fields[0], key: 'id' }] } }], review(ai.project)],
    [[{ type: 'put_table', table: { ...table, key: 'vehicles; drop table users' } }], review(ai.project)],
    [[{ type: 'put_table', table }], { ...review(ai.project), projectId: 'another-project' }],
    [[{ type: 'put_table', table }], review(base)],
    [[{ type: 'put_table', table }], { ...review(ai.project), reviewed: false }],
    [[{ type: 'run_sql', sql: 'select 1' }], review(ai.project)],
  ]) {
    const failed = apply(ai.project, plan, 'ai', approval);
    assert.equal(failed.transaction.ok, false);
    assert.deepEqual(failed.project, ai.project, 'Invalid plans roll back atomically');
    assert.equal(failed.history.past.length, 0);
  }
  const pendingReview = { ...review(base), reviewed: false };
  const pendingPlan = [{ type: 'put_table', table: structuredClone(table) }];
  const pendingCommand = operations.createApplicationCommand(pendingPlan, pendingReview, 'ai');
  pendingReview.reviewed = true;
  pendingPlan[0].table.key = 'mutated';
  const unreviewed = command.runEditorCommand(base, pendingCommand, { history: history.createEditorHistory() });
  assert.equal(unreviewed.transaction.ok, false, 'Caller mutations cannot approve an already captured plan');
  const capturedPlan = [{ type: 'put_table', table: structuredClone(table) }];
  const capturedCommand = operations.createApplicationCommand(capturedPlan, review(base), 'manual');
  capturedPlan[0].table.key = 'changed_after_review';
  const captured = command.runEditorCommand(base, capturedCommand, { history: history.createEditorHistory() });
  assert.equal(captured.project.application.tables[0].key, 'vehicles', 'Apply exactly the reviewed operation snapshot');
  const app = ai.project.application;
  for (const invalid of [
    { ...app, version: 2 },
    { ...app, secrets: { STRIPE_SECRET_KEY: 'private-test' } },
    { ...app, auth: { ...app.auth, serviceRoleKey: 'private-test' } },
    { ...app, tables: [...app.tables, app.tables[0]] },
    { ...app, tables: [{ ...table, permissions: [{ operation: 'create', access: 'public' }] }] },
    { ...app, tables: [{ ...table, fields: [{ ...table.fields[0], type: 'reference', referenceTableId: 'missing' }] }] },
    { ...app, tables: [{ ...table, fields: [{ ...table.fields[0], type: 'boolean', defaultValue: 'true' }] }] },
    { ...app, pageAccess: [{ pageId: 'missing', access: 'authenticated' }] },
  ]) assert.throws(() => validation.readApplicationDefinition(invalid, new Set(['home'])));

  const snapshot = snapshots.createEditorProjectSnapshot(ai.project);
  assert.equal(snapshot.version, 7);
  const persisted = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(validation.readApplicationDefinition(persisted.application), app);
  assert.notEqual(snapshots.fingerprintEditableProject(ai.project), snapshots.fingerprintEditableProject(manual.project));
  let restored;
  let mutations = 0;
  const setter = () => { mutations += 1; };
  const loader = loaders.createApplyProjectDataHandler(new Proxy({ prefs: { language: 'en' }, setApplication: value => { restored = value; mutations += 1; } }, { get: (target, key) => key in target ? target[key] : setter }));
  loader(persisted);
  assert.deepEqual(restored, app, 'Actual editor loader restores application definitions');
  loader(base);
  assert.equal(restored, undefined, 'Opening an old project clears previous application state');
  mutations = 0;
  assert.throws(() => loader({ ...persisted, application: { ...app, version: 999 } }));
  assert.equal(mutations, 0, 'Unsupported application data must fail before partial editor state changes');
  assert.deepEqual(readiness.applicationPublishBlockers(undefined, new Set(['home'])), []);
  assert.deepEqual(readiness.applicationPublishBlockers(empty, new Set(['home'])), []);
  assert.ok(readiness.applicationPublishBlockers(app, new Set(['home'])).some(issue => issue.code === 'backend-not-provisioned'));
  console.log('PASS application model, manual/AI commands, atomic rollback, identity, migration, actual reload, undo/redo and honest publish gate');
} finally {
  await rm(temp, { recursive: true, force: true });
}
