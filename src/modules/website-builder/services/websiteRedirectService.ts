import { supabase } from '@/lib/supabase';
import { normalizeEditorPublishRedirect, validateEditorPublishRedirects, type EditorPublishRedirect } from '../core/editor-publishing';

export async function listWebsiteRedirects(projectId: string, ownerId: string) {
  return supabase
    .from('website_redirects')
    .select('id, project_id, user_id, source_path, target, status_code, enabled, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', ownerId)
    .order('source_path', { ascending: true });
}

export async function saveWebsiteRedirects(input: { projectId: string; ownerId: string; redirects: EditorPublishRedirect[] }) {
  const redirects = input.redirects.map(normalizeEditorPublishRedirect);
  const errors = validateEditorPublishRedirects(redirects);
  if (errors.length) return { data: null, error: new Error(errors.join(' ')) };
  const rows = redirects.map(item => ({
    id: item.id,
    project_id: input.projectId,
    user_id: input.ownerId,
    source_path: item.from,
    target: item.to,
    status_code: item.status,
    enabled: item.enabled,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return { data: [], error: null };
  return supabase.from('website_redirects').upsert(rows, { onConflict: 'project_id,source_path' }).select('id');
}

export async function deleteWebsiteRedirect(input: { id: string; projectId: string; ownerId: string }) {
  return supabase
    .from('website_redirects')
    .delete()
    .eq('id', input.id)
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId)
    .select('id')
    .single();
}
