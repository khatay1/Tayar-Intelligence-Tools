import { supabase } from '@/lib/supabase';
export interface AssistantSettings { enabled: boolean; external_approved: boolean; language: string; daily_limit: number }
export interface KnowledgeAnswer { id: string; question: string; answer: string; language: string; approved: boolean; sensitive: boolean }
export interface AssistantConfiguration { settings: AssistantSettings | null; knowledge: KnowledgeAnswer[] }
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Error('Assistant unavailable.'); return data as T;
}
export const socialAssistantClient = {
  configuration: (scopeId: string) => rpc<AssistantConfiguration | null>('get_social_hub_assistant_settings', { p_scope_id: scopeId }),
  configure: (scopeId: string, settings: AssistantSettings) => rpc('configure_social_hub_assistant', {
    p_scope_id: scopeId, p_enabled: settings.enabled, p_external_approved: settings.external_approved,
    p_language: settings.language, p_daily_limit: settings.daily_limit,
  }),
  saveAnswer: (scopeId: string, answer: Omit<KnowledgeAnswer, 'id'> & { id: string | null }) => rpc<string>('save_social_hub_knowledge', {
    p_scope_id: scopeId, p_id: answer.id, p_question: answer.question, p_answer: answer.answer,
    p_language: answer.language, p_approved: answer.approved, p_sensitive: answer.sensitive,
  }),
  review: (scopeId: string, messageId: string, redactedText: string, language: string) => rpc('review_social_hub_assistant_message', {
    p_scope_id: scopeId, p_message_id: messageId, p_redacted_text: redactedText, p_language: language,
  }),
  async suggest(scopeId: string, conversationId: string, messageId: string): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw Error('Assistant unavailable.');
    const response = await fetch('/api/social-assistant', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ scopeId, conversationId, messageId }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Assistant unavailable.');
    const text = await response.text(); if (text.length > 20000) throw Error('Assistant unavailable.');
    const body = JSON.parse(text);
    return body?.decision?.kind === 'suggestion' && body.decision.messageId === messageId
      && typeof body.decision.text === 'string' && body.decision.text.length <= 4000 ? body.decision.text : null;
  },
};
