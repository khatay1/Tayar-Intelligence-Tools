import { useCallback, useEffect, useState } from 'react';
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

interface Options { supabase: SupabaseClient; projects: CVProjectAdapter; userId?: string | null; enabled?: boolean; }

export function useCVBuilderIntegration({ supabase, projects, userId, enabled = true }: Options) {
  const persistence = useCVPersistence({ supabase, projects, userId });
  const [jobDescription, setJobDescription] = useState('');
  const [atsScore, setAtsScore] = useState(0);
  const autosave = useCallback(async (document: CVDocument) => {
    const title = document.data.personal.fullName.trim() || 'Untitled Resume';
    await persistence.save(document, title, atsScore);
  }, [persistence.save, atsScore]);
  const core = useCVBuilderCore({ userId, cvId: persistence.cvId, enabled, autosave });
  const sectionsController = useCVSections(core.sections, core.setSections);
  const quality = useCVQuality(core.cv, core.template, jobDescription);
  const proposals = useCVAIProposals(core.cv, core.setData);
  const versionState = useCVVersions(supabase, userId, persistence.cvId);

  useEffect(() => { if (enabled && userId) core.restoreLocalDraft(); }, [enabled, userId]);

  const saveCurrentVersion = useCallback(() => versionState.save(serializeCVDocument(core.document), core.template), [versionState.save, core.document, core.template]);
  const restoreVersion = useCallback((version: ResumeVersion) => {
    const value = version.data && typeof version.data === 'object' && ('cv' in (version.data as object) || 'schemaVersion' in (version.data as object))
      ? version.data : { cv: version.data, template: version.template };
    core.replaceDocument(normalizeCVDocument(value), true);
  }, [core.replaceDocument]);

  const flushAll = useCallback(async () => { await core.flushAutosave(); await persistence.flush(); }, [core.flushAutosave, persistence.flush]);

  return { ...core, flushAutosave: flushAll, persistence, sectionsController, quality, proposals, versions: { versions: versionState.versions, loading: versionState.loading, load: versionState.load, saveCurrent: saveCurrentVersion, restore: restoreVersion }, jobDescription, setJobDescription, atsScore, setAtsScore };
}
