import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createAIService } from '@/lib/ai/service';
import type { EditorAIAsyncContext } from './editor-ai-operation-context';
import type { WebsiteBrand, WebsiteSection } from './types';

interface AIImagePromptContext {
  user: { id: string } | null;
  selectedSection: WebsiteSection | null;
  brand: WebsiteBrand;
  aiBusy: boolean;
  aiQualityBusy: boolean;
  aiAbortControllerRef: MutableRefObject<AbortController | null>;
  aiQualityAbortControllerRef: MutableRefObject<AbortController | null>;
  aiOperationSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  beginAIRequest: () => AbortController;
  finishAIRequest: (controller: AbortController) => void;
  captureAIEditorContext: () => EditorAIAsyncContext;
  aiEditorContextIsCurrent: (expected: EditorAIAsyncContext, requireSelection?: boolean) => boolean;
  setAiBusy: Dispatch<SetStateAction<boolean>>;
  setAiError: Dispatch<SetStateAction<string>>;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  l: (text: string) => string;
}

export function createAIImagePromptHandler({
  user, selectedSection, brand, aiBusy, aiQualityBusy, aiAbortControllerRef,
  aiQualityAbortControllerRef, aiOperationSequenceRef, activeUserIdRef,
  beginAIRequest, finishAIRequest, captureAIEditorContext,
  aiEditorContextIsCurrent, setAiBusy, setAiError, setSections, setSaved, l,
}: AIImagePromptContext) {
  async function generateImagePrompt() {
    if (aiAbortControllerRef.current || aiQualityAbortControllerRef.current) return;
    if (!selectedSection || aiBusy || aiQualityBusy) return;

    const operationSequence = ++aiOperationSequenceRef.current;
    const abortController = beginAIRequest();
    const operationUserId = user?.id ?? null;
    const operationContext = captureAIEditorContext();
    const operationIsLatest = () =>
      aiOperationSequenceRef.current === operationSequence &&
      activeUserIdRef.current === operationUserId;
    const operationCanApply = () =>
      operationIsLatest() &&
      aiEditorContextIsCurrent(operationContext, true);
    const targetSection = selectedSection;

    setAiBusy(true);
    setAiError('');

    try {
      const ai = createAIService('website-builder');

      const response = await ai.completeJSON<{
        prompt: string;
      }>(
        {
          action: 'image-prompt',
          section: targetSection,
          brand,
        },
        [],
        { temperature: 0.8, maxTokens: 800, signal: abortController.signal },
      );

      if (!operationCanApply()) return;

      if (!response.json?.prompt) {
        throw new Error(l('AI could not create image prompt.'));
      }

      setSections((current) => current.map((section) =>
        section.id === targetSection.id
          ? { ...section, imagePrompt: response.json!.prompt }
          : section
      ));
      setSaved(false);
    } catch (error) {
      if (!operationCanApply()) return;
      setAiError(
        error instanceof Error
          ? error.message
          : l('Image prompt generation failed.')
      );
    } finally {
      finishAIRequest(abortController);
      if (operationIsLatest()) setAiBusy(false);
    }
  }

  return generateImagePrompt;
}
