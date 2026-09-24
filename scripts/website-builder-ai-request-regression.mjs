import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/modules/website-builder/core/editor-ai-request-handlers.ts', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const { createAIRequestHandlers } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const state = { plan: null, patch: null, busy: true, qualityBusy: true, messages: [] };
const setter = (key) => (next) => { state[key] = typeof next === 'function' ? next(state[key]) : next; };
const refs = {
  aiAbortControllerRef: { current: null },
  aiQualityAbortControllerRef: { current: null },
  aiOperationSequenceRef: { current: 0 },
  aiQualityOperationSequenceRef: { current: 0 },
  aiPlanReviewResolverRef: { current: null },
  aiPatchReviewResolverRef: { current: null },
  aiPatchReviewSelectionRef: { current: [] },
};
let candidateRejected = false;
const handlers = createAIRequestHandlers({
  ...refs,
  aiBusy: true,
  aiQualityBusy: true,
  setAiPlanReview: setter('plan'),
  setAiPatchReview: setter('patch'),
  setAiBusy: setter('busy'),
  setAiQualityBusy: setter('qualityBusy'),
  setAiError: setter('error'),
  setAiStage: setter('stage'),
  setAiMessages: setter('messages'),
  resolveAICandidatePreview: (approved) => { candidateRejected = !approved; },
  l: (text) => text,
});

const first = handlers.beginAIRequest();
const second = handlers.beginAIRequest();
assert.equal(first.signal.aborted, true, 'new AI requests cancel the previous request');
handlers.finishAIRequest(first);
assert.equal(refs.aiAbortControllerRef.current, second, 'an older request cannot clear the active controller');

const plan = handlers.requestAIPlanReview({ summary: 'Review' }, second.signal);
handlers.stopAIRequest();
assert.equal(await plan, false, 'stopping AI rejects an outstanding plan review');
assert.equal(second.signal.aborted, true);
assert.equal(refs.aiOperationSequenceRef.current, 1);
assert.equal(candidateRejected, true);
assert.equal(state.busy, false);
assert.equal(state.stage, 'ready');

const patchController = new AbortController();
const patch = handlers.requestAIPatchReview({ selectedOperationIds: ['keep'], operations: [{ id: 'keep' }, { id: 'skip' }] }, patchController.signal);
patchController.abort();
assert.equal(await patch, null, 'abort rejects an outstanding patch review');
assert.deepEqual(refs.aiPatchReviewSelectionRef.current, []);
assert.equal(state.patch, null);

const quality = handlers.beginAIQualityRequest();
handlers.stopAIQualityCheck();
assert.equal(quality.signal.aborted, true);
assert.equal(refs.aiQualityOperationSequenceRef.current, 1);
assert.equal(state.qualityBusy, false);

console.log('PASS Website Builder AI request cancellation and review lifecycle');
