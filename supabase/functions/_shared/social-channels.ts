export type SocialProvider = "whatsapp" | "telegram" | "messenger" | "instagram";

export interface NormalizedSocialEvent {
  eventId: string;
  eventType: string;
  providerUserId: string;
  providerThreadId: string;
  providerMessageId: string;
  displayName: string;
  body: string;
  contentType: "text" | "image" | "audio" | "video" | "file" | "location" | "template";
  profile: Record<string, unknown>;
}

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const clean = (value: unknown, max: number): string => typeof value === "string" ? value.trim().slice(0, max) : "";
const scalar = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value) : "";

function mediaBody(message: Record<string, unknown>): { body: string; contentType: NormalizedSocialEvent["contentType"] } {
  const type = clean(message.type, 30);
  const text = object(message.text);
  if (type === "text" && clean(text?.body, 16000)) return { body: clean(text?.body, 16000), contentType: "text" };
  const caption = clean(object(message[type])?.caption, 16000);
  if (["image", "audio", "video", "file", "location", "template"].includes(type)) {
    return { body: caption || `[${type}]`, contentType: type as NormalizedSocialEvent["contentType"] };
  }
  return { body: clean(message.caption, 16000) || clean(message.text, 16000) || "[message]", contentType: "text" };
}

export function normalizeSocialWebhook(provider: SocialProvider, payload: unknown): NormalizedSocialEvent[] {
  const root = object(payload);
  if (!root) throw new Error("Invalid social webhook payload.");
  const events: NormalizedSocialEvent[] = [];
  if (provider === "telegram") {
    const message = object(root.message) || object(root.business_message) || object(root.channel_post);
    if (!message) return [];
    const chat = object(message.chat), from = object(message.from);
    const chatId = scalar(chat?.id), senderId = scalar(from?.id) || chatId, messageId = scalar(message.message_id);
    if (!chatId || !senderId || !messageId) throw new Error("Invalid Telegram message identity.");
    const type = message.photo ? "image" : message.audio || message.voice ? "audio" : message.video ? "video" : message.document ? "file" : message.location ? "location" : "text";
    const body = clean(message.text, 16000) || clean(message.caption, 16000) || `[${type}]`;
    events.push({ eventId: scalar(root.update_id) || `${chatId}:${messageId}`, eventType: "message", providerUserId: senderId,
      providerThreadId: chatId, providerMessageId: `${chatId}:${messageId}`, displayName: clean(from?.first_name, 80) + (clean(from?.last_name, 80) ? ` ${clean(from?.last_name, 80)}` : ""),
      body, contentType: type, profile: { username: clean(from?.username, 120), chatType: clean(chat?.type, 40) } });
    return events;
  }

  for (const entryValue of array(root.entry)) {
    const entry = object(entryValue); if (!entry) continue;
    if (provider === "whatsapp") {
      for (const changeValue of array(entry.changes)) {
        const value = object(object(changeValue)?.value); if (!value) continue;
        const names = new Map<string, string>();
        for (const contactValue of array(value.contacts)) {
          const contact = object(contactValue), profile = object(contact?.profile), id = scalar(contact?.wa_id);
          if (id) names.set(id, clean(profile?.name, 160));
        }
        for (const messageValue of array(value.messages)) {
          const message = object(messageValue); if (!message) continue;
          const from = scalar(message.from), id = clean(message.id, 500); if (!from || !id) throw new Error("Invalid WhatsApp message identity.");
          const content = mediaBody(message);
          events.push({ eventId: id, eventType: `message.${clean(message.type, 30) || "unknown"}`, providerUserId: from,
            providerThreadId: from, providerMessageId: id, displayName: names.get(from) || from, ...content, profile: {} });
        }
      }
      continue;
    }
    for (const eventValue of array(entry.messaging)) {
      const event = object(eventValue), sender = object(event?.sender), message = object(event?.message);
      if (!event || !message || message.is_echo === true) continue;
      const senderId = scalar(sender?.id), messageId = clean(message.mid, 500);
      if (!senderId || !messageId) throw new Error("Invalid Meta message identity.");
      const attachments = array(message.attachments), firstAttachment = object(attachments[0]);
      const rawType = clean(firstAttachment?.type, 30);
      const contentType = (["image", "audio", "video", "file", "location"].includes(rawType) ? rawType : "text") as NormalizedSocialEvent["contentType"];
      events.push({ eventId: messageId, eventType: "message", providerUserId: senderId, providerThreadId: senderId,
        providerMessageId: messageId, displayName: senderId, body: clean(message.text, 16000) || `[${contentType}]`, contentType, profile: {} });
    }
  }
  return events;
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function verifyMetaSignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  if (!/^sha256=[0-9a-f]{64}$/i.test(header) || secret.length < 16 || rawBody.length > 262144) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(header.slice(7).toLowerCase(), hex(digest));
}

export async function readBoundedBody(request: Request, limit = 262144): Promise<string> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > limit) throw new Error("Request body too large.");
  const body = await request.text();
  if (!body || new TextEncoder().encode(body).byteLength > limit) throw new Error("Invalid request body.");
  return body;
}
