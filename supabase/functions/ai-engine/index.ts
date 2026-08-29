import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const FAL_KEY = Deno.env.get("FAL_KEY");

const RATE_LIMIT_PER_MINUTE = readPositiveInt("AI_RATE_LIMIT_PER_MINUTE", 30, 1, 300);
const MAX_REQUEST_CHARS = readPositiveInt("AI_MAX_REQUEST_CHARS", 40_000, 1_000, 200_000);
const MAX_BODY_CHARS = readPositiveInt("AI_MAX_BODY_CHARS", 60_000, 2_000, 300_000);
const MAX_OUTPUT_TOKENS = readPositiveInt("AI_MAX_OUTPUT_TOKENS", 8_192, 256, 32_768);

const FALLBACK_TEXT_MODEL = "gemini-3.6-flash";
const SUPPORTED_TEXT_MODELS = new Set([
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
]);

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AIRequestBody {
  action?: string;
  prompt?: string;
  tool?: string;
  messages?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  jsonMode?: boolean;
}

function readPositiveInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(Deno.env.get(name));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  for (const raw of [Deno.env.get("APP_URL"), ...(Deno.env.get("ALLOWED_ORIGINS") || "").split(",")]) {
    const value = raw?.trim();
    if (!value) continue;
    try { origins.add(new URL(value).origin); } catch { /* ignore invalid configured origins */ }
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

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value) || value.length === 0) throw new HttpError(400, "Messages are required");
  if (value.length > 40) throw new HttpError(400, "Too many messages in one request");

  let totalChars = 0;
  const messages = value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid message payload");
    const source = item as Record<string, unknown>;
    const role = source.role;
    if (role !== "user" && role !== "assistant" && role !== "system") {
      throw new HttpError(400, "Invalid message role");
    }
    const content = String(source.content ?? "").trim();
    if (!content) throw new HttpError(400, "Message content cannot be empty");
    totalChars += content.length;
    if (totalChars > MAX_REQUEST_CHARS) throw new HttpError(413, "AI request is too large");
    return { role, content } as IncomingMessage;
  });

  return messages;
}

async function parseBody(req: Request): Promise<AIRequestBody> {
  const raw = await req.text();
  if (!raw || raw.length > MAX_BODY_CHARS) throw new HttpError(raw ? 413 : 400, raw ? "Request body is too large" : "Request body is required");
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid object");
    return parsed as AIRequestBody;
  } catch {
    throw new HttpError(400, "Invalid JSON request");
  }
}

function supportedTextModel(value: unknown): string | null {
  const model = typeof value === "string" ? value.trim() : "";
  return model && SUPPORTED_TEXT_MODELS.has(model) ? model : null;
}

async function resolveTextModel(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  tool: string,
): Promise<string> {
  const { data: toolSetting, error: toolError } = await admin
    .from("ai_settings")
    .select("model")
    .eq("user_id", userId)
    .eq("tool", tool)
    .maybeSingle();

  if (toolError) {
    console.error("[AI ENGINE] Failed to read per-tool model setting");
  } else {
    const toolModel = supportedTextModel(toolSetting?.model);
    if (toolModel) return toolModel;
  }

  const { data: adminSetting, error: adminError } = await admin
    .from("admin_settings")
    .select("value")
    .eq("key", "default_ai_model")
    .maybeSingle();

  if (adminError) {
    console.error("[AI ENGINE] Failed to read admin default model");
  } else {
    const adminModel = supportedTextModel(adminSetting?.value);
    if (adminModel) return adminModel;
  }

  return FALLBACK_TEXT_MODEL;
}

async function enforceRateLimit(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<void> {
  const { error } = await admin.rpc("enforce_ai_rate_limit", {
    p_user_id: userId,
    p_bucket: "ai-engine",
    p_limit: RATE_LIMIT_PER_MINUTE,
    p_window_seconds: 60,
  });
  if (!error) return;
  if (/too many/i.test(error.message || "")) throw new HttpError(429, "Rate limit exceeded. Please wait a moment and try again.");
  console.error("[AI ENGINE] Rate limit check failed");
  throw new HttpError(500, "Unable to validate AI request limits");
}

async function recordUsage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  values: { provider: string; model: string; tool: string; tokensIn?: number; tokensOut?: number; durationMs: number; status: "success" | "error" },
): Promise<void> {
  const { error } = await admin.from("ai_usage").insert({
    user_id: userId,
    provider: values.provider.slice(0, 60),
    model: values.model.slice(0, 100),
    tool: values.tool.slice(0, 100),
    tokens_in: Math.max(0, Math.floor(values.tokensIn || 0)),
    tokens_out: Math.max(0, Math.floor(values.tokensOut || 0)),
    duration_ms: Math.max(0, Math.floor(values.durationMs)),
    status: values.status,
    cost_usd: 0,
  });
  if (error) console.error("[AI ENGINE] Usage logging failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    try { assertAllowedOrigin(req); return new Response("ok", { headers: corsHeaders(req) }); }
    catch { return new Response("Forbidden", { status: 403, headers: corsHeaders(req) }); }
  }
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  let userId = "";
  let tool = "ai-chat";
  let admin: ReturnType<typeof createAdminClient> | null = null;

  try {
    assertAllowedOrigin(req);
    const user = await requireUser(req);
    userId = user.id;
    admin = createAdminClient();
    await enforceRateLimit(admin, user.id);

    const body = await parseBody(req);
    tool = String(body.tool || "ai-chat").trim().slice(0, 100) || "ai-chat";

    if (body.action === "generate-image") {
      if (!FAL_KEY) throw new HttpError(503, "Image generation is not configured");
      const prompt = String(body.prompt || "").trim();
      if (!prompt) throw new HttpError(400, "Image prompt is required");
      if (prompt.length > 4_000) throw new HttpError(413, "Image prompt is too large");

      const imageResponse = await fetch("https://fal.run/fal-ai/flux/dev", {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image_size: "landscape_16_9", num_images: 1 }),
      });
      const rawImageResponse = await imageResponse.text();
      let imageData: Record<string, unknown> = {};
      try { imageData = JSON.parse(rawImageResponse) as Record<string, unknown>; } catch { /* provider returned non-JSON */ }

      if (!imageResponse.ok) {
        console.error(`[AI ENGINE] Image provider failed (${imageResponse.status})`);
        await recordUsage(admin, user.id, { provider: "fal", model: "flux", tool, durationMs: Date.now() - startedAt, status: "error" });
        return jsonResponse(req, { error: "Image provider is temporarily unavailable" }, 502);
      }

      const images = Array.isArray(imageData.images) ? imageData.images : [];
      const first = images[0] && typeof images[0] === "object" ? images[0] as Record<string, unknown> : null;
      const imageUrl = typeof first?.url === "string" ? first.url : "";
      if (!imageUrl) {
        await recordUsage(admin, user.id, { provider: "fal", model: "flux", tool, durationMs: Date.now() - startedAt, status: "error" });
        return jsonResponse(req, { error: "Image provider returned no image" }, 502);
      }

      await recordUsage(admin, user.id, { provider: "fal", model: "flux", tool, durationMs: Date.now() - startedAt, status: "success" });
      return jsonResponse(req, {
        content: JSON.stringify({ url: imageUrl }),
        json: { url: imageUrl },
        model: "flux",
        provider: "fal",
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
      });
    }

    if (!GEMINI_API_KEY) throw new HttpError(503, "AI provider is not configured");
    const messages = normalizeMessages(body.messages);
    const model = await resolveTextModel(admin, user.id, tool);
    const system = messages.find((message) => message.role === "system");
    const chatMessages = messages.filter((message) => message.role !== "system");
    if (!chatMessages.length) throw new HttpError(400, "At least one user message is required");

    const requestBody: Record<string, unknown> = {
      contents: chatMessages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: Math.floor(clampNumber(body.maxTokens, 4096, 1, MAX_OUTPUT_TOKENS)),
        ...(body.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };
    if (system) requestBody.systemInstruction = { parts: [{ text: system.content }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const raw = await upstream.text();

    if (!upstream.ok) {
      console.error(`[AI ENGINE] Gemini provider failed (${upstream.status})`);
      await recordUsage(admin, user.id, { provider: "gemini", model, tool, durationMs: Date.now() - startedAt, status: "error" });
      return jsonResponse(req, { error: upstream.status === 429 ? "AI quota exceeded. Please try again later." : "AI provider is temporarily unavailable" }, upstream.status === 429 ? 429 : 502);
    }

    let data: Record<string, unknown>;
    try { data = JSON.parse(raw) as Record<string, unknown>; }
    catch {
      await recordUsage(admin, user.id, { provider: "gemini", model, tool, durationMs: Date.now() - startedAt, status: "error" });
      return jsonResponse(req, { error: "AI provider returned an invalid response" }, 502);
    }

    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const candidate = candidates[0] && typeof candidates[0] === "object" ? candidates[0] as Record<string, unknown> : null;
    const content = candidate?.content && typeof candidate.content === "object" ? candidate.content as Record<string, unknown> : null;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const text = parts.map((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? (part as Record<string, unknown>).text as string : "").join("");
    if (!text) {
      await recordUsage(admin, user.id, { provider: "gemini", model, tool, durationMs: Date.now() - startedAt, status: "error" });
      return jsonResponse(req, { error: "AI provider returned an empty response" }, 502);
    }

    const usage = data.usageMetadata && typeof data.usageMetadata === "object" ? data.usageMetadata as Record<string, unknown> : {};
    const tokensIn = Math.max(0, Number(usage.promptTokenCount) || 0);
    const tokensOut = Math.max(0, Number(usage.candidatesTokenCount) || 0);
    await recordUsage(admin, user.id, { provider: "gemini", model, tool, tokensIn, tokensOut, durationMs: Date.now() - startedAt, status: "success" });

    let json: unknown = null;
    if (body.jsonMode) {
      try { json = JSON.parse(text); } catch { json = null; }
    }

    return jsonResponse(req, { content: text, json, tokensIn, tokensOut, model, provider: "gemini", costUsd: 0 });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const safeMessage = error instanceof HttpError ? error.message : "AI request failed";
    if (status >= 500) console.error(`[AI ENGINE] Request failed (${status})`);
    if (admin && userId) {
      await recordUsage(admin, userId, { provider: "internal", model: "none", tool, durationMs: Date.now() - startedAt, status: "error" });
    }
    return jsonResponse(req, { error: safeMessage }, status);
  }
});
