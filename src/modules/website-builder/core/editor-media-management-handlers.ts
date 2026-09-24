import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { createElement } from './defaults';
import type { EditorAIAsyncContext } from './editor-ai-operation-context';
import type { WebsiteElement, WebsiteSection } from './types';
import type { WebsiteMediaAsset } from './website-builder-model';
import { deleteWebsiteMediaFile, getWebsiteMediaPublicUrl, uploadWebsiteMediaFile } from '../services/websiteMediaService';

interface MediaManagementContext {
  user: { id: string } | null;
  l: (text: string) => string;
  sections: WebsiteSection[];
  selectedSection: WebsiteSection | null;
  selectedElement: WebsiteElement | null;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setMediaError: Dispatch<SetStateAction<string>>;
  setMediaUploading: Dispatch<SetStateAction<boolean>>;
  setMediaAssets: Dispatch<SetStateAction<WebsiteMediaAsset[]>>;
  mediaUploadSequenceRef: MutableRefObject<number>;
  mediaDeleteSequenceRef: MutableRefObject<number>;
  projectLoadSequenceRef: MutableRefObject<number>;
  activeUserIdRef: MutableRefObject<string | null>;
  captureAIEditorContext: () => EditorAIAsyncContext;
  aiEditorContextIsCurrent: (expected: EditorAIAsyncContext, requireSelection?: boolean) => boolean;
  refreshMedia: (expectedUserId?: string | null) => Promise<void>;
  remember: (current: WebsiteSection[], label?: string) => void;
  updateSelectedElement: (changes: Partial<WebsiteElement>, responsive?: boolean) => void;
}

export function createMediaManagementHandlers({
  user,
  l,
  sections,
  selectedSection,
  selectedElement,
  setSections,
  setSelectedElementId,
  setSaved,
  setMediaError,
  setMediaUploading,
  setMediaAssets,
  mediaUploadSequenceRef,
  mediaDeleteSequenceRef,
  projectLoadSequenceRef,
  activeUserIdRef,
  captureAIEditorContext,
  aiEditorContextIsCurrent,
  refreshMedia,
  remember,
  updateSelectedElement,
}: MediaManagementContext) {
  function applyMediaAsset(asset: WebsiteMediaAsset) {
    if (!selectedSection) return;

    if (selectedElement?.type === 'image') {
      updateSelectedElement({ src: asset.url, content: asset.name });
      return;
    }

    remember(sections);
    const element: WebsiteElement = {
      ...createElement('image', selectedSection.accent),
      src: asset.url,
      content: asset.name,
    };
    setSections((current) => current.map((section) =>
      section.id === selectedSection.id
        ? { ...section, elements: [...section.elements, element] }
        : section
    ));
    setSelectedElementId(element.id);
    setSaved(false);
  }

  async function uploadMediaFile(file: File) {
    const uploadUserId = user?.id ?? null;
    if (!uploadUserId) {
      setMediaError('Sign in before uploading media.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setMediaError('Only image files are supported.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMediaError('Images must be 5 MB or smaller.');
      return;
    }

    const uploadSequence = ++mediaUploadSequenceRef.current;
    const uploadProjectSequence = projectLoadSequenceRef.current;
    const uploadEditorContext = captureAIEditorContext();
    const uploadIsCurrentUser = () =>
      mediaUploadSequenceRef.current === uploadSequence &&
      activeUserIdRef.current === uploadUserId;

    setMediaUploading(true);
    setMediaError('');

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    const path = `${uploadUserId}/${Date.now()}-${base}.${extension}`;

    try {
      const { error } = await uploadWebsiteMediaFile(path, file);

      if (!uploadIsCurrentUser()) return;

      if (error) {
        setMediaError('Could not upload this image.');
        return;
      }

      const publicUrl = getWebsiteMediaPublicUrl(path);
      await refreshMedia(uploadUserId);

      if (!uploadIsCurrentUser()) return;

      if (
        projectLoadSequenceRef.current === uploadProjectSequence &&
        aiEditorContextIsCurrent(uploadEditorContext, true) &&
        selectedElement?.type === 'image'
      ) {
        updateSelectedElement({ src: publicUrl, content: file.name });
      }
    } finally {
      if (uploadIsCurrentUser()) {
        setMediaUploading(false);
      }
    }
  }
  async function deleteMediaAsset(asset: WebsiteMediaAsset) {
    const deleteUserId = user?.id ?? null;
    if (!deleteUserId) return;
    if (!window.confirm(`${l('Delete')} ${asset.name} ${l('from your media library?')}`)) return;

    const deleteSequence = ++mediaDeleteSequenceRef.current;
    const deleteProjectSequence = projectLoadSequenceRef.current;
    const deleteEditorContext = captureAIEditorContext();
    const deleteIsCurrentUser = () =>
      mediaDeleteSequenceRef.current === deleteSequence &&
      activeUserIdRef.current === deleteUserId;

    setMediaError('');

    const { error } = await deleteWebsiteMediaFile(asset.path);

    if (!deleteIsCurrentUser()) return;

    if (error) {
      setMediaError('Could not delete this image.');
      return;
    }

    setMediaAssets((current) => current.filter((item) => item.path !== asset.path));

    if (
      projectLoadSequenceRef.current === deleteProjectSequence &&
      aiEditorContextIsCurrent(deleteEditorContext, true) &&
      selectedElement?.type === 'image' &&
      selectedElement.src === asset.url
    ) {
      updateSelectedElement({ src: '' });
    }
  }
  function openV2MediaUpload() {
    const input =
      document.createElement('input');

    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file =
        input.files?.[0];

      if (file) {
        void uploadMediaFile(file);
      }
    };

    input.click();
  }

  return { applyMediaAsset, uploadMediaFile, deleteMediaAsset, openV2MediaUpload };
}
