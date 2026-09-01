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
