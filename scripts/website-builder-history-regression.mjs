import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/modules/website-builder/core/editor-edit-history-handlers.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { createEditHistoryHandlers } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

let history = [];
let future = [];
let restored = null;
let recoveryCount = 0;
const projectSections = [{ id: 'current', elements: [] }];
const originalSections = [{ id: 'before-edit', elements: [] }];
const snapshot = () => ({ pages: [{ id: 'active', sections: projectSections }, { id: 'other', sections: [] }], updatedAt: 'now' });
const setHistory = (next) => { history = typeof next === 'function' ? next(history) : next; };
const setFuture = (next) => { future = typeof next === 'function' ? next(future) : next; };
const create = (conflicts = false) => createEditHistoryHandlers({
  activePageId: 'active', history, future, buildProjectSnapshot: snapshot,
  setHistory, setFuture, setSaved: () => {}, skipNextAutosaveRef: { current: false },
  snapshotConflictsWithActiveProject: () => conflicts,
  prepareProjectStateRestore: () => {}, applyProjectData: (data) => { restored = data; },
  saveRecoverySnapshot: () => { recoveryCount += 1; },
  setCloudError: () => {}, setHistoryOpen: () => {}, setAutoSaveStatus: () => {}, l: (text) => text,
});

create().remember(originalSections, 'Before edit');
assert.equal(history.length, 1);
assert.deepEqual(history[0].snapshot.pages[0].sections, originalSections, 'history stores the supplied pre-mutation sections');
assert.notStrictEqual(history[0].snapshot.pages[0].sections, originalSections, 'history snapshots are independent copies');
assert.deepEqual(history[0].snapshot.pages[1].sections, [], 'other pages remain intact');
originalSections[0].id = 'changed-after-snapshot';
assert.equal(history[0].snapshot.pages[0].sections[0].id, 'before-edit');

create(true).undo();
assert.equal(restored, null, 'undo rejects a snapshot from another project');
assert.equal(history.length, 1);

create().undo();
assert.equal(restored.pages[0].sections[0].id, 'before-edit');
assert.equal(history.length, 0);
assert.equal(future.length, 1);
assert.equal(recoveryCount, 0, 'undo does not create an unrelated recovery snapshot');

console.log('PASS Website Builder history preserves pre-mutation sections and project identity');
