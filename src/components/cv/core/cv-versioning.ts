import { SupabaseClient } from '@supabase/supabase-js';
import { CVData, ResumeVersion, TemplateId } from '@/lib/cv-types';

export async function listCVVersions(
  supabase: SupabaseClient,
  userId: string,
  cvId: string,
  limit = 20,
): Promise<ResumeVersion[]> {
  const { data, error } = await supabase
    .from('cv_versions')
    .select('*')
    .eq('cv_id', cvId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ResumeVersion[];
}

export async function createCVVersion(
  supabase: SupabaseClient,
  userId: string,
  cvId: string,
  data: CVData,
  template: TemplateId,
  label: string,
): Promise<void> {
  const { error } = await supabase.from('cv_versions').insert({
    cv_id: cvId,
    user_id: userId,
    version_label: label,
    data,
    template,
  });
  if (error) throw error;
}

export function nextCVVersionLabel(versions: ResumeVersion[]): string {
  const highest = versions.reduce((max, version) => {
    const match = /^v(\d+)$/i.exec(version.version_label ?? '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `v${highest + 1}`;
}
