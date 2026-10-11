import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/billing.ts";
import { timingSafeEqual, type SocialProvider } from "../_shared/social-channels.ts";

interface DeliveryJob { jobId: string; messageId: string; connectionId: string; provider: SocialProvider; providerAccountId: string; recipientId: string; body: string; attemptCount: number }
const response = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });

async function providerSend(job: DeliveryJob, token: string): Promise<{ id: string }> {
  let url: string, body: Record<string, unknown>;
  if (job.provider === "telegram") {
    url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    body = { chat_id: job.recipientId, text: job.body };
  } else {
    url = `https://graph.facebook.com/v23.0/${encodeURIComponent(job.providerAccountId)}/messages`;
    body = job.provider === "whatsapp"
      ? { messaging_product: "whatsapp", to: job.recipientId, type: "text", text: { body: job.body } }
      : { recipient: { id: job.recipientId }, messaging_type: "RESPONSE", message: { text: job.body } };
  }
  const result = await fetch(url, { method: "POST", headers: { "authorization": `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await result.json().catch(() => ({})) as Record<string, unknown>;
  if (!result.ok) {
    const failure = new Error(`provider_${result.status}`) as Error & { retryable?: boolean };
    failure.retryable = result.status === 408 || result.status === 429 || result.status >= 500;
    throw failure;
  }
  const telegram = payload.result && typeof payload.result === "object" ? payload.result as Record<string, unknown> : null;
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const message = messages[0] && typeof messages[0] === "object" ? messages[0] as Record<string, unknown> : null;
  const id = String(telegram?.message_id || message?.id || payload.message_id || payload.id || "");
  if (!id || id.length > 500) throw new Error("provider_response");
  return { id };
}

Deno.serve(async request => {
  if (request.method !== "POST") return response(405, { error: "method" });
  const expected = Deno.env.get("SOCIAL_WORKER_CRON_SECRET") || "", supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (expected.length < 24 || !timingSafeEqual(expected, supplied)) return response(401, { error: "authorization" });
  const admin = createAdminClient(), workerId = `social-${crypto.randomUUID()}`, started = Date.now();
  let processed = 0, failed = 0;
  while (processed + failed < 25 && Date.now() - started < 45_000) {
    const { data, error } = await admin.rpc("claim_social_delivery_job", { p_worker_id: workerId });
    if (error) return response(503, { error: "claim" });
    const job = data as DeliveryJob | null;
    if (!job) break;
    try {
      const { data: runtime, error: runtimeError } = await admin.rpc("social_connection_runtime", { p_connection_id: job.connectionId }).maybeSingle();
      if (runtimeError || !runtime?.token) throw new Error("connection_unavailable");
      const sent = await providerSend(job, runtime.token);
      const { error: completeError } = await admin.rpc("complete_social_delivery_job", { p_job_id: job.jobId, p_provider_message_id: sent.id });
      if (completeError) throw new Error("completion_failed");
      processed += 1;
    } catch (caught) {
      const failure = caught as Error & { retryable?: boolean };
      const code = String(failure.message || "delivery_failed").slice(0, 120);
      await admin.rpc("fail_social_delivery_job", { p_job_id: job.jobId, p_error_code: code, p_error_detail: code, p_retryable: failure.retryable !== false });
      failed += 1;
    }
  }
  return response(200, { processed, failed });
});
