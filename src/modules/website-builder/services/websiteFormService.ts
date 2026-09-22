import { supabase } from '@/lib/supabase';

import { collectWebsiteFormDefinitions } from '../core/website-forms';
import type { WebsitePage } from '../core/website-builder-model';

export type WebsiteFormRow = {
  project_id: string;
  form_id: string;
  user_id: string;
  name: string;
  page_id: string;
  page_path: string;
  definition: Record<string, unknown>;
  published_at: string;
  updated_at: string;
};

export type WebsiteFormDelivery = {
  id: string;
  project_id: string;
  lead_id: string;
  automation_id: string;
  action_type: 'email' | 'webhook';
  destination_hint: string;
  status: 'pending' | 'processing' | 'delivered' | 'failed';
  attempts: number;
  last_error: string | null;
  response_status: number | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function snapshotPublishedWebsiteForms(projectId: string, ownerId: string) {
  return supabase.from('website_forms').select('project_id, form_id, user_id, name, page_id, page_path, definition, published_at, updated_at').eq('project_id', projectId).eq('user_id', ownerId);
}

export async function restorePublishedWebsiteForms(projectId: string, ownerId: string, rows: WebsiteFormRow[]) {
  const removed = await supabase.from('website_forms').delete().eq('project_id', projectId).eq('user_id', ownerId);
  if (removed.error || !rows.length) return removed;
  return supabase.from('website_forms').insert(rows);
}

export async function syncPublishedWebsiteForms(input: {
  projectId: string;
  ownerId: string;
  pages: WebsitePage[];
}) {
  const definitions = collectWebsiteFormDefinitions(input.pages);
  const rows = definitions.map((definition) => ({
    project_id: input.projectId,
    form_id: definition.id,
    user_id: input.ownerId,
    name: definition.name,
    page_id: definition.pageId,
    page_path: definition.pagePath,
    definition,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (rows.length) {
    const { error } = await supabase.from('website_forms').upsert(rows, { onConflict: 'project_id,form_id' });
    if (error) return { error };
  }

  const { data: existing, error: listError } = await supabase
    .from('website_forms')
    .select('form_id')
    .eq('project_id', input.projectId)
    .eq('user_id', input.ownerId);
  if (listError) return { error: listError };
  const currentIds = new Set(rows.map((row) => row.form_id));
  const staleIds = (existing || []).map((item) => String(item.form_id)).filter((id) => !currentIds.has(id));
  const { error } = staleIds.length
    ? await supabase.from('website_forms').delete().eq('project_id', input.projectId).eq('user_id', input.ownerId).in('form_id', staleIds)
    : { error: null };
  return { error, count: rows.length };
}

export async function listWebsiteFormDeliveries(projectId: string) {
  return supabase
    .from('website_form_deliveries')
    .select('id, project_id, lead_id, automation_id, action_type, destination_hint, status, attempts, last_error, response_status, delivered_at, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200);
}

export async function createWebsiteFormUploadUrl(path: string) {
  const normalized = path.trim();
  if (!normalized || normalized.includes('..') || normalized.startsWith('/')) {
    return { data: null, error: new Error('Invalid form upload path') };
  }
  return supabase.storage.from('website-form-uploads').createSignedUrl(normalized, 60);
}

export async function deleteWebsiteFormUploads(paths: string[]) {
  const normalized = [...new Set(paths.map((path) => path.trim()).filter((path) => path && !path.includes('..') && !path.startsWith('/')))].slice(0, 45);
  return normalized.length ? supabase.storage.from('website-form-uploads').remove(normalized) : { data: [], error: null };
}
