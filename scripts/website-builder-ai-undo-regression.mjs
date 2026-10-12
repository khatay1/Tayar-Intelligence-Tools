import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/modules/website-builder/core/editor-ai-undo-handler.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { createAIUndoHandler } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const original = {
  pages: [{ id: 'page-a', sections: [{ id: 'section-a', elements: [{ id: 'element-a' }] }] }],
  activePageId: 'page-a', homePageId: 'page-a', siteName: 'Original',
  brand: { name: 'Original brand' }, seo: { title: 'Original title' },
  theme: { primaryColor: '#123456' }, headerConfig: { enabled: true },
  symbols: [{ id: 'symbol-a', name: 'Original symbol' }],
};
const current = {
  pages: [{ id: 'page-b', sections: [{ id: 'section-b', elements: [{ id: 'element-b' }] }] }],
  activePageId: 'page-b', homePageId: 'page-b', siteName: 'Changed',
  brand: { name: 'Changed brand' }, seo: { title: 'Changed title' },
  theme: { primaryColor: '#abcdef' }, headerConfig: { enabled: false },
  symbols: [{ id: 'symbol-b', name: 'Changed symbol' }],
};

function makeHandler({ projectIsCurrent = true, busy = false } = {}) {
  const calls = [];
  let context = { projectId: 'project-a' };
  let undoSnapshot = structuredClone(original);
  const dispatch = (name) => (value) => {
    calls.push([name, typeof value === 'function' ? value() : value]);
  };
  const handler = createAIUndoHandler({
    aiUndoSnapshot: undoSnapshot,
    aiBusy: busy,
    aiUndoContextRef: { current: context },
    aiProjectIdentityIsCurrent: () => projectIsCurrent,
    setAiUndoSnapshot: (value) => { undoSnapshot = typeof value === 'function' ? value(undoSnapshot) : value; calls.push(['undoSnapshot', undoSnapshot]); },
    setAiStage: dispatch('stage'), setAiMessages: (update) => calls.push(['messages', update([])]),
    setPages: dispatch('pages'), setActivePageId: dispatch('activePageId'), setHomePageId: dispatch('homePageId'),
    setSections: dispatch('sections'), setSelectedId: dispatch('selectedId'), setSelectedElementId: dispatch('selectedElementId'),
    setSiteName: dispatch('siteName'), setBrand: dispatch('brand'), setSeo: dispatch('seo'), setTheme: dispatch('theme'),
    setHeaderConfig: dispatch('headerConfig'), setSymbols: dispatch('symbols'), setSaved: dispatch('saved'), l: (text) => text,
  });
  return { handler, calls, getSnapshot: () => undoSnapshot };
}

const successful = makeHandler();
successful.handler();
const restored = Object.fromEntries(successful.calls.filter(([name]) => name !== 'messages').map(([name, value]) => [name, value]));
assert.deepEqual(restored.pages, original.pages);
assert.equal(restored.activePageId, original.activePageId);
assert.equal(restored.homePageId, original.homePageId);
assert.equal(restored.siteName, original.siteName);
assert.deepEqual(restored.brand, original.brand);
assert.deepEqual(restored.seo, original.seo);
assert.deepEqual(restored.theme, original.theme);
assert.deepEqual(restored.headerConfig, original.headerConfig);
assert.deepEqual(restored.symbols, original.symbols);
assert.equal(restored.selectedId, 'section-a');
assert.equal(restored.selectedElementId, 'element-a');
assert.equal(restored.stage, 'ready');
assert.equal(restored.saved, false);
assert.equal(successful.getSnapshot(), null);
assert.notStrictEqual(restored.pages, original.pages, 'restored pages are detached from the saved snapshot');
assert.notStrictEqual(restored.symbols, original.symbols, 'restored symbols are detached from the saved snapshot');

const stale = makeHandler({ projectIsCurrent: false });
stale.handler();
assert.deepEqual(stale.calls.map(([name]) => name), ['undoSnapshot']);
assert.equal(stale.getSnapshot(), null, 'stale project undo is discarded without restoring project data');

const busy = makeHandler({ busy: true });
busy.handler();
assert.deepEqual(busy.calls, [], 'undo is ignored while AI is still applying a change');

console.log('PASS Website Builder AI undo restores a detached full snapshot and rejects stale or busy operations');
