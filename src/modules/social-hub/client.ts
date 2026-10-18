import { supabase } from '@/lib/supabase';
export interface SocialScope { id: string; kind: 'customer' | 'official'; enabled: boolean; automation_enabled: boolean }
export interface SocialConnection { id: string; channel: string; external_account_id: string; status: string }
export interface SocialConversation {
  id: string; connection_id: string; external_id: string;
  status: 'open' | 'pending' | 'archived' | 'resolved' | 'human_required'; assigned_to: string | null; last_message_at: string;
}
export interface SocialMessage { id: string; conversation_id: string; direction: string; text: string; created_at: string }
export interface SocialNote { id: string; conversation_id: string; text: string; created_at: string }
export interface SocialInbox { scope: SocialScope; connections: SocialConnection[]; conversations: SocialConversation[]; messages: SocialMessage[]; notes: SocialNote[]; outbox: Array<{id:string;conversation_id:string;text:string;status:string}> }
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error('Social Hub is unavailable. Check access and deployment readiness.');
  return data as T;
}
export const socialHubClient = {
  scopes: () => rpc<SocialScope[]>('list_social_hub_scopes'),
  createScope: (kind: 'customer' | 'official') => rpc<string>('create_social_hub_scope', { p_kind: kind }),
  inbox: (scopeId: string) => rpc<SocialInbox>('get_social_hub_inbox', { p_scope_id: scopeId }),
  update: (id: string, patch: { status?: string; note?: string; assignedTo?: string | null }) => rpc('mutate_social_hub_conversation', {
    p_conversation_id: id, p_status: patch.status ?? null, p_note: patch.note ?? null,
    p_assigned_to: patch.assignedTo ?? null, p_set_assignment: 'assignedTo' in patch,
  }),
  enqueue: (id: string, text: string, key: string) => rpc<string>('enqueue_social_hub_message', {
    p_conversation_id: id, p_text: text, p_idempotency_key: key,
  }),
};
