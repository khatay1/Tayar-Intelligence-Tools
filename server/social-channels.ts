/** Server-only official channel boundaries. Never import into browser bundles. */
export type SocialChannel = 'whatsapp' | 'telegram' | 'facebook' | 'instagram';
export interface SocialConnectionBinding {
  tenantId: string; connectionId: string; channel: SocialChannel; accountId: string;
  ownership: 'official' | 'customer'; status: 'connected' | 'disconnected' | 'expired';
  permissionsVerified: boolean; webhookVerified: boolean; expiresAt: string | null;
}
export interface SocialAttachmentRef { type: 'image' | 'document' | 'audio' | 'video' | 'sticker'; providerId?: string }
export interface NormalizedSocialMessage {
  tenantId: string; connectionId: string; channel: SocialChannel; externalAccountId: string;
  externalConversationId: string; externalMessageId: string; senderId: string; text: string;
  occurredAt: string; attachmentRefs: SocialAttachmentRef[];
}
export const SOCIAL_CHANNELS = Object.freeze({
  whatsapp: { name: 'WhatsApp Business Platform', auth: 'meta-embedded-signup', host: 'graph.facebook.com', permissions: ['whatsapp_business_management', 'whatsapp_business_messaging'], docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api/', verification: 'mocked-only' },
  telegram: { name: 'Telegram Bot API', auth: 'server-token-custody', host: 'api.telegram.org', permissions: ['bot-ownership'], docs: 'https://core.telegram.org/bots/api', verification: 'mocked-only' },
  facebook: { name: 'Facebook Pages / Messenger', auth: 'meta-oauth', host: 'graph.facebook.com', permissions: ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'], docs: 'https://developers.facebook.com/docs/messenger-platform/', verification: 'mocked-only' },
  instagram: { name: 'Instagram Professional Messaging', auth: 'meta-facebook-login', host: 'graph.facebook.com', permissions: ['instagram_basic', 'instagram_manage_messages', 'pages_show_list', 'pages_manage_metadata'], docs: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/messaging-api/', verification: 'mocked-only' },
} as const);

const id = /^[A-Za-z0-9_.:@-]{1,200}$/;
const providerId = /^[A-Za-z0-9_.:@=-]{1,256}$/;
const numeric = /^\d{1,30}$/;
function fail(): never { throw new Error('Social channel request rejected.'); }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const array = (value: unknown): unknown[] => Array.isArray(value) && value.length <= 100 ? value : fail();
const str = (value: unknown, pattern = providerId): string => typeof value === 'string' && pattern.test(value) ? value : fail();
function bindingValid(binding: SocialConnectionBinding) {
  return binding && id.test(binding.tenantId) && id.test(binding.connectionId) && numeric.test(binding.accountId)
    && Object.prototype.hasOwnProperty.call(SOCIAL_CHANNELS, binding.channel) && ['official', 'customer'].includes(binding.ownership);
}
function credentialActive(binding: SocialConnectionBinding, now: number) {
  return Number.isFinite(now) && (binding.expiresAt === null || (typeof binding.expiresAt === 'string' && Number.isFinite(Date.parse(binding.expiresAt)) && Date.parse(binding.expiresAt) > now));
}
async function equalSecret(left: string, right: string) {
  const encoder = new TextEncoder();
  const hashes = await Promise.all([left, right].map(value => crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(hashes[0]), b = new Uint8Array(hashes[1]); let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}
async function boundedBytes(request: Request, maximum = 262_144) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) fail();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break;
    size += part.value.byteLength; if (size > maximum) { await reader.cancel(); fail(); } chunks.push(part.value);
  } } finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; } return body;
}

/** Signature verification precedes JSON parsing. Caller selects binding/secret from trusted server routing.
 * Persist returned identities atomically before acknowledging; providers can replay valid signed payloads. */
export async function verifyAndNormalizeSocialWebhook(input: {
  enabled?: boolean; request: Request; binding: SocialConnectionBinding; secret: string;
}): Promise<NormalizedSocialMessage[]> {
  const { request, binding, secret } = input;
  if (input.enabled !== true || !bindingValid(binding) || binding.status !== 'connected' || !binding.permissionsVerified
    || !credentialActive(binding, Date.now()) || request.method !== 'POST' || !/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')
    || typeof secret !== 'string' || secret.length < 16 || secret.length > 256) fail();
  const raw = await boundedBytes(request);
  if (binding.channel === 'telegram') {
    const header = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret) || !/^[A-Za-z0-9_-]{16,256}$/.test(header) || !await equalSecret(secret, header)) fail();
  } else {
    const signature = request.headers.get('x-hub-signature-256') ?? '';
    if (!/^sha256=[0-9a-f]{64}$/.test(signature)) fail();
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const bytes = Uint8Array.from(signature.slice(7).match(/../g)!, item => parseInt(item, 16));
    if (!await crypto.subtle.verify('HMAC', key, bytes, raw)) fail();
  }
  let root; try { root = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))); } catch { fail(); }
  const events: NormalizedSocialMessage[] = [];
  const add = (messageId: unknown, sender: unknown, text: unknown, seconds: unknown, attachments: SocialAttachmentRef[] = []) => {
    if (typeof text !== 'string' || text.length > 16_384 || !Number.isSafeInteger(seconds) || (seconds as number) <= 0 || (seconds as number) > 32_503_680_000) fail();
    if ((typeof messageId !== 'string' && !Number.isSafeInteger(messageId)) || (typeof sender !== 'string' && !Number.isSafeInteger(sender))) fail();
    const senderId = str(String(sender), /^-?\d{1,30}$/);
    events.push({ tenantId: binding.tenantId, connectionId: binding.connectionId, channel: binding.channel,
      externalAccountId: binding.accountId, externalConversationId: senderId, externalMessageId: str(String(messageId)), senderId,
      text, occurredAt: new Date((seconds as number) * 1000).toISOString(), attachmentRefs: attachments });
    if (events.length > 100) fail();
  };
  if (binding.channel === 'telegram') {
    if (!Number.isSafeInteger(root!.update_id) || Number(root!.update_id) < 0) fail();
    if (root!.message) {
      const message = record(root!.message), chat = record(message.chat);
      if (!Number.isSafeInteger(message.message_id) || Number(message.message_id) < 1) fail();
      // Private chats only: group identity / business delegation requires separate authorization.
      if (chat.type !== 'private') return [];
      const sender = record(message.from); if (sender.is_bot === true || String(sender.id) !== String(chat.id)) fail();
      const photos = message.photo ? array(message.photo) : [];
      const refs: SocialAttachmentRef[] = message.document ? [{type: 'document', providerId: str(record(message.document).file_id)}]
        : message.photo ? [{type: 'image', providerId: str(record(photos[photos.length - 1]).file_id)}] : [];
      if (message.text !== undefined || message.caption !== undefined || refs.length) add(`${root!.update_id}:${message.message_id}`, chat.id, message.text ?? message.caption ?? '', message.date, refs);
    }
    return events;
  }
  if (root!.object !== (binding.channel === 'whatsapp' ? 'whatsapp_business_account' : binding.channel === 'facebook' ? 'page' : 'instagram')) fail();
  for (const rawEntry of array(root!.entry)) {
    const entry = record(rawEntry);
    if (binding.channel === 'whatsapp') {
      for (const rawChange of array(entry.changes)) {
        const change = record(rawChange); if (change.field !== 'messages') continue;
        const value = record(change.value); if (str(record(value.metadata).phone_number_id, numeric) !== binding.accountId) fail();
        for (const rawMessage of array(value.messages ?? [])) {
          const message = record(rawMessage); if (message.type !== 'text') continue;
          add(message.id, message.from, record(message.text).body, Number(message.timestamp));
        }
      }
    } else {
      if (String(entry.id) !== binding.accountId) fail();
      for (const rawEvent of array(entry.messaging ?? [])) {
        const event = record(rawEvent); if (!event.message) continue;
        const message = record(event.message); if (message.is_echo === true) continue;
        if (String(record(event.recipient).id) !== binding.accountId) fail();
        if (message.text !== undefined) add(message.mid, record(event.sender).id, message.text, Math.floor(Number(event.timestamp) / 1000));
      }
    }
  }
  return events;
}

/** Challenge response is returned only for an exact server-held verify token, never a query-selected account. */
export async function verifySocialWebhookChallenge(input: { enabled?: boolean; mode: string; token: string; challenge: string; expectedToken: string }) {
  if (input.enabled !== true || input.mode !== 'subscribe' || input.expectedToken.length < 16 || input.expectedToken.length > 256
    || input.token.length > 256 || !/^\d{1,100}$/.test(input.challenge) || !await equalSecret(input.token, input.expectedToken)) fail();
  return input.challenge;
}

export interface SocialSendPolicy {
  /** Server must resolve evidence from the authorized recipient conversation, never accept from browser. */
  consentVerified: boolean; recipientInitiated: boolean; lastInboundAt?: string;
  approvedTemplate?: { name: string; language: string; approvalVerified: boolean };
}
export type SocialSendOutcome = { status: 'accepted'; providerMessageId: string } | { status: 'blocked' | 'review' | 'rejected'; reason: string };
export async function sendSocialMessage(input: {
  enabled?: boolean; binding: SocialConnectionBinding; scope: {tenantId:string; connectionId:string}; credential: string;
  policy: SocialSendPolicy; message: {recipientId:string; text?:string; template?:{name:string;language:string}};
  graphVersion?: string; now?: () => Date; fetcher?: typeof fetch;
}): Promise<SocialSendOutcome> {
  const blocked = (reason: string): SocialSendOutcome => ({status:'blocked', reason});
  const { binding, message, policy } = input;
  const now = (input.now?.() ?? new Date()).getTime();
  if (input.enabled !== true) return blocked('feature-disabled');
  if (!bindingValid(binding) || binding.status !== 'connected' || !binding.permissionsVerified || !binding.webhookVerified
    || !credentialActive(binding, now) || input.scope.tenantId !== binding.tenantId || input.scope.connectionId !== binding.connectionId) return blocked('connection-unverified');
  if (typeof input.credential !== 'string' || input.credential.length < 16 || input.credential.length > 4096 || [...input.credential].some(character => /\s/.test(character) || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return blocked('credential-unavailable');
  if (!/^-?\d{1,30}$/.test(message.recipientId) || !policy.consentVerified || (!policy.recipientInitiated && !(binding.channel === 'whatsapp' && message.template))) return blocked('recipient-not-authorized');
  const last = Date.parse(policy.lastInboundAt ?? '');
  const inWindow = Number.isFinite(now) && Number.isFinite(last) && now >= last && now - last < 86_400_000;
  if (binding.channel !== 'telegram' && !inWindow && !(binding.channel === 'whatsapp' && message.template)) return blocked('messaging-window-closed');
  const limit = binding.channel === 'telegram' || binding.channel === 'whatsapp' ? 4096 : 1000;
  if ((!message.template && (typeof message.text !== 'string' || message.text.length < 1 || message.text.length > limit)) || (message.template && message.text !== undefined)) return blocked('invalid-message');
  if (message.template && (binding.channel !== 'whatsapp' || !policy.approvedTemplate?.approvalVerified
    || policy.approvedTemplate.name !== message.template.name || policy.approvedTemplate.language !== message.template.language
    || !/^[a-z0-9_]{1,512}$/.test(message.template.name) || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(message.template.language))) return blocked('template-not-approved');
  let url: string, body: unknown;
  const headers: Record<string,string> = {'Content-Type':'application/json'};
  if (binding.channel === 'telegram') {
    if (!/^\d{5,20}:[A-Za-z0-9_-]{20,200}$/.test(input.credential)) return blocked('credential-unavailable');
    url = `https://api.telegram.org/bot${input.credential}/sendMessage`;
    body = {chat_id:message.recipientId,text:message.text,link_preview_options:{is_disabled:true}};
  } else {
    if (!/^v\d{2}\.\d$/.test(input.graphVersion ?? '')) return blocked('graph-version-required');
    url = `https://${SOCIAL_CHANNELS[binding.channel].host}/${input.graphVersion}/${binding.accountId}/messages`;
    headers.Authorization = `Bearer ${input.credential}`;
    body = binding.channel === 'whatsapp' ? {messaging_product:'whatsapp',recipient_type:'individual',to:message.recipientId,
      ...(message.template ? {type:'template',template:{name:message.template.name,language:{code:message.template.language}}} : {type:'text',text:{body:message.text,preview_url:false}})}
      : {recipient:{id:message.recipientId},message:{text:message.text},...(binding.channel === 'facebook' ? {messaging_type:'RESPONSE'} : {})};
  }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await (input.fetcher ?? fetch)(url, {method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:controller.signal});
    // Never expose provider bodies/errors: Telegram URL contains the token. Never retry uncertain delivery.
    if (response.status >= 500 || (response.status >= 300 && response.status < 400)) return {status:'review',reason:'delivery-uncertain'};
    if (!response.ok) return {status:'rejected',reason:response.status === 429 ? 'rate-limited' : 'provider-rejected'};
    const bytes = await boundedBytes(new Request('https://response.invalid', {method:'POST',body:response.body,duplex:'half'} as RequestInit), 65_536);
    const parsed = record(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)));
    const messageId = binding.channel === 'telegram' ? parsed.ok === true ? record(parsed.result).message_id : null
      : binding.channel === 'whatsapp' ? record(array(parsed.messages)[0]).id : parsed.message_id;
    if (messageId === null || messageId === undefined || !providerId.test(String(messageId))) return {status:'review',reason:'delivery-uncertain'};
    return {status:'accepted',providerMessageId:String(messageId)};
  } catch { return {status:'review',reason:'delivery-uncertain'}; }
  finally { clearTimeout(timer); }
}
