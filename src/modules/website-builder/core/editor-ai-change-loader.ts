import type { MutableRefObject } from 'react';
import type { AIChangeHandlerDependencies } from './editor-ai-change-handler';

type AIChangeModule = Pick<typeof import('./editor-ai-change-handler'), 'createAIChangeHandler'>;

// Keep the large AI patch engine out of the editor's initial JavaScript chunk.
// A pending import remains cancellable through the existing request sequence.
export function createLazyAIChangeHandler(
  dependencies: AIChangeHandlerDependencies,
  loadingRef: MutableRefObject<number | null>,
  loadModule: () => Promise<AIChangeModule> = () => import('./editor-ai-change-handler'),
) {
  return async function applyAIChange(requestedPrompt?: string) {
    const {
      aiBusy, aiQualityBusy, aiAbortControllerRef, aiQualityAbortControllerRef,
      aiOperationSequenceRef, aiPrompt, captureAIEditorContext,
      aiEditorContextIsCurrent, setAiBusy, setAiError, setAiStage, l,
    } = dependencies;
    if (loadingRef.current === aiOperationSequenceRef.current || aiBusy || aiQualityBusy || aiAbortControllerRef.current || aiQualityAbortControllerRef.current) return;
    if (!(typeof requestedPrompt === 'string' ? requestedPrompt : aiPrompt).trim()) return;

    const context = captureAIEditorContext();
    const sequence = aiOperationSequenceRef.current;
    const isCurrent = () =>
      aiOperationSequenceRef.current === sequence &&
      aiEditorContextIsCurrent(context, true);

    loadingRef.current = sequence;
    setAiBusy(true);
    setAiStage('planning');
    try {
      const { createAIChangeHandler } = await loadModule();
      if (!isCurrent()) return;
      await createAIChangeHandler(dependencies)(requestedPrompt);
    } catch (error) {
      if (!isCurrent()) return;
      setAiError(error instanceof Error ? error.message : l('AI edit failed.'));
      setAiStage('error');
    } finally {
      if (loadingRef.current === sequence) loadingRef.current = null;
      if (aiOperationSequenceRef.current === sequence && !aiAbortControllerRef.current) setAiBusy(false);
    }
  };
}
