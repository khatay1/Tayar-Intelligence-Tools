import { supabase } from '@/lib/supabase';
import { createAIService } from '@/lib/ai/service';
import type {
  ConversationPriority, ConversationStatus, SocialConversationSummary, SocialConversationThread,
  SocialAutomation, SocialHubOverview, SocialProvider, SocialWorkspace,
} from './social-hub-model';

function dataOrThrow<T>(data: unknown, error: { message?: string } | null): T {
  if (error) throw new Error(error.message || 'Social Hub request failed.');
  return data as T;
}

export async function listSocialWorkspaces(): Promise<SocialWorkspace[]> {
  const { data, error } = await supabase.rpc('list_team_workspaces');
  return dataOrThrow<SocialWorkspace[]>(data ?? [], error);
}

export async function resolveSocialHub(workspaceId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_social_hub', { p_workspace_id: workspaceId });
  return dataOrThrow<string | null>(data, error);
}

export async function ensureSocialHub(workspaceId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_social_hub', { p_workspace_id: workspaceId });
  return dataOrThrow<string>(data, error);
}

export async function getSocialHubOverview(hubId: string): Promise<SocialHubOverview> {
  const { data, error } = await supabase.rpc('social_hub_overview', { p_hub_id: hubId });
  return dataOrThrow<SocialHubOverview>(data, error);
}

export async function listSocialConversations(input: {
  hubId: string; status?: ConversationStatus | null; provider?: SocialProvider | null; limit?: number;
}): Promise<SocialConversationSummary[]> {
  const { data, error } = await supabase.rpc('list_social_conversations', {
    p_hub_id: input.hubId,
    p_status: input.status ?? null,
    p_provider: input.provider ?? null,
    p_limit: input.limit ?? 50,
    p_before: null,
    p_before_id: null,
  });
  return dataOrThrow<SocialConversationSummary[]>(data ?? [], error);
}

export async function getSocialConversation(hubId: string, conversationId: string): Promise<SocialConversationThread> {
  const { data, error } = await supabase.rpc('get_social_conversation', {
    p_hub_id: hubId, p_conversation_id: conversationId, p_limit: 200,
  });
  return dataOrThrow<SocialConversationThread>(data, error);
}

export async function queueSocialReply(hubId: string, conversationId: string, body: string, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('queue_social_reply', {
    p_hub_id: hubId, p_conversation_id: conversationId, p_body: body, p_request_id: requestId,
  });
  return dataOrThrow<string>(data, error);
}

export async function updateSocialConversation(
  hubId: string,
  conversationId: string,
  status: ConversationStatus,
  priority: ConversationPriority,
): Promise<void> {
  const { error } = await supabase.rpc('update_social_conversation', {
    p_hub_id: hubId, p_conversation_id: conversationId, p_status: status, p_priority: priority,
  });
  if (error) throw new Error(error.message || 'Could not update the conversation.');
}

export async function generateSocialAiDraft(hubId: string, thread: SocialConversationThread, guidance = ''): Promise<{ id: string; body: string }> {
  const messages = thread.messages.slice(-20).map(message => ({ direction: message.direction, body: message.body.slice(0, 4000) }));
  const ai = createAIService('social-hub');
  const generated = await ai.complete({
    action: 'draft-reply',
    contact: { displayName: thread.contact.displayName, lifecycle: thread.contact.lifecycle, tags: thread.contact.tags.slice(0, 20) },
    messages,
    guidance: guidance.slice(0, 1000),
  }, [], { temperature: 0.35, maxTokens: 700 });
  const body = generated.content.trim();
  if (!body || body.length > 4000) throw new Error('AI returned an invalid reply draft.');
  const sourceMessageId = [...thread.messages].reverse().find(message => message.direction === 'inbound')?.id ?? null;
  const { data, error } = await supabase.rpc('create_social_ai_draft', {
    p_hub_id: hubId, p_conversation_id: thread.conversation.id, p_source_message_id: sourceMessageId, p_body: body,
  });
  return { id: dataOrThrow<string>(data, error), body };
}

export async function reviewSocialAiDraft(hubId: string, draftId: string, approve: boolean, requestId?: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('review_social_ai_draft', {
    p_hub_id: hubId, p_draft_id: draftId, p_approve: approve, p_request_id: requestId ?? null,
  });
  return dataOrThrow<string | null>(data, error);
}

export async function listSocialAutomations(hubId: string): Promise<SocialAutomation[]> {
  const { data, error } = await supabase.rpc('list_social_automations', { p_hub_id: hubId });
  return dataOrThrow<SocialAutomation[]>(data ?? [], error);
}

export async function saveSocialAutomation(hubId: string, automation: {
  id?: string | null; name: string; enabled: boolean; keyword: string; reply: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_social_automation', {
    p_hub_id: hubId, p_id: automation.id ?? null, p_name: automation.name, p_enabled: automation.enabled,
    p_trigger_type: 'keyword', p_conditions: { keyword: automation.keyword }, p_action_type: 'reply_template',
    p_action_config: { text: automation.reply },
  });
  return dataOrThrow<string>(data, error);
}
