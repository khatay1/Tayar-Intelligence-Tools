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

export function useCVPersistence(options: UseCVPersistenceOptions) {
  const { supabase, projects, userId, initialCVId = null, initialProjectId = null } = options;
  const [cvId, setCVId] = useState<string | null>(initialCVId);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const latestRef = useRef<{ document: CVDocument; title: string; atsScore: number } | null>(null);

  const save = useCallback(async (document: CVDocument, title: string, atsScore: number) => {
    if (!userId) return;
    latestRef.current = { document, title, atsScore };
    if (inFlightRef.current) {
      await inFlightRef.current;
      if (latestRef.current?.document !== document) return save(latestRef.current!.document, latestRef.current!.title, latestRef.current!.atsScore);
      return;
    }

    const task = (async () => {
      const result = await saveCVEverywhere(supabase, projects, {
        userId,
        cvId,
        projectId,
        title,
        atsScore,
        document,
      });
      setCVId(result.cvId);
      setProjectId(result.projectId);
    })();
    inFlightRef.current = task;
    try {
      await task;
    } finally {
      if (inFlightRef.current === task) inFlightRef.current = null;
    }
  }, [userId, cvId, projectId, projects, supabase]);

  return { cvId, projectId, setCVId, setProjectId, save };
}
