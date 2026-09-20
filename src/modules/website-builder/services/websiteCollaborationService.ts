import { supabase } from '@/lib/supabase';

export type WebsiteCommentAnchor = {
  pageId?: string;
  pageName?: string;
  sectionId?: string;
  elementId?: string;
};

export type WebsiteProjectComment = {
  id: string;
  projectId: string;
  userId: string;
  authorName: string;
  body: string;
  anchor: WebsiteCommentAnchor;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteProjectPresence = {
  project_id: string;
  user_id: string;
  display_name: string;
  page_id: string | null;
  selection: WebsiteCommentAnchor;
  last_seen_at: string;
};

export function listWebsiteProjectComments(projectId: string, includeResolved: boolean) {
  return supabase.rpc('list_website_project_comments', {
    p_project_id: projectId,
    p_include_resolved: includeResolved,
  });
}

export function createWebsiteProjectComment(projectId: string, body: string, anchor: WebsiteCommentAnchor) {
  return supabase.rpc('create_website_project_comment', {
    p_project_id: projectId,
    p_body: body,
    p_anchor: anchor,
  });
}

export function resolveWebsiteProjectComment(commentId: string, resolved: boolean) {
  return supabase.rpc('resolve_website_project_comment', {
    p_comment_id: commentId,
    p_resolved: resolved,
  });
}

export function deleteWebsiteProjectComment(commentId: string) {
  return supabase.rpc('delete_website_project_comment', { p_comment_id: commentId });
}

export function listWebsiteProjectPresence(projectId: string) {
  return supabase
    .from('website_project_presence')
    .select('project_id, user_id, display_name, page_id, selection, last_seen_at')
    .eq('project_id', projectId)
    .gte('last_seen_at', new Date(Date.now() - 90_000).toISOString())
    .order('last_seen_at', { ascending: false });
}

export function heartbeatWebsiteProjectPresence(input: WebsiteProjectPresence) {
  return supabase.from('website_project_presence').upsert(input, { onConflict: 'project_id,user_id' });
}

export function leaveWebsiteProjectPresence(projectId: string, userId: string) {
  return supabase.from('website_project_presence').delete().eq('project_id', projectId).eq('user_id', userId);
}
