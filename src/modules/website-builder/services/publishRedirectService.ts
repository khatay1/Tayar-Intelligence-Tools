import { supabase } from '@/lib/supabase';
import {
  normalizeEditorPublishRedirect,
  validateEditorPublishRedirects,
  type EditorPublishRedirect,
} from '../core/editor-publishing';

type RedirectRow = {
  id: string;
  project_id: string;
  user_id: string;
  source_path: string;
  target: string;
  status_code: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export function mapWebsitePublishRedirectRows(
  rows: Array<Record<string, unknown>> | null | undefined,
): EditorPublishRedirect[] {
  return (rows || []).map((row) => normalizeEditorPublishRedirect({
    id: String(row.id || ''),
    from: String(row.source_path || '/'),
    to: String(row.target || '/'),
    status: Number(row.status_code || 301) as EditorPublishRedirect['status'],
    enabled: row.enabled !== false,
  }));
}

function canonicalRedirects(redirects: EditorPublishRedirect[]) {
  return redirects
    .map(normalizeEditorPublishRedirect)
    .sort((a, b) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id));
}

function sameRedirects(left: EditorPublishRedirect[], right: EditorPublishRedirect[]) {
  const a = canonicalRedirects(left);
  const b = canonicalRedirects(right);
  return a.length === b.length && a.every((redirect, index) => {
    const other = b[index];
    return redirect.id === other.id && redirect.from === other.from && redirect.to === other.to
      && redirect.status === other.status && redirect.enabled === other.enabled;
  });
}

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
  if (redirects.length > 100) errors.push('A website can have at most 100 redirects.');
  if (errors.length) return { data: null, error: new Error(errors.join(' ')) };

  const payload = redirects.map((redirect) => ({
    id: redirect.id,
    from: redirect.from,
    to: redirect.to,
    status: redirect.status,
    enabled: redirect.enabled,
  }));

  const { data, error } = await supabase.rpc('website_replace_publish_redirects', {
    p_project_id: input.projectId,
    p_redirects: payload,
  });

  if (!error && data === redirects.length) {
    return { data: redirects, error: null };
  }

  // The transaction may have committed before a response was lost. Reconcile
  // against owner-scoped persisted rows before reporting failure or retrying.
  const reconciliation = await listWebsitePublishRedirects(input.projectId, input.ownerId);
  if (!reconciliation.error) {
    const stored = mapWebsitePublishRedirectRows(
      (reconciliation.data || []) as unknown as RedirectRow[],
    );
    if (sameRedirects(stored, redirects)) return { data: redirects, error: null };
  }

  return {
    data: null,
    error: error || reconciliation.error || new Error('Redirects could not be saved.'),
  };
}
