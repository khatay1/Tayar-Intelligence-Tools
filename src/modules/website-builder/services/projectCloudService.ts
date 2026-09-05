import { supabase } from '@/lib/supabase';
import { retryCloudOperation } from '../core/editor-project-lifecycle';

export interface WebsiteProjectCloudSaveInput {
  title: string;
  content: Record<string, unknown>;
  published: boolean;
  signal?: AbortSignal;
}

export interface CreateWebsiteProjectCloudInput extends WebsiteProjectCloudSaveInput {
  userId: string;
}

export interface UpdateWebsiteProjectCloudInput extends WebsiteProjectCloudSaveInput {
  projectId: string;
}

export interface CreatedWebsiteProjectCloudRow {
  id: string;
  title?: string | null;
  content?: unknown;
  updated_at?: string | null;
}

export interface WebsiteProjectCloudMutationResult<TData = unknown> {
  data: TData | null;
  error: { message: string } | null;
}

function missingMutationResult<TData>(message: string): WebsiteProjectCloudMutationResult<TData> {
  return { data: null, error: { message } };
}

export async function updateWebsiteProjectInCloud({
  projectId,
  title,
  content,
  published,
  signal,
}: UpdateWebsiteProjectCloudInput): Promise<WebsiteProjectCloudMutationResult<{ id: string; updated_at?: string | null }>> {
  return retryCloudOperation(async () => {
    const query = supabase
      .from('projects')
      .update({
        title,
        content,
        status: published ? 'completed' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select('id, updated_at')
      .maybeSingle();

    const abortableQuery = query as typeof query & {
      abortSignal?: (abortSignal: AbortSignal) => typeof query;
    };
    const result = await (
      signal && typeof abortableQuery.abortSignal === 'function'
        ? abortableQuery.abortSignal(signal)
        : query
    );

    if (!result.error && !result.data) {
      return missingMutationResult<{ id: string; updated_at?: string | null }>(
        'Cloud save did not match an accessible website project. Reopen the project before saving again.',
      );
    }

    return result;
  });
}

export async function createWebsiteProjectInCloud({
  userId,
  title,
  content,
  published,
  signal,
}: CreateWebsiteProjectCloudInput): Promise<
  WebsiteProjectCloudMutationResult<CreatedWebsiteProjectCloudRow>
> {
  return retryCloudOperation(() => {
    const query = supabase
      .from('projects')
      .insert({
        user_id: userId,
        title,
        type: 'website-builder',
        content,
        status: published ? 'completed' : 'draft',
      })
      .select('id, title, content, updated_at')
      .single();

    if (!signal) return query;
    const abortableQuery = query as typeof query & {
      abortSignal?: (abortSignal: AbortSignal) => typeof query;
    };
    return typeof abortableQuery.abortSignal === 'function'
      ? abortableQuery.abortSignal(signal)
      : query;
  });
}

export async function listWebsiteProjectsInCloud(signal?: AbortSignal) {
  const query = supabase
    .from('projects')
    .select('id, user_id, workspace_id, title, content, status, updated_at')
    .eq('type', 'website-builder')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  return signal ? query.abortSignal(signal) : query;
}

export async function updateWebsiteProjectPublicationState(input: {
  projectId: string;
  userId: string;
  content: Record<string, unknown>;
  published: boolean;
  updatedAt: string;
}): Promise<WebsiteProjectCloudMutationResult<{ id: string; updated_at?: string | null }>> {
  const result = await supabase
    .from('projects')
    .update({
      content: input.content,
      status: input.published ? 'completed' : 'draft',
      updated_at: input.updatedAt,
    })
    .eq('id', input.projectId)
    .eq('user_id', input.userId)
    .select('id, updated_at')
    .maybeSingle();

  if (!result.error && !result.data) {
    return missingMutationResult<{ id: string; updated_at?: string | null }>(
      'Publication state could not be verified for this website project.',
    );
  }

  return result;
}
