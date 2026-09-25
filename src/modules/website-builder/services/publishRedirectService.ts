import { supabase } from '@/lib/supabase';
import {
  normalizeEditorPublishRedirect,
  validateEditorPublishRedirects,
  type EditorPublishRedirect,
} from '../core/editor-publishing';

export async function listWebsitePublishRedirects(projectId: string, ownerId: string) {
  return supabase
    .from('website_publish_redirects')
    .select('id, project_id, user_id, source_path, target, status_code, enabled, created_at, updated_at')
    .eq('project_id', projectId)
    .eq('user_id', ownerId)
    .order('source_path', { ascending: true });
}

export async function replaceWebsitePublishRedirects(input: {
  projectId: string;
  ownerId: string;
  redirects: EditorPublishRedirect[];
}) {
  const redirects = input.redirects.map(normalizeEditorPublishRedirect);
  const errors = validateEditorPublishRedirects(redirects);
  if (errors.length) return { data: null, error: new Error(errors.join(' ')) };

  const { error: deleteError } = await supabase
    .from('website_publish_redirects')
    .delete()
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);
  if (deleteError) return { data: null, error: deleteError };
  if (!redirects.length) return { data: [], error: null };

  return supabase
    .from('website_publish_redirects')
    .insert(redirects.map(redirect => ({
      id: redirect.id,
      project_id: input.projectId,
      user_id: input.ownerId,
      source_path: redirect.from,
      target: redirect.to,
      status_code: redirect.status,
      enabled: redirect.enabled,
    })))
    .select('id');
}

export function mapWebsitePublishRedirectRows(rows: Array<Record<string, unknown>> | null | undefined): EditorPublishRedirect[] {
  return (rows || []).map(row => normalizeEditorPublishRedirect({
    id: String(row.id || ''),
    from: String(row.source_path || '/'),
    to: String(row.target || '/'),
    status: Number(row.status_code || 301) as EditorPublishRedirect['status'],
    enabled: row.enabled !== false,
  }));
}
