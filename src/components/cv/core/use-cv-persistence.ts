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
  const [cvId, setCVIdState] = useState<string | null>(initialCVId);
  const [projectId, setProjectIdState] = useState<string | null>(initialProjectId);
  const cvIdRef = useRef<string | null>(initialCVId);
  const projectIdRef = useRef<string | null>(initialProjectId);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const latestRef = useRef<{ document: CVDocument; title: string; atsScore: number } | null>(null);

  const setCVId = useCallback((value: string | null) => {
    cvIdRef.current = value;
    setCVIdState(value);
  }, []);
  const setProjectId = useCallback((value: string | null) => {
    projectIdRef.current = value;
    setProjectIdState(value);
  }, []);

  const save = useCallback(async (document: CVDocument, title: string, atsScore: number) => {
    if (!userId) return;
    latestRef.current = { document, title, atsScore };
    if (inFlightRef.current) {
      await inFlightRef.current;
      const latest = latestRef.current;
      if (latest && latest.document !== document) await save(latest.document, latest.title, latest.atsScore);
      return;
    }

    const task = (async () => {
      const result = await saveCVEverywhere(supabase, projects, {
        userId,
        cvId: cvIdRef.current,
        projectId: projectIdRef.current,
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
  }, [userId, projects, supabase, setCVId, setProjectId]);

  return { cvId, projectId, setCVId, setProjectId, save };
}
