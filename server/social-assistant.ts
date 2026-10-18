/** Grounded, local Social Assistant. No message leaves the tenant boundary.
 * Uses approved business answers verbatim. No LLM confidence or generated facts
 * can authorize sending, tools, payments or a change to customer records. */
export interface SocialKnowledgeAnswer {
  id: string; scopeId: string; question: string; answer: string;
  language: string; approved: boolean; sensitive: boolean;
}
export interface SocialAssistantInput {
  enabled: boolean; automationEnabled: boolean; scopeId: string;
  messageId: string; text: string; language: string;
  humanAssigned: boolean; knowledge: readonly SocialKnowledgeAnswer[];
}
export type SocialAssistantDecision =
  | { kind: 'disabled' }
  | { kind: 'handoff'; reason: 'human-assigned' | 'sensitive' | 'unconfirmed'; createFollowUp: true }
  | { kind: 'suggestion' | 'auto-reply-candidate'; text: string; sourceIds: string[]; messageId: string };

const sensitive = /\b(refund|payment|password|diagnosis|medical|prescription|card number|bank|delete|cancel)\b|استرداد|دفع|كلمة السر|تشخيص|دواء|بطاق|حذف|إلغاء/iu;
function words(text: string): Set<string> {
  return new Set(text.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}
export function suggestSocialReply(input: SocialAssistantInput): SocialAssistantDecision {
  if (!input.enabled) return { kind: 'disabled' };
  if (input.humanAssigned) return { kind: 'handoff', reason: 'human-assigned', createFollowUp: true };
  if (!input.scopeId || !input.messageId || !input.text.trim() || input.text.length > 8000
    || sensitive.test(input.text)) return { kind: 'handoff', reason: 'sensitive', createFollowUp: true };
  const question = words(input.text);
  // Exact normalized question match is required for unattended candidates.
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const candidates = input.knowledge.filter(item => item.scopeId === input.scopeId && item.approved
    && !item.sensitive && item.language === input.language && item.answer.trim().length > 0
    && item.answer.length <= 4000 && !sensitive.test(item.answer)).map(item => {
      const tokens = words(item.question);
      const common = [...tokens].filter(token => question.has(token)).length;
      return { item, score: common / Math.max(1, new Set([...question, ...tokens]).size) };
    }).filter(item => item.score >= 0.6).sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || (candidates[1] && candidates[1].score === best.score && candidates[1].item.answer !== best.item.answer))
    return { kind: 'handoff', reason: 'unconfirmed', createFollowUp: true };
  return { kind: input.automationEnabled && normalize(input.text) === normalize(best.item.question)
    ? 'auto-reply-candidate' : 'suggestion', text: best.item.answer,
  sourceIds: [best.item.id], messageId: input.messageId };
}

export type SocialAutomationTrigger = 'message.received' | 'conversation.assigned' | 'order.status.changed'
  | 'booking.reminder' | 'human.requested' | 'outside.hours';
export interface SocialAutomationRule {
  id: string; scopeId: string; enabled: boolean; trigger: SocialAutomationTrigger;
  contains?: string; action: 'suggest' | 'handoff' | 'notify' | 'reply'; approvedAnswerId?: string;
}
export interface SocialAutomationEvent {
  id: string; scopeId: string; trigger: SocialAutomationTrigger; text?: string;
}
/** Declarative decisions enter the existing event dispatcher/outbox via a server
 * coordinator. Never eval rules, regexes, arbitrary URLs, tools or user code. */
export function planSocialAutomation(enabled: boolean, automationEnabled: boolean,
  event: SocialAutomationEvent, rules: readonly SocialAutomationRule[]) {
  if (!enabled || !automationEnabled || !event.id || !event.scopeId) return [];
  return rules.filter(rule => rule.enabled && rule.scopeId === event.scopeId && rule.trigger === event.trigger
    && ['suggest', 'handoff', 'notify', 'reply'].includes(rule.action)
    && (!rule.contains || (rule.contains.length <= 200 && (event.text ?? '').slice(0, 8000)
      .normalize('NFKC').toLocaleLowerCase().includes(rule.contains.normalize('NFKC').toLocaleLowerCase())))
    && (rule.action !== 'reply' || Boolean(rule.approvedAnswerId)))
    .slice(0, 20).map(rule => ({ ruleId: rule.id, action: rule.action, approvedAnswerId: rule.approvedAnswerId,
      eventId: event.id, scopeId: event.scopeId, idempotencyKey: `social:${event.id}:${rule.id}` }));
}

/** Optional model classifier over already approved answers. The host must reuse
 * Tayar's authenticated AI engine and budget gate. Model output can only select
 * an approved answer ID; it cannot create facts, invoke tools or authorize send. */
export async function suggestSocialReplyWithModel(input: SocialAssistantInput, dependencies: {
  approvedForTenant: (scopeId: string) => Promise<boolean>;
  reserveBudget: (scopeId: string, messageId: string) => Promise<boolean>;
  selectAnswer: (input: { scopeId: string; text: string; language: string;
    answers: Array<{id:string;question:string}>; signal: AbortSignal }) => Promise<unknown>;
}): Promise<SocialAssistantDecision> {
  const local = suggestSocialReply(input);
  if (local.kind !== 'handoff' || local.reason !== 'unconfirmed') return local;
  try {
    if (!await dependencies.approvedForTenant(input.scopeId) || !await dependencies.reserveBudget(input.scopeId,input.messageId)) return local;
    const answers = input.knowledge.filter(item => item.scopeId === input.scopeId && item.approved && !item.sensitive
      && item.language === input.language && item.answer.trim().length > 0 && item.answer.length <= 4000
      && item.question.length <= 500 && !sensitive.test(item.answer)).slice(0,50);
    if (!answers.length) return local;
    const choice = await dependencies.selectAnswer({scopeId:input.scopeId,text:input.text,language:input.language,
      answers:answers.map(({id,question})=>({id,question})),signal:AbortSignal.timeout(8000)});
    const answer = typeof choice === 'string' ? answers.find(item => item.id === choice) : undefined;
    return answer ? {kind:'suggestion',text:answer.answer,sourceIds:[answer.id],messageId:input.messageId} : local;
  } catch { return local; }
}
