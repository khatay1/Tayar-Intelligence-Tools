import { useCallback, useEffect, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ResumeVersion } from '@/lib/cv-types';
import { useCVBuilderCore } from './use-cv-builder-core';
import { useCVPersistence } from './use-cv-persistence';
import { useCVVersions } from './use-cv-versions';
import { useCVSections } from './use-cv-sections';
import { useCVQuality } from '../quality/use-cv-quality';
import { useCVAIProposals } from '../ai/use-cv-ai-proposals';
import { CVProjectAdapter } from './cv-project-sync';
import { CVDocument, normalizeCVDocument, serializeCVDocument } from './cv-document';
import { loadCVRecord } from './cv-persistence';

interface Options {
  supabase: SupabaseClient;
  projects: CVProjectAdapter;
  userId?: string | null;
  enabled?: boolean;
  initialProjectId?: string | null;
  initialCVId?: string | null;
}

export function useCVBuilderIntegration({ supabase, projects, userId, enabled = true, initialProjectId = null, initialCVId = null }: Options) {
  const persistence = useCVPersistence({ supabase, projects, userId, initialProjectId, initialCVId });
  const [jobDescription, setJobDescription] = useState('');
  const [atsScore, setAtsScore] = useState(0);
  const [initialLoadState, setInitialLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(initialProjectId || initialCVId ? 'loading' : 'idle');
  const loadedTargetRef = useRef<string | null>(null);
  const autosave = useCallback(async (document: CVDocument) => {
    const title = document.data.personal.fullName.trim() || 'Untitled Resume';
    await persistence.save(document, title, atsScore);
  }, [persistence.save, atsScore]);
  const core = useCVBuilderCore({ userId, cvId: persistence.cvId, enabled, autosave });
  const sectionsController = useCVSections(core.sections, core.setSections);
  const quality = useCVQuality(core.cv, core.template, jobDescription);
  const proposals = useCVAIProposals(core.cv, core.setData);
  const versionState = useCVVersions(supabase, userId, persistence.cvId);

  useEffect(() => {
    if (!enabled || !userId) return;
    const targetKey = initialProjectId ? `project:${initialProjectId}` : initialCVId ? `cv:${initialCVId}` : null;
    if (!targetKey) {
      core.restoreLocalDraft();
      setInitialLoadState('idle');
      return;
    }
    if (loadedTargetRef.current === targetKey) return;
    let cancelled = false;
    setInitialLoadState('loading');

    void (async () => {
      try {
        if (initialProjectId) {
          const { data, error } = await supabase
            .from('projects')
            .select('id,title,content,type')
            .eq('id', initialProjectId)
            .eq('user_id', userId)
            .maybeSingle();
          if (error) throw error;
          if (!data || data.type !== 'cv') throw new Error('CV project not found');
          if (cancelled) return;
          persistence.setProjectId(initialProjectId);
          core.hydrate(data.content);
        } else if (initialCVId) {
          const loaded = await loadCVRecord(supabase, userId, initialCVId);
          if (!loaded) throw new Error('CV not found');
          if (cancelled) return;
          persistence.setCVId(initialCVId);
          core.hydrate(loaded.document);
        }
        loadedTargetRef.current = targetKey;
        setInitialLoadState('loaded');
      } catch {
        if (!cancelled) setInitialLoadState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, userId, initialProjectId, initialCVId, supabase, core.hydrate, core.restoreLocalDraft, persistence.setProjectId, persistence.setCVId]);

  const saveCurrentVersion = useCallback(() => versionState.save(serializeCVDocument(core.document), core.template), [versionState.save, core.document, core.template]);
  const restoreVersion = useCallback((version: ResumeVersion) => {
    const value = version.data && typeof version.data === 'object' && ('cv' in (version.data as object) || 'schemaVersion' in (version.data as object))
      ? version.data : { cv: version.data, template: version.template };
    core.replaceDocument(normalizeCVDocument(value), true);
  }, [core.replaceDocument]);

  const flushAll = useCallback(async () => { await core.flushAutosave(); await persistence.flush(); }, [core.flushAutosave, persistence.flush]);

  return { ...core, initialLoadState, flushAutosave: flushAll, persistence, sectionsController, quality, proposals, versions: { versions: versionState.versions, loading: versionState.loading, load: versionState.load, saveCurrent: saveCurrentVersion, restore: restoreVersion }, jobDescription, setJobDescription, atsScore, setAtsScore };
}
