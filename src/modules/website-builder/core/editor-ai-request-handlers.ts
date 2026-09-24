import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AIBuilderMessage, AIBuilderStage } from './editor-ai-scope';
import type { AIWebsitePatchReview, AIWebsitePlanReview } from './editor-ai-patch-review';

interface AIRequestContext {
  aiBusy: boolean;
  aiQualityBusy: boolean;
  aiAbortControllerRef: MutableRefObject<AbortController | null>;
  aiQualityAbortControllerRef: MutableRefObject<AbortController | null>;
  aiOperationSequenceRef: MutableRefObject<number>;
  aiQualityOperationSequenceRef: MutableRefObject<number>;
  aiPlanReviewResolverRef: MutableRefObject<((approved: boolean) => void) | null>;
  aiPatchReviewResolverRef: MutableRefObject<((selectedOperationIds: string[] | null) => void) | null>;
  aiPatchReviewSelectionRef: MutableRefObject<string[]>;
  setAiPlanReview: Dispatch<SetStateAction<AIWebsitePlanReview | null>>;
  setAiPatchReview: Dispatch<SetStateAction<AIWebsitePatchReview | null>>;
  setAiBusy: Dispatch<SetStateAction<boolean>>;
  setAiQualityBusy: Dispatch<SetStateAction<boolean>>;
  setAiError: Dispatch<SetStateAction<string>>;
  setAiStage: Dispatch<SetStateAction<AIBuilderStage>>;
  setAiMessages: Dispatch<SetStateAction<AIBuilderMessage[]>>;
  resolveAICandidatePreview: (approved: boolean) => void;
  l: (text: string) => string;
}

export function createAIRequestHandlers({
  aiBusy, aiQualityBusy, aiAbortControllerRef, aiQualityAbortControllerRef,
  aiOperationSequenceRef, aiQualityOperationSequenceRef, aiPlanReviewResolverRef,
  aiPatchReviewResolverRef, aiPatchReviewSelectionRef, setAiPlanReview, setAiPatchReview,
  setAiBusy, setAiQualityBusy, setAiError, setAiStage, setAiMessages,
  resolveAICandidatePreview, l,
}: AIRequestContext) {
  function beginAIRequest(): AbortController {
    aiAbortControllerRef.current?.abort();
    const controller = new AbortController();
    aiAbortControllerRef.current = controller;
    return controller;
  }

  function finishAIRequest(controller: AbortController) {
    if (aiAbortControllerRef.current === controller) aiAbortControllerRef.current = null;
  }

  function resolveAIPlanReview(approved: boolean) {
    aiPlanReviewResolverRef.current?.(approved);
  }

  function requestAIPlanReview(plan: AIWebsitePlanReview, signal: AbortSignal): Promise<boolean> {
    signal.throwIfAborted();

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (approved: boolean) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        if (aiPlanReviewResolverRef.current === finish) aiPlanReviewResolverRef.current = null;
        setAiPlanReview(null);
        resolve(approved);
      };
      const handleAbort = () => finish(false);

      aiPlanReviewResolverRef.current = finish;
      setAiPlanReview(plan);
      signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  function resolveAIPatchReview(approved: boolean) {
    aiPatchReviewResolverRef.current?.(approved ? aiPatchReviewSelectionRef.current : null);
  }

  function requestAIPatchReview(review: AIWebsitePatchReview, signal: AbortSignal): Promise<string[] | null> {
    signal.throwIfAborted();

    return new Promise<string[] | null>((resolve) => {
      let settled = false;
      const finish = (selectedOperationIds: string[] | null) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', handleAbort);
        if (aiPatchReviewResolverRef.current === finish) aiPatchReviewResolverRef.current = null;
        aiPatchReviewSelectionRef.current = [];
        setAiPatchReview(null);
        resolve(selectedOperationIds);
      };
      const handleAbort = () => finish(null);

      aiPatchReviewResolverRef.current = finish;
      aiPatchReviewSelectionRef.current = review.selectedOperationIds;
      setAiPatchReview(review);
      signal.addEventListener('abort', handleAbort, { once: true });
    });
  }

  function toggleAIPatchReviewOperation(operationId: string) {
    setAiPatchReview((current) => {
      if (!current) return current;
      const selected = new Set(current.selectedOperationIds);
      if (selected.has(operationId)) selected.delete(operationId);
      else selected.add(operationId);
      const selectedOperationIds = current.operations
        .map((operation) => operation.id)
        .filter((id) => selected.has(id));
      aiPatchReviewSelectionRef.current = selectedOperationIds;
      const planStepIds = current.planStepIds || [];
      const coveredStepIds = new Set(current.operations
        .filter((operation) => selected.has(operation.id) && operation.planStepId)
        .map((operation) => operation.planStepId as string));
      const uncoveredPlanStepIds = planStepIds.filter((stepId) => !coveredStepIds.has(stepId));
      return {
        ...current,
        selectedOperationIds,
        planCoveragePercent: planStepIds.length ? Math.round((coveredStepIds.size / planStepIds.length) * 100) : 100,
        uncoveredPlanStepIds,
      };
    });
  }

  function stopAIRequest() {
    if (!aiBusy) return;
    aiOperationSequenceRef.current += 1;
    resolveAIPlanReview(false);
    resolveAIPatchReview(false);
    resolveAICandidatePreview(false);
    aiAbortControllerRef.current?.abort();
    aiAbortControllerRef.current = null;
    setAiBusy(false);
    setAiError('');
    setAiStage('ready');
    setAiMessages((current) => [
      ...current,
      { id: `ai-stopped-${Date.now()}`, role: 'assistant' as const, content: l('AI request stopped. No pending changes were applied.') },
    ].slice(-12));
  }

  function beginAIQualityRequest(): AbortController {
    aiQualityAbortControllerRef.current?.abort();
    const controller = new AbortController();
    aiQualityAbortControllerRef.current = controller;
    return controller;
  }

  function finishAIQualityRequest(controller: AbortController) {
    if (aiQualityAbortControllerRef.current === controller) aiQualityAbortControllerRef.current = null;
  }

  function stopAIQualityCheck() {
    if (!aiQualityBusy) return;
    aiQualityOperationSequenceRef.current += 1;
    aiQualityAbortControllerRef.current?.abort();
    aiQualityAbortControllerRef.current = null;
    setAiQualityBusy(false);
    setAiError('');
  }

  return { beginAIRequest, finishAIRequest, resolveAIPlanReview, requestAIPlanReview, resolveAIPatchReview, requestAIPatchReview, toggleAIPatchReviewOperation, stopAIRequest, beginAIQualityRequest, finishAIQualityRequest, stopAIQualityCheck };
}
