import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/modules/website-builder/core/editor-ai-change-loader.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { createLazyAIChangeHandler } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function setup() {
  const sequence = { current: 0 };
  const loading = { current: null };
  let current = true;
  const busy = [];
  const errors = [];
  const deps = {
    aiBusy: false, aiQualityBusy: false, aiPrompt: 'Update heading',
    aiAbortControllerRef: { current: null },
    aiQualityAbortControllerRef: { current: null },
    aiOperationSequenceRef: sequence,
    captureAIEditorContext: () => ({ projectId: 'project-a' }),
    aiEditorContextIsCurrent: () => current,
    setAiBusy: (value) => busy.push(value),
    setAiError: (value) => errors.push(value),
    setAiStage: () => {},
    l: (value) => value,
  };
  return { sequence, loading, busy, errors, deps, invalidate: () => { current = false; } };
}

{
  const state = setup();
  let resolveImport;
  let applied = 0;
  const loadModule = () => new Promise((resolve) => { resolveImport = resolve; });
  const apply = createLazyAIChangeHandler(state.deps, state.loading, loadModule);
  const pending = apply();
  await apply();
  assert.deepEqual(state.busy, [true], 'a second click cannot start another import');
  state.sequence.current += 1; // Stop request or switch project while importing.
  state.busy.push(false);
  resolveImport({ createAIChangeHandler: () => async () => { applied += 1; } });
  await pending;
  assert.equal(applied, 0, 'a cancelled import cannot apply an AI edit');
  assert.deepEqual(state.busy, [true, false], 'cancelled import cannot change the next request state');
  assert.equal(state.loading.current, null);
}

{
  const state = setup();
  const pendingImports = [];
  let applied = 0;
  const apply = createLazyAIChangeHandler(state.deps, state.loading, () => new Promise((resolve) => pendingImports.push(resolve)));
  const first = apply();
  state.sequence.current += 1; // User cancels while the module is still downloading.
  const second = apply();
  assert.equal(pendingImports.length, 2, 'a new request can start without waiting for the cancelled download');
  pendingImports[0]({ createAIChangeHandler: () => async () => { applied += 1; } });
  await first;
  assert.equal(state.loading.current, 1, 'an old request cannot release the new loading guard');
  pendingImports[1]({ createAIChangeHandler: () => async () => { applied += 1; } });
  await second;
  assert.equal(applied, 1);
  assert.equal(state.loading.current, null);
}

{
  const state = setup();
  let resolveImport;
  let applied = 0;
  const pending = createLazyAIChangeHandler(state.deps, state.loading, () => new Promise((resolve) => { resolveImport = resolve; }))();
  state.invalidate(); // Selection or editable content changed during module loading.
  resolveImport({ createAIChangeHandler: () => async () => { applied += 1; } });
  await pending;
  assert.equal(applied, 0);
  assert.equal(state.loading.current, null);
  assert.deepEqual(state.busy, [true, false], 'stale selection releases the loading state');
}

{
  const state = setup();
  let applied = 0;
  const apply = createLazyAIChangeHandler(state.deps, state.loading, async () => ({
    createAIChangeHandler: () => async () => { applied += 1; },
  }));
  await apply();
  assert.equal(applied, 1, 'a current request reaches the AI handler');
  assert.deepEqual(state.busy, [true, false]);
}

console.log('PASS Website Builder lazy AI edit loading, cancellation and project context');
