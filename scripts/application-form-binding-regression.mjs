import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-form-binding-'));
try {
  const outfile = join(dir, 'binding.cjs');
  await build({ stdin: { contents: `export { preflightEditorNativeOperations } from './src/modules/website-builder/core/editor-operation-policy';
    export { inspectEditorSectionSemantic } from './src/modules/website-builder/core/editor-value-safety';
    export { cloneEditorSectionIndependent } from './src/modules/website-builder/core/editor-clone';
    export { cloneSectionWithFreshIds } from './src/modules/website-builder/core/website-builder-rendering';
    export { adaptEditorNativeOperation } from './src/modules/website-builder/core/editor-native-operation';
    export { runEditorCommand } from './src/modules/website-builder/core/editor-command';
    export { createEditorHistory, undoEditorHistory } from './src/modules/website-builder/core/editor-history';
    export { createSection } from './src/modules/website-builder/core/defaults';`, resolveDir: process.cwd(), loader: 'ts' },
  tsconfig: 'tsconfig.app.json', bundle: true, platform: 'node', format: 'cjs', outfile });
  const { preflightEditorNativeOperations: preflight, inspectEditorSectionSemantic: inspect,
    cloneEditorSectionIndependent: clone, cloneSectionWithFreshIds: cloneBuilder, createSection,
    adaptEditorNativeOperation: adapt, runEditorCommand: run, createEditorHistory: history, undoEditorHistory: undo } = (await import(pathToFileURL(outfile))).default;
  const section = createSection('contact');
  const binding = { operation: 'create', tableId: 'records', fields: section.formFields.map((field, index) => ({ formFieldId: field.id, tableFieldId: `db_${index}` })) };
  section.applicationFormBinding = binding;
  assert.equal(inspect(section).ok, true);
  const project = { pages: [{ id: 'home', sections: [section] }] };
  for (const source of ['manual', 'ai']) {
    assert.equal(preflight([{ action: 'update_section', source, pageId: 'home', sectionId: section.id, changes: { applicationFormBinding: binding } }], { project }).ok, true);
  }
  const bare = { pages: [{ id: 'home', sections: [{ ...section, applicationFormBinding: undefined }] }] };
  const save = adapt({ action: 'update_section', source: 'manual', pageId: 'home', sectionId: section.id, changes: { applicationFormBinding: binding } });
  assert.equal(save.ok, true);
  const saved = run(bare, save.command, { history: history() });
  assert.equal(saved.transaction.ok, true);
  assert.deepEqual(saved.project.pages[0].sections[0].applicationFormBinding, binding);
  assert.equal(JSON.parse(JSON.stringify(saved.project)).pages[0].sections[0].applicationFormBinding.tableId, 'records');
  assert.equal(undo(saved.project, saved.history).value.pages[0].sections[0].applicationFormBinding, undefined);
  const clear = adapt({ action: 'update_section', source: 'manual', pageId: 'home', sectionId: section.id, changes: { applicationFormBinding: undefined } });
  const cleared = run(saved.project, clear.command, { history: saved.history });
  assert.equal(cleared.transaction.ok, true);
  assert.equal(JSON.parse(JSON.stringify(cleared.project)).pages[0].sections[0].applicationFormBinding, undefined);
  for (const wrong of [{ ...binding, credential: 'secret' }, { ...binding, fields: [{ formFieldId: 'bad/path', tableFieldId: 'db_0' }] },
    { ...binding, fields: [{ formFieldId: section.formFields[0].id, tableFieldId: 'db_0', submittedValue: 'private' }] }]) {
    assert.equal(inspect({ ...section, applicationFormBinding: wrong }).ok, false);
    assert.equal(preflight([{ action: 'update_section', source: 'ai', pageId: 'home', sectionId: section.id, changes: { applicationFormBinding: wrong } }], { project }).ok, false);
  }
  assert.equal(inspect({ ...section, type: 'hero' }).ok, false);
  const copies = [clone(section, (kind, id) => `${kind}-copy-${id}`), cloneBuilder(section)];
  for (const copy of copies) {
    assert.notEqual(copy.id, section.id);
    assert.deepEqual(copy.applicationFormBinding.fields.map(field => field.formFieldId), copy.formFields.map(field => field.id));
    assert.deepEqual(copy.applicationFormBinding.fields.map(field => field.tableFieldId), binding.fields.map(field => field.tableFieldId));
    assert.equal(inspect(copy).ok, true);
  }
  assert.deepEqual(section.applicationFormBinding, binding, 'Cloning cannot mutate source references');
  console.log('PASS application form binding: shared manual/AI operation shape, reference isolation and clone remapping');
} finally { await rm(dir, { recursive: true, force: true }); }
