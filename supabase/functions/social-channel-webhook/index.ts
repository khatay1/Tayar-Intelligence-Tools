import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/billing.ts";
import { normalizeSocialWebhook, readBoundedBody, timingSafeEqual, verifyMetaSignature, type SocialProvider } from "../_shared/social-channels.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providers = new Set<SocialProvider>(["whatsapp", "telegram", "messenger", "instagram"]);
const response = (status: number, body: unknown) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

Deno.serve(async request => {
  try {
    const url = new URL(request.url), connectionId = url.searchParams.get("connection") || "";
    if (!uuid.test(connectionId)) return response(404, { error: "connection" });
    const admin = createAdminClient();
    const { data: runtime, error: runtimeError } = await admin.rpc("social_connection_runtime", { p_connection_id: connectionId }).maybeSingle();
    if (runtimeError || !runtime || !providers.has(runtime.provider as SocialProvider)) return response(404, { error: "connection" });
    const provider = runtime.provider as SocialProvider;

    if (request.method === "GET" && provider !== "telegram") {
      const mode = url.searchParams.get("hub.mode"), verifyToken = url.searchParams.get("hub.verify_token") || "", challenge = url.searchParams.get("hub.challenge") || "";
      if (mode !== "subscribe" || !runtime.verify_token || !timingSafeEqual(verifyToken, runtime.verify_token) || !/^\d{1,200}$/.test(challenge)) return response(403, { error: "verification" });
      return response(200, challenge);
    }
    if (request.method !== "POST" || !(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return response(405, { error: "method" });
    const rawBody = await readBoundedBody(request);
    const verified = provider === "telegram"
      ? timingSafeEqual(request.headers.get("x-telegram-bot-api-secret-token") || "", runtime.webhook_secret)
      : await verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256") || "", runtime.webhook_secret);
    if (!verified) return response(401, { error: "signature" });
    let payload: unknown;
    try { payload = JSON.parse(rawBody); } catch { return response(400, { error: "json" }); }
    const events = normalizeSocialWebhook(provider, payload);
    for (const event of events) {
      const { error } = await admin.rpc("ingest_social_webhook", {
        p_connection_id: connectionId, p_event_id: event.eventId, p_event_type: event.eventType,
        p_provider_user_id: event.providerUserId, p_provider_thread_id: event.providerThreadId,
        p_provider_message_id: event.providerMessageId, p_display_name: event.displayName,
        p_body: event.body, p_content_type: event.contentType, p_payload: payload, p_profile: event.profile,
      });
      if (error) throw new Error("Event persistence failed.");
    }
    return response(200, { status: events.length ? "processed" : "ignored", count: events.length });
  } catch {
    return response(503, { error: "retry" });
  }
});
