import { useCallback, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { CVData, ResumeVersion, TemplateId } from '@/lib/cv-types';
import { createCVVersion, listCVVersions, nextCVVersionLabel } from './cv-versioning';

export function useCVVersions(supabase: SupabaseClient, userId?: string | null, cvId?: string | null) {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !cvId) { setVersions([]); return []; }
    setLoading(true);
    try {
      const next = await listCVVersions(supabase, userId, cvId);
      setVersions(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [supabase, userId, cvId]);

  const save = useCallback(async (data: CVData, template: TemplateId) => {
    if (!userId || !cvId) return null;
    const current = versions.length ? versions : await listCVVersions(supabase, userId, cvId);
    const label = nextCVVersionLabel(current);
    await createCVVersion(supabase, userId, cvId, data, template, label);
    await load();
    return label;
  }, [supabase, userId, cvId, versions, load]);

  return { versions, loading, load, save };
}
