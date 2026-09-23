import { useCallback } from 'react';
import { CVData, ColorTheme, SectionConfig, TemplateId } from '@/lib/cv-types';
import { useCVDocument } from './use-cv-document';
import { useCVEditor } from './use-cv-editor';
import { useCVKeyboard } from './use-cv-keyboard';

interface UseCVBuilderCoreOptions {
  userId?: string | null;
  cvId?: string | null;
  enabled?: boolean;
  autosave?: Parameters<typeof useCVDocument>[0]['autosave'];
  manualSave?: () => void | Promise<void>;
}

export function useCVBuilderCore(options: UseCVBuilderCoreOptions = {}) {
  const documentState = useCVDocument(options);
  const editor = useCVEditor(documentState.cv, documentState.setData);
  const flushAutosave = documentState.flushAutosave;
  const manualSave = options.manualSave;

  const save = useCallback(async () => {
    await flushAutosave();
    await manualSave?.();
  }, [flushAutosave, manualSave]);

  useCVKeyboard({
    enabled: options.enabled,
    undo: documentState.undo,
    redo: documentState.redo,
    save,
  });

  return {
    ...documentState,
    editor,
    save,
  };
}

export type CVBuilderCore = ReturnType<typeof useCVBuilderCore>;
export type CVBuilderSetters = {
  setCV: (next: CVData | ((current: CVData) => CVData)) => void;
  setTemplate: (template: TemplateId) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setFontId: (fontId: string) => void;
  setSections: (sections: SectionConfig[]) => void;
};
