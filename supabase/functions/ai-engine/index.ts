import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { assertServerToolAvailable, createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim() || "";
const rawFalKey = Deno.env.get("FAL_KEY") || "";
const FAL_KEY = rawFalKey.trim().replace(/^["']|["']$/g, "").trim();

const RATE_LIMIT_PER_MINUTE = readPositiveInt("AI_RATE_LIMIT_PER_MINUTE", 30, 1, 300);
const MAX_REQUEST_CHARS = readPositiveInt("AI_MAX_REQUEST_CHARS", 40_000, 1_000, 200_000);
const MAX_BODY_CHARS = readPositiveInt("AI_MAX_BODY_CHARS", 60_000, 2_000, 300_000);
const MAX_OUTPUT_TOKENS = readPositiveInt("AI_MAX_OUTPUT_TOKENS", 8_192, 256, 32_768);
const FALLBACK_TEXT_MODEL = "gemini-3.6-flash";
const BUILTIN_TEXT_MODELS = new Set(["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"]);
const AI_TOOL_IDS = new Set([
  "ai-chat", "cv-builder", "cover-letter", "ai-writer", "document-ai",
  "study-assistant", "translator", "website-builder", "code-assistant",
]);
const GEMINI_MODEL_ID = /^gemini-[a-z0-9][a-z0-9._-]{1,80}$/i;
const ROUTE_MODEL_ID = /^[a-z0-9][a-z0-9._:/-]{0,120}$/i;
const PROVIDER_KEY = /^[a-z0-9][a-z0-9_-]{1,49}$/i;

type ProviderAdapter = "gemini" | "openai_compatible" | "anthropic";
interface IncomingMessage { role: "user" | "assistant" | "system"; content: string; }
interface AIRequestBody {
  action?: string;
  prompt?: string;
  tool?: string;
  messages?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  jsonMode?: boolean;
}
interface RuntimeProvider {
  provider_key: string;
  label: string;
  adapter: ProviderAdapter;
  base_url: string;
  default_model: string;
  api_secret: string | null;
}
interface ToolRouteV2 {
  primaryProviderKey: string;
  primaryModel: string;
  fallbackProviderKey: string;
  fallbackModel: string;
}
interface TextResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
}

function readPositiveInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(Deno.env.get(name));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function allowedOrigins(): Set<string> {
  const origins = new Set<string>(["http://localhost:5173", "http://127.0.0.1:5173"]);
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
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid message payload");
    const source = item as Record<string, unknown>;
    const role = source.role;
    if (role !== "user" && role !== "assistant" && role !== "system") throw new HttpError(400, "Invalid message role");
    const content = String(source.content ?? "").trim();
    if (!content) throw new HttpError(400, "Message content cannot be empty");
    totalChars += content.length;
    if (totalChars > MAX_REQUEST_CHARS) throw new HttpError(413, "AI request is too large");
    return { role, content } as IncomingMessage;
  });
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

function normalizeManagedModelId(value: unknown): string | null {
  const model = typeof value === "string" ? value.trim() : "";
  return model && GEMINI_MODEL_ID.test(model) ? model : null;
}

function normalizeRouteModelId(value: unknown): string {
  const model = typeof value === "string" ? value.trim() : "";
  return model && ROUTE_MODEL_ID.test(model) ? model : "";
}

function normalizeProviderKey(value: unknown): string {
  const providerKey = typeof value === "string" ? value.trim().toLowerCase() : "";
  return providerKey && PROVIDER_KEY.test(providerKey) ? providerKey : "";
}

async function loadAllowedTextModels(admin: ReturnType<typeof createAdminClient>): Promise<Set<string>> {
  const allowed = new Set(BUILTIN_TEXT_MODELS);
  const { data, error } = await admin.from("admin_settings").select("value").eq("key", "ai_model_catalog").maybeSingle();
  if (error) {
    console.error("[AI ENGINE] Failed to read admin model catalog");
    return allowed;
  }
  if (!Array.isArray(data?.value)) return allowed;
  for (const entry of data.value) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    if (source.enabled === false) continue;
    const model = normalizeManagedModelId(source.id);
    if (model) allowed.add(model);
  }
  return allowed;
}

async function resolveTextModel(admin: ReturnType<typeof createAdminClient>, userId: string, tool: string): Promise<string> {
  const allowedModels = await loadAllowedTextModels(admin);
  const { data: toolSetting, error: toolError } = await admin.from("ai_settings").select("model").eq("user_id", userId).eq("tool", tool).maybeSingle();
  if (toolError) console.error("[AI ENGINE] Failed to read per-tool model setting");
  else {
    const toolModel = normalizeManagedModelId(toolSetting?.model);
    if (toolModel && allowedModels.has(toolModel)) return toolModel;
  }
  const { data: adminSetting, error: adminError } = await admin.from("admin_settings").select("value").eq("key", "default_ai_model").maybeSingle();
  if (adminError) console.error("[AI ENGINE] Failed to read admin default model");
  else {
    const adminModel = normalizeManagedModelId(adminSetting?.value);
    if (adminModel && allowedModels.has(adminModel)) return adminModel;
  }
  return FALLBACK_TEXT_MODEL;
}

async function loadManagedProvider(admin: ReturnType<typeof createAdminClient>, providerKey: string | null): Promise<RuntimeProvider | null> {
  const { data, error } = await admin.rpc("ai_provider_runtime", { p_provider_key: providerKey });
  if (error) {
    const message = String(error.message || "");
    if (!/ai_provider_runtime|does not exist|schema cache/i.test(message)) console.error("[AI ENGINE] Failed to read managed provider runtime");
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const provider = row as RuntimeProvider;
  if (!provider.provider_key || !provider.base_url || !provider.default_model || !provider.api_secret) return null;
  return provider;
}

async function loadManagedDefaultProvider(admin: ReturnType<typeof createAdminClient>): Promise<RuntimeProvider | null> {
  return loadManagedProvider(admin, null);
}

async function loadToolRouteV2(admin: ReturnType<typeof createAdminClient>, tool: string): Promise<ToolRouteV2 | null> {
  const { data, error } = await admin.from("admin_settings").select("value").eq("key", "ai_tool_routes_v2").maybeSingle();
  if (error) {
    console.error("[AI ENGINE] Failed to read AI routing configuration");
    return null;
  }
  const root = data?.value;
  if (!root || typeof root !== "object" || Array.isArray(root)) return null;
  const routes = (root as Record<string, unknown>).routes;
  if (!routes || typeof routes !== "object" || Array.isArray(routes)) return null;
  const raw = (routes as Record<string, unknown>)[tool];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const route: ToolRouteV2 = {
    primaryProviderKey: normalizeProviderKey(source.primaryProviderKey),
    primaryModel: normalizeRouteModelId(source.primaryModel),
    fallbackProviderKey: normalizeProviderKey(source.fallbackProviderKey),
    fallbackModel: normalizeRouteModelId(source.fallbackModel),
  };
  return route.primaryProviderKey || route.primaryModel || route.fallbackProviderKey || route.fallbackModel ? route : null;
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

function providerFailure(status: number): HttpError {
  if (status === 401 || status === 403) return new HttpError(502, "AI provider authentication failed");
  if (status === 429) return new HttpError(429, "AI quota exceeded. Please try again later.");
  return new HttpError(502, "AI provider is temporarily unavailable");
}

function canFailOver(error: unknown): boolean {
  return error instanceof HttpError && (error.status === 429 || error.status >= 500);
}

async function callGemini(baseUrl: string, apiSecret: string, model: string, messages: IncomingMessage[], body: AIRequestBody, providerKey: string): Promise<TextResult> {
  const system = messages.find((message) => message.role === "system");
  const chatMessages = messages.filter((message) => message.role !== "system");
  if (!chatMessages.length) throw new HttpError(400, "At least one user message is required");
  const requestBody: Record<string, unknown> = {
    contents: chatMessages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
    generationConfig: {
      maxOutputTokens: Math.floor(clampNumber(body.maxTokens, 4096, 1, MAX_OUTPUT_TOKENS)),
      ...(body.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) requestBody.systemInstruction = { parts: [{ text: system.content }] };
  const url = `${baseUrl.replace(/\/$/, "")}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiSecret)}`;
  const upstream = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
  const raw = await upstream.text();
  if (!upstream.ok) throw providerFailure(upstream.status);
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { throw new HttpError(502, "AI provider returned an invalid response"); }
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  const candidate = candidates[0] && typeof candidates[0] === "object" ? candidates[0] as Record<string, unknown> : null;
  const content = candidate?.content && typeof candidate.content === "object" ? candidate.content as Record<string, unknown> : null;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = parts.map((part) => part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string" ? String((part as Record<string, unknown>).text) : "").join("");
  if (!text) throw new HttpError(502, "AI provider returned an empty response");
  const usage = data.usageMetadata && typeof data.usageMetadata === "object" ? data.usageMetadata as Record<string, unknown> : {};
  return { content: text, tokensIn: Math.max(0, Number(usage.promptTokenCount) || 0), tokensOut: Math.max(0, Number(usage.candidatesTokenCount) || 0), model, provider: providerKey };
}

async function callOpenAICompatible(baseUrl: string, apiSecret: string, model: string, messages: IncomingMessage[], body: AIRequestBody, providerKey: string): Promise<TextResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const requestBody: Record<string, unknown> = {
    model,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    max_tokens: Math.floor(clampNumber(body.maxTokens, 4096, 1, MAX_OUTPUT_TOKENS)),
    temperature: (clampNumber(body.temperature, 0.7, 0, 2)),
  };
  if (body.jsonMode) requestBody.response_format = { type: "json_object" };
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiSecret}` },
    body: JSON.stringify(requestBody),
  });
  const raw = await upstream.text();
  if (!upstream.ok) throw providerFailure(upstream.status);
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { throw new HttpError(502, "AI provider returned an invalid response"); }
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const choice = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : null;
  const message = choice?.message && typeof choice.message === "object" ? choice.message as Record<string, unknown> : null;
  const text = typeof message?.content === "string" ? message.content : "";
  if (!text) throw new HttpError(502, "AI provider returned an empty response");
  const usage = data.usage && typeof data.usage === "object" ? data.usage as Record<string, unknown> : {};
  return { content: text, tokensIn: Math.max(0, Number(usage.prompt_tokens) || 0), tokensOut: Math.max(0, Number(usage.completion_tokens) || 0), model, provider: providerKey };
}

async function callAnthropic(baseUrl: string, apiSecret: string, model: string, messages: IncomingMessage[], body: AIRequestBody, providerKey: string): Promise<TextResult> {
  const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const chatMessages = messages.filter((message) => message.role !== "system");
  if (!chatMessages.length) throw new HttpError(400, "At least one user message is required");
  const requestBody: Record<string, unknown> = {
    model,
    max_tokens: Math.floor(clampNumber(body.maxTokens, 4096, 1, MAX_OUTPUT_TOKENS)),
    temperature: (clampNumber(body.temperature, 0.7, 0, 1)),
    messages: chatMessages.map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })),
  };
  if (system) requestBody.system = system;
  const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiSecret, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(requestBody),
  });
  const raw = await upstream.text();
  if (!upstream.ok) throw providerFailure(upstream.status);
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { throw new HttpError(502, "AI provider returned an invalid response"); }
  const content = Array.isArray(data.content) ? data.content : [];
  const text = content.map((part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "text" ? String((part as Record<string, unknown>).text || "") : "").join("");
  if (!text) throw new HttpError(502, "AI provider returned an empty response");
  const usage = data.usage && typeof data.usage === "object" ? data.usage as Record<string, unknown> : {};
  return { content: text, tokensIn: Math.max(0, Number(usage.input_tokens) || 0), tokensOut: Math.max(0, Number(usage.output_tokens) || 0), model, provider: providerKey };
}

async function callRuntimeProvider(provider: RuntimeProvider, modelOverride: string, messages: IncomingMessage[], body: AIRequestBody): Promise<TextResult> {
  if (!provider.api_secret) throw new HttpError(503, "Managed AI provider secret is missing");
  const model = modelOverride || provider.default_model;
  if (provider.adapter === "gemini") return callGemini(provider.base_url, provider.api_secret, model, messages, body, provider.provider_key);
  if (provider.adapter === "anthropic") return callAnthropic(provider.base_url, provider.api_secret, model, messages, body, provider.provider_key);
  return callOpenAICompatible(provider.base_url, provider.api_secret, model, messages, body, provider.provider_key);
}

async function runTextProvider(admin: ReturnType<typeof createAdminClient>, userId: string, tool: string, messages: IncomingMessage[], body: AIRequestBody): Promise<TextResult> {
  const route = await loadToolRouteV2(admin, tool);
  const attempts: { provider: RuntimeProvider; model: string }[] = [];
  const seen = new Set<string>();
  const addAttempt = (provider: RuntimeProvider | null, model: string) => {
    if (!provider) return;
    const resolvedModel = model || provider.default_model;
    const key = `${provider.provider_key}:${resolvedModel}`;
    if (seen.has(key)) return;
    seen.add(key);
    attempts.push({ provider, model });
  };

  if (route?.primaryProviderKey) addAttempt(await loadManagedProvider(admin, route.primaryProviderKey), route.primaryModel);
  else addAttempt(await loadManagedDefaultProvider(admin), route?.primaryModel || "");

  if (route?.fallbackProviderKey) addAttempt(await loadManagedProvider(admin, route.fallbackProviderKey), route.fallbackModel);
  addAttempt(await loadManagedDefaultProvider(admin), "");

  let lastRetryableError: unknown = null;
  for (const attempt of attempts) {
    try {
      return await callRuntimeProvider(attempt.provider, attempt.model, messages, body);
    } catch (error) {
      if (!canFailOver(error)) throw error;
      lastRetryableError = error;
      console.warn(`[AI ENGINE] Provider ${attempt.provider.provider_key} failed; trying configured fallback`);
    }
  }

  if (GEMINI_API_KEY) {
    const model = await resolveTextModel(admin, userId, tool);
    return callGemini("https://generativelanguage.googleapis.com", GEMINI_API_KEY, model, messages, body, "gemini");
  }
  if (lastRetryableError) throw lastRetryableError;
  throw new HttpError(503, "AI provider is not configured");
}

async function generateImage(admin: ReturnType<typeof createAdminClient>, userId: string, prompt: string): Promise<{ content: string; json: Record<string, unknown> }> {
  if (!FAL_KEY) throw new HttpError(503, "Image generation is not configured");
  if (!prompt) throw new HttpError(400, "Image prompt is required");
  if (prompt.length > 4_000) throw new HttpError(413, "Image prompt is too large");
  const headers = { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" };
  let submit: Response;
  try {
    submit = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, image_size: "landscape_16_9", num_images: 1, enable_safety_checker: true, output_format: "jpeg" }),
    });
  } catch { throw new HttpError(502, "Could not reach image provider queue"); }
  const submitRaw = await submit.text();
  let submitData: Record<string, unknown> = {};
  try { submitData = JSON.parse(submitRaw) as Record<string, unknown>; } catch { /* handled below */ }
  if (!submit.ok) throw providerFailure(submit.status);
  const statusUrl = typeof submitData.status_url === "string" ? submitData.status_url : "";
  const responseUrl = typeof submitData.response_url === "string" ? submitData.response_url : "";
  if (!statusUrl || !responseUrl) throw new HttpError(502, "Image provider returned an invalid queue response");

  const deadline = Date.now() + 80_000;
  let imageData: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const statusResponse = await fetch(statusUrl, { method: "GET", headers: { "Authorization": `Key ${FAL_KEY}` } });
    if (!statusResponse.ok) throw new HttpError(502, "Could not check image generation status");
    const statusData = await statusResponse.json().catch(() => null) as Record<string, unknown> | null;
    if (!statusData) throw new HttpError(502, "Image provider returned invalid status");
    if (statusData.error) throw new HttpError(502, "Image provider could not generate this image");
    if (statusData.status !== "COMPLETED") continue;
    const resultResponse = await fetch(responseUrl, { method: "GET", headers: { "Authorization": `Key ${FAL_KEY}` } });
    if (!resultResponse.ok) throw new HttpError(502, "Could not retrieve generated image");
    imageData = await resultResponse.json().catch(() => null) as Record<string, unknown> | null;
    break;
  }
  if (!imageData) throw new HttpError(504, "Image generation timed out. Try again.");
  const images = Array.isArray(imageData.images) ? imageData.images : [];
  const first = images[0] && typeof images[0] === "object" ? images[0] as Record<string, unknown> : null;
  const imageUrl = typeof first?.url === "string" ? first.url : "";
  if (!imageUrl) throw new HttpError(502, "Image provider returned no image");

  let finalUrl = imageUrl;
  let assetPath = "";
  let persisted = false;
  let persistenceError = "";
  try {
    const generatedImage = await fetch(imageUrl);
    if (!generatedImage.ok) persistenceError = "Generated image could not be downloaded for Media";
    else {
      const contentType = generatedImage.headers.get("content-type") || "image/jpeg";
      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const bytes = await generatedImage.arrayBuffer();
      assetPath = `${userId}/ai-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
      const { error } = await admin.storage.from("website-media").upload(assetPath, bytes, { contentType, cacheControl: "31536000", upsert: false });
      if (error) persistenceError = "Generated image could not be saved to Media";
      else {
        const { data } = admin.storage.from("website-media").getPublicUrl(assetPath);
        if (data?.publicUrl) { finalUrl = data.publicUrl; persisted = true; }
        else persistenceError = "Media URL could not be created";
      }
    }
  } catch { persistenceError = "Generated image could not be saved to Media"; }
  const json = { url: finalUrl, assetPath, persisted, persistenceError };
  return { content: JSON.stringify({ url: finalUrl, assetPath, persisted }), json };
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
  let activeProvider = "internal";
  let activeModel = "none";
  let admin: ReturnType<typeof createAdminClient> | null = null;

  try {
    assertAllowedOrigin(req);
    const user = await requireUser(req);
    userId = user.id;
    admin = createAdminClient();
    await enforceRateLimit(admin, user.id);
    const body = await parseBody(req);
    tool = String(body.tool || "ai-chat").trim().slice(0, 100) || "ai-chat";
    if (!AI_TOOL_IDS.has(tool)) throw new HttpError(400, "Unsupported AI tool");
    await assertServerToolAvailable(admin, user.id, tool);

    if (body.action === "generate-image") {
      if (tool !== "website-builder") throw new HttpError(403, "Image generation is not available for this tool");
      activeProvider = "fal"; activeModel = "flux";
      const result = await generateImage(admin, user.id, String(body.prompt || "").trim());
      await recordUsage(admin, user.id, { provider: activeProvider, model: activeModel, tool, durationMs: Date.now() - startedAt, status: "success" });
      return jsonResponse(req, { ...result, model: activeModel, provider: activeProvider, tokensIn: 0, tokensOut: 0, costUsd: 0 });
    }

    const messages = normalizeMessages(body.messages);
    const result = await runTextProvider(admin, user.id, tool, messages, body);
    activeProvider = result.provider; activeModel = result.model;
    await recordUsage(admin, user.id, {
      provider: result.provider,
      model: result.model,
      tool,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: Date.now() - startedAt,
      status: "success",
    });
    let json: unknown = null;
    if (body.jsonMode) { try { json = JSON.parse(result.content); } catch { json = null; } }
    return jsonResponse(req, { content: result.content, json, tokensIn: result.tokensIn, tokensOut: result.tokensOut, model: result.model, provider: result.provider, costUsd: 0 });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const safeMessage = error instanceof HttpError ? error.message : "AI request failed";
    if (status >= 500) console.error(`[AI ENGINE] Request failed (${status})`);
    if (admin && userId) {
      await recordUsage(admin, userId, { provider: activeProvider, model: activeModel, tool, durationMs: Date.now() - startedAt, status: "error" });
    }
    return jsonResponse(req, { error: safeMessage }, status);
  }
});
