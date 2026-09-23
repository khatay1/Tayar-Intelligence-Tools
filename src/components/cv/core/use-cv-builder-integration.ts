import { useCallback, useMemo, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { CVData, ResumeVersion } from '@/lib/cv-types';
import { useCVBuilderCore } from './use-cv-builder-core';
import { useCVPersistence } from './use-cv-persistence';
import { useCVVersions } from './use-cv-versions';
import { useCVSections } from './use-cv-sections';
import { useCVQuality } from '../quality/use-cv-quality';
import { useCVAIProposals } from '../ai/use-cv-ai-proposals';
import { CVProjectAdapter } from './cv-project-sync';

interface Options {
  supabase: SupabaseClient;
  projects: CVProjectAdapter;
  userId?: string | null;
  enabled?: boolean;
}

export function useCVBuilderIntegration({ supabase, projects, userId, enabled = true }: Options) {
  const persistence = useCVPersistence({ supabase, projects, userId });
  const [jobDescription, setJobDescription] = useState('');

  const core = useCVBuilderCore({
    userId,
    cvId: persistence.cvId,
    enabled,
    autosave: async document => {
      const title = document.data.personal.fullName.trim() || 'Untitled Resume';
      await persistence.save(document, title, 0);
    },
  });

  const sections = useCVSections(core.sections, core.setSections);
  const quality = useCVQuality(core.cv, core.template, jobDescription);
  const proposals = useCVAIProposals(core.cv, core.setData);
  const versions = useCVVersions(supabase, userId, persistence.cvId);

  const saveVersion = useCallback(() => versions.save(core.cv, core.template), [versions, core.cv, core.template]);
  const restoreVersion = useCallback((version: ResumeVersion) => {
    core.setData(version.data as CVData);
    core.setTemplate(version.template as typeof core.template);
  }, [core]);

  return useMemo(() => ({
    ...core,
    persistence,
    sectionsController: sections,
    quality,
    proposals,
    versions: { ...versions, saveCurrent: saveVersion, restore: restoreVersion },
    jobDescription,
    setJobDescription,
  }), [core, persistence, sections, quality, proposals, versions, saveVersion, restoreVersion, jobDescription]);
}
