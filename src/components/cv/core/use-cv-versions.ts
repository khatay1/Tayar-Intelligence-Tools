import { useCallback, useRef, useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ResumeVersion, TemplateId } from '@/lib/cv-types';
import { createCVVersion, listCVVersions, nextCVVersionLabel } from './cv-versioning';

export function useCVVersions(supabase: SupabaseClient, userId?: string | null, cvId?: string | null) {
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const load = useCallback(async () => { if (!userId || !cvId) { setVersions([]); return []; } setLoading(true); try { const next=await listCVVersions(supabase,userId,cvId); setVersions(next); return next; } finally { setLoading(false); } }, [supabase,userId,cvId]);
  const save = useCallback((data: unknown, template: TemplateId) => {
    if (!userId || !cvId) return Promise.resolve<string | null>(null);
    const task=saveQueueRef.current.then(async()=>{ const current=await listCVVersions(supabase,userId,cvId); const label=nextCVVersionLabel(current); await createCVVersion(supabase,userId,cvId,data,template,label); await load(); return label; });
    saveQueueRef.current=task.catch(()=>undefined); return task;
  },[supabase,userId,cvId,load]);
  return { versions, loading, load, save };
}
