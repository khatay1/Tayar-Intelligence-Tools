import { useCallback, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { CVProjectAdapter } from './cv-project-sync';
import { CVDocument } from './cv-document';
import { saveCVEverywhere } from './cv-save-orchestrator';

interface UseCVPersistenceOptions {
  supabase: SupabaseClient;
  projects: CVProjectAdapter;
  userId?: string | null;
  initialCVId?: string | null;
  initialProjectId?: string | null;
}

type PendingSave = { document: CVDocument; title: string; atsScore: number };

export function useCVPersistence(options: UseCVPersistenceOptions) {
  const { supabase, projects, userId, initialCVId = null, initialProjectId = null } = options;
  const [cvId, setCVIdState] = useState<string | null>(initialCVId);
  const [projectId, setProjectIdState] = useState<string | null>(initialProjectId);
  const cvIdRef = useRef<string | null>(initialCVId);
  const projectIdRef = useRef<string | null>(initialProjectId);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const setCVId = useCallback((value: string | null) => { cvIdRef.current = value; setCVIdState(value); }, []);
  const setProjectId = useCallback((value: string | null) => { projectIdRef.current = value; setProjectIdState(value); }, []);

  const save = useCallback((document: CVDocument, title: string, atsScore: number) => {
    if (!userId) return Promise.resolve();
    const pending: PendingSave = { document, title, atsScore };
    const task = queueRef.current.catch(() => undefined).then(async () => {
      const result = await saveCVEverywhere(supabase, projects, {
        userId,
        cvId: cvIdRef.current,
        projectId: projectIdRef.current,
        title: pending.title,
        atsScore: pending.atsScore,
        document: pending.document,
      });
      setCVId(result.cvId);
      setProjectId(result.projectId);
    });
    queueRef.current = task;
    return task;
  }, [userId, projects, supabase, setCVId, setProjectId]);

  const flush = useCallback(() => queueRef.current, []);
  return { cvId, projectId, setCVId, setProjectId, save, flush };
}
