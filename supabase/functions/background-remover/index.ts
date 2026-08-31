import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const rawFalKey = Deno.env.get("FAL_KEY") || "";
const FAL_KEY = rawFalKey.trim().replace(/^["']|["']$/g, "").trim();

const MAX_BODY_CHARS = 3_000_000;
const ALLOWED_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i;
const MAX_IMAGE_DATA_URL_CHARS = 2_850_000;
const FAL_ENDPOINT = "https://queue.fal.run/fal-ai/imageutils/rembg";

function allowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  for (const raw of [Deno.env.get("APP_URL"), ...(Deno.env.get("ALLOWED_ORIGINS") || "").split(",")]) {
    const value = raw?.trim();
    if (!value) continue;
    try { origins.add(new URL(value).origin); } catch { /* ignore invalid configured origin */ }
  }

  return origins;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin")?.trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function assertAllowedOrigin(req: Request): void {
  const origin = req.headers.get("Origin")?.trim();
  if (origin && !allowedOrigins().has(origin)) throw new HttpError(403, "Origin is not allowed");
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

async function parseBody(req: Request) {
  const raw = await req.text();
  if (!raw) throw new HttpError(400, "Request body is required");
  if (raw.length > MAX_BODY_CHARS) throw new HttpError(413, "Background-removal request is too large");

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new HttpError(400, "Invalid JSON request"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "Invalid request body");

  const source = parsed as Record<string, unknown>;
  const imageDataUrl = typeof source.imageDataUrl === "string" ? source.imageDataUrl.trim() : "";
  if (!imageDataUrl || imageDataUrl.length > MAX_IMAGE_DATA_URL_CHARS || !ALLOWED_DATA_URL.test(imageDataUrl)) {
    throw new HttpError(400, "Invalid or unsupported image payload");
  }

  return {
    imageDataUrl,
    cropToBbox: source.cropToBbox === true,
  };
}

async function enforceRateLimit(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { error } = await admin.rpc("enforce_ai_rate_limit", {
    p_user_id: userId,
    p_bucket: "background-remover",
    p_limit: 10,
    p_window_seconds: 60,
  });

  if (!error) return;
  if (/too many/i.test(error.message || "")) throw new HttpError(429, "Background-removal rate limit reached. Try again shortly.");
  console.error("[BACKGROUND REMOVER] Rate-limit check failed");
  throw new HttpError(500, "Unable to validate request limits");
}

async function recordUsage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  durationMs: number,
  status: "success" | "error",
) {
  const { error } = await admin.from("ai_usage").insert({
    user_id: userId,
    provider: "fal",
    model: "imageutils-rembg",
    tool: "background-remover",
    tokens_in: 0,
    tokens_out: 0,
    duration_ms: Math.max(0, Math.floor(durationMs)),
    status,
    cost_usd: 0,
  });

  if (error) console.error("[BACKGROUND REMOVER] Usage logging failed");
}

function validateFalQueueUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const parsed = new URL(value);
    const allowedHost =
      parsed.hostname === "queue.fal.run" ||
      parsed.hostname.endsWith(".fal.run");
    return parsed.protocol === "https:" && allowedHost ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function validateFalMediaUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const parsed = new URL(value);
    const allowedHost =
      parsed.hostname === "fal.media" ||
      parsed.hostname.endsWith(".fal.media") ||
      parsed.hostname === "storage.googleapis.com";
    return parsed.protocol === "https:" && allowedHost ? parsed.toString() : "";
  } catch {
    return "";
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    try {
      assertAllowedOrigin(req);
      return new Response("ok", { headers: corsHeaders(req) });
    } catch {
      return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });
    }
  }

  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let userId = "";

  try {
    assertAllowedOrigin(req);
    const user = await requireUser(req);
    userId = user.id;
    admin = createAdminClient();
    await enforceRateLimit(admin, user.id);

    if (!FAL_KEY) throw new HttpError(503, "Background removal is not configured");

    const body = await parseBody(req);
    const falHeaders = {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    };

    const submitResponse = await fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: falHeaders,
      body: JSON.stringify({
        image_url: body.imageDataUrl,
        crop_to_bbox: body.cropToBbox,
      }),
    });

    const submitRaw = await submitResponse.text();
    let submitData: Record<string, unknown> = {};
    try { submitData = JSON.parse(submitRaw) as Record<string, unknown>; } catch { /* handled below */ }

    if (!submitResponse.ok) {
      console.error(`[BACKGROUND REMOVER] FAL submit failed (${submitResponse.status})`);
      if (submitResponse.status === 429) throw new HttpError(429, "Image provider rate limit reached. Try again shortly.");
      if (submitResponse.status === 401 || submitResponse.status === 403) throw new HttpError(502, "Image provider authentication failed");
      if (submitResponse.status === 422) throw new HttpError(400, "Image provider rejected this image");
      throw new HttpError(502, "Background-removal provider is unavailable");
    }

    const statusUrl = validateFalQueueUrl(submitData.status_url);
    const responseUrl = validateFalQueueUrl(submitData.response_url);
    if (!statusUrl || !responseUrl) throw new HttpError(502, "Image provider returned invalid tracking URLs");

    const deadline = Date.now() + 60_000;
    let resultData: Record<string, unknown> | null = null;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const statusResponse = await fetch(statusUrl, {
        headers: { "Authorization": `Key ${FAL_KEY}` },
      });
      if (!statusResponse.ok) throw new HttpError(502, "Could not check background-removal status");

      const statusData = await statusResponse.json() as Record<string, unknown>;
      if (statusData.error) throw new HttpError(502, "Image provider could not process this image");
      if (statusData.status !== "COMPLETED") continue;

      const resultResponse = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${FAL_KEY}` },
      });
      if (!resultResponse.ok) throw new HttpError(502, "Could not retrieve background-removal result");
      resultData = await resultResponse.json() as Record<string, unknown>;
      break;
    }

    if (!resultData) throw new HttpError(504, "Background removal timed out. Try again.");

    const image = resultData.image && typeof resultData.image === "object"
      ? resultData.image as Record<string, unknown>
      : null;
    const url = validateFalMediaUrl(image?.url);
    if (!url) throw new HttpError(502, "Image provider returned no result image");

    const contentType = typeof image?.content_type === "string" ? image.content_type : "image/png";
    if (!/^image\/(?:png|webp|jpeg)$/i.test(contentType)) throw new HttpError(502, "Image provider returned an unsupported file type");

    await recordUsage(admin, user.id, Date.now() - startedAt, "success");

    return jsonResponse(req, {
      url,
      contentType,
      width: Number.isFinite(Number(image?.width)) ? Number(image?.width) : null,
      height: Number.isFinite(Number(image?.height)) ? Number(image?.height) : null,
      fileSize: Number.isFinite(Number(image?.file_size)) ? Number(image?.file_size) : null,
    });
  } catch (error) {
    if (admin && userId) {
      await recordUsage(admin, userId, Date.now() - startedAt, "error").catch(() => undefined);
    }
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected background-removal error";
    console.error("[BACKGROUND REMOVER]", message);
    return jsonResponse(req, { error: message }, status);
  }
});
