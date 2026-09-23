import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import { createElement,SECTION_LABELS } from '../core/defaults';
import type { EditorAIAsyncContext } from '../core/editor-ai-operation-context';
import type { AIBuilderMessage } from '../core/editor-ai-scope';
import type { WebsiteElement,WebsiteSection } from '../core/types';

interface createAIImageHandlerDependencies {
  activeUserIdRef: React.MutableRefObject<string | null>;
  aiAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiBusy: boolean;
  aiEditorContextIsCurrent: (expected: EditorAIAsyncContext, requireSelection?: boolean) => boolean;
  aiOperationSequenceRef: React.MutableRefObject<number>;
  aiQualityAbortControllerRef: React.MutableRefObject<AbortController | null>;
  aiQualityBusy: boolean;
  beginAIRequest: () => AbortController;
  captureAIEditorContext: () => { loadSequence: number; userId: string | null; routeProjectId: string | null; projectId: string | null; ownerId: string | null; editableFingerprint: string; activePageId: string; sectionId: string | null; elementId: string | null; containerId: string | null; formFieldId: string | null; device: string; };
  finishAIRequest: (controller: AbortController) => void;
  l: (text: string) => string;
  pushProjectCheckpoint: (label: string, snapshot?: Record<string, unknown>) => void;
  remember: (current: WebsiteSection[], label?: string) => void;
  requestGeneratedImage: (prompt: string, signal?: AbortSignal) => Promise<{ url: string; assetPath?: string; persisted?: boolean; persistenceError?: string; }>;
  sections: WebsiteSection[];
  selectedElement: WebsiteElement | null;
  selectedSection: WebsiteSection | null;
  setAiBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setAiError: React.Dispatch<React.SetStateAction<string>>;
  setAiMessages: React.Dispatch<React.SetStateAction<AIBuilderMessage[]>>;
  setSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setSections: React.Dispatch<React.SetStateAction<WebsiteSection[]>>;
  user: User | null;
}

export function createAIImageHandler({
  activeUserIdRef,
  aiAbortControllerRef,
  aiBusy,
  aiEditorContextIsCurrent,
  aiOperationSequenceRef,
  aiQualityAbortControllerRef,
  aiQualityBusy,
  beginAIRequest,
  captureAIEditorContext,
  finishAIRequest,
  l,
  pushProjectCheckpoint,
  remember,
  requestGeneratedImage,
  sections,
  selectedElement,
  selectedSection,
  setAiBusy,
  setAiError,
  setAiMessages,
  setSaved,
  setSections,
  user,
}: createAIImageHandlerDependencies) {
  return async function generateRealImage() {
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
    const targetElementId = selectedElement?.type === 'image' ? selectedElement.id : null;
    const existingImageId = targetElementId
      ? null
      : targetSection.elements.find((element) => element.type === 'image')?.id ?? null;

    setAiBusy(true);
    setAiError('');
    pushProjectCheckpoint(`Before AI image · ${targetSection.title || SECTION_LABELS[targetSection.type]}`);

    try {
      const generatedImage = await requestGeneratedImage(
        targetSection.imagePrompt || targetSection.title || `Professional ${targetSection.type} website image`,
        abortController.signal,
      );

      if (!operationCanApply()) return;

      remember(sections);

      setSections((current) => current.map((section) => {
        if (section.id !== targetSection.id) return section;

        if (targetElementId) {
          return {
            ...section,
            image: generatedImage.url,
            elements: section.elements.map((element) =>
              element.id === targetElementId
                ? { ...element, src: generatedImage.url, content: targetSection.title || 'Generated image' }
                : element
            ),
          };
        }

        if (targetSection.type === 'hero') {
          return {
            ...section,
            image: generatedImage.url,
            backgroundMode: 'image',
            backgroundImage: generatedImage.url,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            overlayColor: '#000000',
            overlayOpacity: 0.42,
          };
        }

        if (existingImageId) {
          return {
            ...section,
            image: generatedImage.url,
            elements: section.elements.map((element) =>
              element.id === existingImageId
                ? { ...element, src: generatedImage.url, content: targetSection.title || 'Generated image' }
                : element
            ),
          };
        }

        const element: WebsiteElement = {
          ...createElement('image', targetSection.accent),
          src: generatedImage.url,
          content: targetSection.title || 'Generated image',
        };

        return {
          ...section,
          image: generatedImage.url,
          elements: [...section.elements, element],
        };
      }));

      setSaved(false);
      setAiMessages((current) => [
        ...current,
        { id: `ai-image-${Date.now()}`, role: 'assistant' as const, content: l('Generated the image, saved it to Media Library and applied it to the selected section.') },
      ].slice(-12));
    } catch (error) {
      if (!operationCanApply()) return;
      setAiError(error instanceof Error ? error.message : l('Image generation failed.'));
    } finally {
      finishAIRequest(abortController);
      if (operationIsLatest()) setAiBusy(false);
    }
  };
}
