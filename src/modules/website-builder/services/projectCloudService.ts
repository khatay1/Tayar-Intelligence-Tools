import { supabase } from '@/lib/supabase';
import { retryCloudOperation } from '../core/editor-project-lifecycle';

export interface WebsiteProjectCloudSaveInput {
  title: string;
  content: Record<string, unknown>;
  published: boolean;
}

export interface CreateWebsiteProjectCloudInput extends WebsiteProjectCloudSaveInput {
  userId: string;
}

export interface UpdateWebsiteProjectCloudInput extends WebsiteProjectCloudSaveInput {
  projectId: string;
}

export async function updateWebsiteProjectInCloud({
  projectId,
  title,
  content,
  published,
}: UpdateWebsiteProjectCloudInput) {
  return retryCloudOperation(() =>
    supabase
      .from('projects')
      .update({
        title,
        content,
        status: published ? 'completed' : 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId),
  );
}

export async function createWebsiteProjectInCloud({
  userId,
  title,
  content,
  published,
}: CreateWebsiteProjectCloudInput) {
  return retryCloudOperation(() =>
    supabase
      .from('projects')
      .insert({
        user_id: userId,
        title,
        type: 'website-builder',
        content,
        status: published ? 'completed' : 'draft',
      })
      .select('id, title, content, updated_at')
      .single(),
  );
}

export async function listWebsiteProjectsInCloud() {
  return supabase
    .from('projects')
    .select('id, user_id, workspace_id, title, content, status, updated_at')
    .eq('type', 'website-builder')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
}

export async function updateWebsiteProjectPublicationState(input: {
  projectId: string;
  userId: string;
  content: Record<string, unknown>;
  published: boolean;
  updatedAt: string;
}) {
  return supabase
    .from('projects')
    .update({
      content: input.content,
      status: input.published ? 'completed' : 'draft',
      updated_at: input.updatedAt,
    })
    .eq('id', input.projectId)
    .eq('user_id', input.userId);
}
