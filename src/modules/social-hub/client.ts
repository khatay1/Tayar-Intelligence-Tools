import { supabase } from '@/lib/supabase';
export interface SocialScope { id: string; kind: 'customer' | 'official'; enabled: boolean; automation_enabled: boolean }
export interface SocialProject { id:string; title:string; workspace_id:string|null }
export interface SocialConnection { id: string; channel: string; external_account_id: string; status: string }
export interface SocialConversation {
  id: string; connection_id: string; external_id: string;
  status: 'open' | 'pending' | 'archived' | 'resolved' | 'human_required'; assigned_to: string | null;
  crm_lead_id: string | null; last_message_at: string;
}
export interface SocialMessage { id: string; conversation_id: string; direction: string; text: string; created_at: string; occurred_at:string; attachment_refs:unknown }
export interface SocialMessagePage { messages:SocialMessage[]; nextBeforeId:string|null }
export interface SocialUnreadCount { conversationId:string; unread:number }
export interface SocialAssignee { id:string; name:string }
export interface SocialNote { id: string; conversation_id: string; text: string; created_at: string }
export interface SocialFollowup { id:string; conversation_id:string; title:string; body:string; status:'open'|'done'; source:'manual'|'handoff'; assigned_to:string|null; created_at:string }
export interface SocialCrmLead { id:string; name:string; email:string; stage:string; priority:number }
export interface SocialInbox { scope: SocialScope; connections: SocialConnection[]; conversations: SocialConversation[]; messages: SocialMessage[]; notes: SocialNote[]; outbox: Array<{id:string;conversation_id:string;text:string;status:string}>; followups:SocialFollowup[]; crmLeads:SocialCrmLead[]|null; unread:SocialUnreadCount[]; assignees:SocialAssignee[] }
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error('Social Hub is unavailable. Check access and deployment readiness.');
  return data as T;
}
export const socialHubClient = {
  scopes: () => rpc<SocialScope[]>('list_social_hub_scopes'),
  projects: async (userId:string):Promise<SocialProject[]> => {
    const {data,error}=await supabase.from('projects').select('id,title,workspace_id')
      .eq('user_id',userId).eq('type','website-builder').is('deleted_at',null).order('updated_at',{ascending:false}).limit(100);
    if(error)throw new Error('Project list unavailable.');
    return data??[];
  },
  createScope: (kind: 'customer' | 'official',project?:SocialProject) => rpc<string>('create_social_hub_scope', {
    p_kind:kind,p_workspace_id:project?.workspace_id??null,p_project_id:project?.id??null,
  }),
  inbox: (scopeId: string) => rpc<SocialInbox>('get_social_hub_inbox', { p_scope_id: scopeId }),
  unread: (scopeId:string) => rpc<SocialUnreadCount[]>('get_social_hub_unread_counts',{p_scope_id:scopeId}),
  assignees: (scopeId:string) => rpc<SocialAssignee[]>('list_social_hub_assignees',{p_scope_id:scopeId}),
  markRead: (conversationId:string) => rpc('mark_social_hub_conversation_read',{p_conversation_id:conversationId}),
  history: (conversationId:string,beforeId:string|null=null) => rpc<SocialMessagePage>('get_social_hub_message_history',{
    p_conversation_id:conversationId,p_before_id:beforeId,p_limit:50,
  }),
  update: (id: string, patch: { status?: string; note?: string; assignedTo?: string | null }) => rpc('mutate_social_hub_conversation', {
    p_conversation_id: id, p_status: patch.status ?? null, p_note: patch.note ?? null,
    p_assigned_to: patch.assignedTo ?? null, p_set_assignment: 'assignedTo' in patch,
  }),
  enqueue: (id: string, text: string, key: string) => rpc<string>('enqueue_social_hub_message', {
    p_conversation_id: id, p_text: text, p_idempotency_key: key,
  }),
  linkCrmLead: (conversationId:string,leadId:string|null) => rpc('link_social_hub_crm_lead', {
    p_conversation_id:conversationId,p_lead_id:leadId,
  }),
  createFollowup: (conversationId:string,title:string,body='') => rpc<string>('create_social_hub_followup', {
    p_conversation_id:conversationId,p_title:title,p_body:body,
  }),
  updateFollowup: (id:string,patch:{status?:'open'|'done';assignedTo?:string|null}) => rpc('mutate_social_hub_followup', {
    p_id:id,p_status:patch.status??null,p_assigned_to:patch.assignedTo??null,p_set_assignment:'assignedTo' in patch,
  }),
};
