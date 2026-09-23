import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CVData, ColorTheme, SectionConfig, TemplateId } from '@/lib/cv-types';
import { createCVAutosaveController, CVSaveStatus } from './cv-autosave';
import { clearLocalCVDraft, loadLocalCVDraft, saveLocalCVDraft } from './cv-draft-recovery';
import { CVDocument, createCVDocument, normalizeCVDocument } from './cv-document';
import { canRedoCVHistory, canUndoCVHistory, commitCVHistory, createCVHistory, redoCVHistory, undoCVHistory } from './cv-history';

interface UseCVDocumentOptions {
  userId?: string | null;
  cvId?: string | null;
  autosave?: (document: CVDocument) => Promise<void>;
  enabled?: boolean;
}

export function useCVDocument(options: UseCVDocumentOptions = {}) {
  const { userId, cvId, autosave, enabled = true } = options;
  const [history, setHistory] = useState(() => createCVHistory(createCVDocument()));
  const [saveStatus, setSaveStatus] = useState<CVSaveStatus>('idle');
  const autosaveRef = useRef(createCVAutosaveController());
  const hydratedRef = useRef(false);
  const document = history.present;

  const replaceDocument = useCallback((next: CVDocument, recordHistory = true) => {
    setHistory(current => recordHistory ? commitCVHistory(current, next) : createCVHistory(next));
    setSaveStatus('dirty');
  }, []);

  const updateDocument = useCallback((recipe: (current: CVDocument) => CVDocument) => {
    setHistory(current => commitCVHistory(current, recipe(current.present)));
    setSaveStatus('dirty');
  }, []);

  const setData = useCallback((next: CVData | ((current: CVData) => CVData)) => {
    updateDocument(current => ({
      ...current,
      data: typeof next === 'function' ? next(current.data) : next,
    }));
  }, [updateDocument]);

  const updateSettings = useCallback((patch: Partial<CVDocument['settings']>) => {
    updateDocument(current => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, [updateDocument]);

  const restoreLocalDraft = useCallback(() => {
    if (!userId) return false;
    const snapshot = loadLocalCVDraft(userId, cvId);
    if (!snapshot) return false;
    setHistory(createCVHistory(snapshot.document));
    setSaveStatus('dirty');
    hydratedRef.current = true;
    return true;
  }, [userId, cvId]);

  const hydrate = useCallback((value: unknown) => {
    const next = normalizeCVDocument(value);
    setHistory(createCVHistory(next));
    setSaveStatus('saved');
    hydratedRef.current = true;
  }, []);

  const undo = useCallback(() => {
    setHistory(current => undoCVHistory(current));
    setSaveStatus('dirty');
  }, []);
  const redo = useCallback(() => {
    setHistory(current => redoCVHistory(current));
    setSaveStatus('dirty');
  }, []);

  useEffect(() => {
    if (!enabled || !userId || !hydratedRef.current) return;
    saveLocalCVDraft(userId, document, cvId);
    if (!autosave) return;
    setSaveStatus('dirty');
    autosaveRef.current.schedule(async () => {
      setSaveStatus('saving');
      try {
        await autosave(document);
        setSaveStatus('saved');
        clearLocalCVDraft(userId, cvId);
      } catch {
        setSaveStatus('error');
        throw new Error('CV autosave failed');
      }
    });
  }, [document, enabled, userId, cvId, autosave]);

  useEffect(() => () => autosaveRef.current.cancel(), []);

  return useMemo(() => ({
    document,
    cv: document.data,
    template: document.settings.template as TemplateId,
    colorTheme: document.settings.colorTheme as ColorTheme,
    fontId: document.settings.fontId,
    sections: document.settings.sections as SectionConfig[],
    saveStatus,
    setData,
    setTemplate: (template: TemplateId) => updateSettings({ template }),
    setColorTheme: (colorTheme: ColorTheme) => updateSettings({ colorTheme }),
    setFontId: (fontId: string) => updateSettings({ fontId }),
    setSections: (sections: SectionConfig[]) => updateSettings({ sections }),
    replaceDocument,
    hydrate,
    restoreLocalDraft,
    undo,
    redo,
    canUndo: canUndoCVHistory(history),
    canRedo: canRedoCVHistory(history),
    flushAutosave: () => autosaveRef.current.flush(),
  }), [document, saveStatus, setData, updateSettings, replaceDocument, hydrate, restoreLocalDraft, undo, redo, history]);
}
