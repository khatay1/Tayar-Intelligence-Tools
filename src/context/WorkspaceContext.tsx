import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ActiveContext {
  type: 'cv' | 'cover-letter' | 'document' | 'writer' | 'translation' | 'study' | 'project' | null;
  id: string | null;
  title: string | null;
  content?: string;
}

interface WorkspaceContextValue {
  activeContext: ActiveContext;
  setActiveContext: (ctx: ActiveContext) => void;
  clearActiveContext: () => void;
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  toggleAssistant: () => void;
  commandBarQuery: string;
  setCommandBarQuery: (q: string) => void;
}

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeContext, setActiveContextState] = useState<ActiveContext>({
    type: null, id: null, title: null,
  });
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [commandBarQuery, setCommandBarQuery] = useState('');

  const setActiveContext = useCallback((ctx: ActiveContext) => {
    setActiveContextState(ctx);
  }, []);

  const clearActiveContext = useCallback(() => {
    setActiveContextState({ type: null, id: null, title: null });
  }, []);

  const toggleAssistant = useCallback(() => {
    setAssistantOpen(prev => !prev);
  }, []);

  return (
    <WorkspaceCtx.Provider value={{
      activeContext, setActiveContext, clearActiveContext,
      assistantOpen, setAssistantOpen, toggleAssistant,
      commandBarQuery, setCommandBarQuery,
    }}>
      {children}
    </WorkspaceCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
