import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

export type WebsiteRealtimeCursor = {
  x: number;
  y: number;
  viewportWidth?: number;
  viewportHeight?: number;
};

export type WebsiteRealtimePresence = {
  userId: string;
  displayName: string;
  pageId: string | null;
  selection: WebsiteCommentAnchor;
  cursor?: WebsiteRealtimeCursor;
  editingElementId?: string;
  revision?: string;
  updatedAt: string;
};

export type WebsiteRealtimeCollaborationHandlers = {
  onSync?: (peers: WebsiteRealtimePresence[]) => void;
  onJoin?: (peer: WebsiteRealtimePresence) => void;
  onLeave?: (peer: WebsiteRealtimePresence) => void;
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

function flattenRealtimePresence(state: Record<string, Array<{ presence_ref?: string } & WebsiteRealtimePresence>>): WebsiteRealtimePresence[] {
  const peers = Object.values(state).flat().filter((peer): peer is { presence_ref?: string } & WebsiteRealtimePresence => Boolean(peer?.userId));
  const newest = new Map<string, WebsiteRealtimePresence>();
  for (const peer of peers) {
    const current = newest.get(peer.userId);
    if (!current || Date.parse(peer.updatedAt) >= Date.parse(current.updatedAt)) newest.set(peer.userId, peer);
  }
  return [...newest.values()];
}

export function createWebsiteRealtimeCollaborationChannel(
  projectId: string,
  self: WebsiteRealtimePresence,
  handlers: WebsiteRealtimeCollaborationHandlers = {},
): RealtimeChannel {
  const channel = supabase.channel(`website-project:${projectId}`, {
    config: {
      presence: { key: self.userId },
      broadcast: { self: false, ack: true },
    },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      handlers.onSync?.(flattenRealtimePresence(channel.presenceState() as Record<string, Array<{ presence_ref?: string } & WebsiteRealtimePresence>>));
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      for (const peer of newPresences as unknown as WebsiteRealtimePresence[]) handlers.onJoin?.(peer);
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const peer of leftPresences as unknown as WebsiteRealtimePresence[]) handlers.onLeave?.(peer);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ ...self, updatedAt: new Date().toISOString() });
    });

  return channel;
}

export async function updateWebsiteRealtimePresence(channel: RealtimeChannel, presence: WebsiteRealtimePresence) {
  return channel.track({ ...presence, updatedAt: new Date().toISOString() });
}

export async function leaveWebsiteRealtimeCollaboration(channel: RealtimeChannel) {
  try {
    await channel.untrack();
  } finally {
    await supabase.removeChannel(channel);
  }
}

export function hasWebsiteEditingConflict(peers: WebsiteRealtimePresence[], selfUserId: string, pageId?: string, elementId?: string): WebsiteRealtimePresence | undefined {
  if (!elementId) return undefined;
  return peers.find((peer) => peer.userId !== selfUserId && peer.pageId === (pageId || null) && peer.editingElementId === elementId);
}
