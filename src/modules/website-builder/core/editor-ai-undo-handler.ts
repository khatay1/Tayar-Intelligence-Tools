import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { EditorAIAsyncContext } from './editor-ai-operation-context';
import type { AIBuilderMessage, AIBuilderStage } from './editor-ai-scope';
import type { WebsiteBrand, WebsiteSection, WebsiteSEO } from './types';
import type { AIWebsiteUndoSnapshot, WebsiteHeaderConfig, WebsitePage, WebsiteSymbol, WebsiteTheme } from './website-builder-model';

interface AIUndoContext {
  aiUndoSnapshot: AIWebsiteUndoSnapshot | null;
  aiBusy: boolean;
  aiUndoContextRef: MutableRefObject<EditorAIAsyncContext | null>;
  aiProjectIdentityIsCurrent: (context: EditorAIAsyncContext) => boolean;
  setAiUndoSnapshot: Dispatch<SetStateAction<AIWebsiteUndoSnapshot | null>>;
  setAiStage: Dispatch<SetStateAction<AIBuilderStage>>;
  setAiMessages: Dispatch<SetStateAction<AIBuilderMessage[]>>;
  setPages: Dispatch<SetStateAction<WebsitePage[]>>;
  setActivePageId: Dispatch<SetStateAction<string>>;
  setHomePageId: Dispatch<SetStateAction<string>>;
  setSections: Dispatch<SetStateAction<WebsiteSection[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSiteName: Dispatch<SetStateAction<string>>;
  setBrand: Dispatch<SetStateAction<WebsiteBrand>>;
  setSeo: Dispatch<SetStateAction<WebsiteSEO>>;
  setTheme: Dispatch<SetStateAction<WebsiteTheme>>;
  setHeaderConfig: Dispatch<SetStateAction<WebsiteHeaderConfig>>;
  setSymbols: Dispatch<SetStateAction<WebsiteSymbol[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  l: (text: string) => string;
}

export function createAIUndoHandler({
  aiUndoSnapshot, aiBusy, aiUndoContextRef, aiProjectIdentityIsCurrent,
  setAiUndoSnapshot, setAiStage, setAiMessages, setPages, setActivePageId,
  setHomePageId, setSections, setSelectedId, setSelectedElementId, setSiteName,
  setBrand, setSeo, setTheme, setHeaderConfig, setSymbols, setSaved, l,
}: AIUndoContext) {
  function undoLastAIChange() {
    if (!aiUndoSnapshot || aiBusy) return;

    const undoContext = aiUndoContextRef.current;
    if (
      !undoContext ||
      !aiProjectIdentityIsCurrent(undoContext)
    ) {
      aiUndoContextRef.current = null;
      setAiUndoSnapshot(null);
      return;
    }

    const snapshot = aiUndoSnapshot;
    const restoredPages = JSON.parse(JSON.stringify(snapshot.pages)) as WebsitePage[];
    const restoredActive = restoredPages.find((page) => page.id === snapshot.activePageId) || restoredPages[0];
    setPages(restoredPages);
    setActivePageId(restoredActive?.id || snapshot.activePageId);
    setHomePageId(snapshot.homePageId);
    setSections(restoredActive?.sections || []);
    setSelectedId(restoredActive?.sections[0]?.id ?? null);
    setSelectedElementId(restoredActive?.sections[0]?.elements[0]?.id ?? null);
    setSiteName(snapshot.siteName);
    setBrand(snapshot.brand);
    setSeo(snapshot.seo);
    setTheme(snapshot.theme);
    setHeaderConfig(snapshot.headerConfig);
    setSymbols(JSON.parse(JSON.stringify(snapshot.symbols)) as WebsiteSymbol[]);
    aiUndoContextRef.current = null;
    setAiUndoSnapshot(null);
    setAiStage('ready');
    setSaved(false);
    setAiMessages((current) => [
      ...current,
      { id: `ai-undo-${Date.now()}`, role: 'assistant' as const, content: l('Reverted the last AI change.') },
    ].slice(-12));
  }

  return undoLastAIChange;
}
