// AI Engine Edge Function
// Unified backend for all AI tools in the Tayar Intelligence platform.
// Supports OpenAI, Google Gemini, and Anthropic with streaming, retry, and usage tracking.
// Provider selection is driven by admin_settings (default_ai_provider) and the model ID.
// Structured JSON responses supported via jsonMode flag.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_RETRIES = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const REQUEST_TIMEOUT_MS = 60_000;

// --- Pricing per 1M tokens (USD) ---
const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-1.5-pro": { input: 1.25, output: 5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
};

function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (tokensIn / 1_000_000) * pricing.input + (tokensOut / 1_000_000) * pricing.output;
}

// --- Types ---
interface AIMessage {
  role: string;
  content: string;
}

interface AIRequest {
  tool: string;
  messages: AIMessage[];
  model?: string;
  provider?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  conversationId?: string;
  jsonMode?: boolean;
}

// --- Unified Provider Interface ---
// Implement this interface to add a new AI provider.
interface ProviderAdapter {
  name: string;
  call(messages: AIMessage[], model: string, options: {
    temperature: number;
    maxTokens: number;
    jsonMode: boolean;
  }): Promise<Response>;
  parseStream(response: Response): AsyncGenerator<string>;
  extractContent(response: Response): Promise<string>;
}

// --- OpenAI Adapter ---
const openaiAdapter: ProviderAdapter = {
  name: "openai",
  call(messages, model, options) {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    };
    if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  },
  async *parseStream(response) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* skip malformed chunks */ }
      }
    }
  },
  async extractContent(response) {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  },
};

// --- Gemini Adapter ---
const geminiAdapter: ProviderAdapter = {
  name: "gemini",
  call(messages, model, options) {
    const systemMsg = messages.find(m => m.role === "system");
    const contents = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    };
    if (options.jsonMode) {
      generationConfig.responseMimeType = "application/json";
    }
    const body: Record<string, unknown> = {
      contents,
      generationConfig,
    };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  },
  async *parseStream(response) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/(?<=\})\s*(?=\[|,|\])/);
      buffer = parts.pop() || "";
      for (const part of parts) {
        try {
          const cleaned = part.trim().replace(/^[,\[]/, "").replace(/[\]]$/, "");
          const json = JSON.parse(cleaned);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch { /* skip */ }
      }
    }
  },
  async extractContent(response) {
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  },
};

// --- Anthropic Adapter ---
const anthropicAdapter: ProviderAdapter = {
  name: "anthropic",
  call(messages, model, options) {
    const systemMsg = messages.find(m => m.role === "system");
    const userMessages = messages.filter(m => m.role !== "system");
    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens,
      stream: true,
      temperature: options.temperature,
      system: systemMsg?.content || "",
      messages: userMessages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    };
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  },
  async *parseStream(response) {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.type === "content_block_delta" && json.delta?.text) {
            yield json.delta.text;
          }
        } catch { /* skip */ }
      }
    }
  },
  async extractContent(response) {
    const data = await response.json();
    return data.content?.[0]?.text || "";
  },
};

// --- Provider Registry ---
// To add a new provider: implement ProviderAdapter, add env key check, register here.
const PROVIDERS: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
};

function getProviderForModel(model: string): string {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gemini")) return "gemini";
  return "openai";
}

function isProviderConfigured(provider: string): boolean {
  const envKeys: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
  };
  const key = envKeys[provider];
  if (!key) return false;
  const val = Deno.env.get(key);
  return !!val && val.length > 0;
}

// --- Get admin-configured default provider and model ---
async function getAdminDefaults(supabase: ReturnType<typeof createClient>): Promise<{ provider: string | null; model: string | null }> {
  let provider: string | null = null;
  let model: string | null = null;
  try {
    const { data: provData } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "default_ai_provider")
      .maybeSingle();
    if (provData?.value) {
      const val = typeof provData.value === "string" ? provData.value.replace(/"/g, "") : (provData.value as Record<string, unknown>)?.default as string;
      if (val && PROVIDERS[val]) provider = val;
    }
    const { data: modelData } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "default_ai_model")
      .maybeSingle();
    if (modelData?.value) {
      const val = typeof modelData.value === "string" ? modelData.value.replace(/"/g, "") : (modelData.value as Record<string, unknown>)?.default as string;
      if (val) model = val;
    }
  } catch { /* not set yet */ }
  return { provider, model };
}

// --- Rate Limiting ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetMs: RATE_LIMIT_WINDOW_MS };
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetMs: entry.resetAt - now };
}

// --- Retry with exponential backoff ---
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = MAX_RETRIES): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError || new Error("Retry failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: "Rate limit exceeded",
        code: "RATE_LIMIT",
        retryAfterMs: rateLimit.resetMs,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" },
      });
    }

    const body: AIRequest = await req.json();
    const { tool, messages, stream = true, jsonMode = false } = body;
    let model = body.model || "gemini-2.0-flash";

    // Determine provider: explicit > admin default > model inference
    let provider = "gemini";
    model = body.model || "gemini-2.0-flash";

    const adapter = PROVIDERS[provider];

    if (!adapter) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}`, code: "INVALID_PROVIDER" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isProviderConfigured(provider)) {
      return new Response(JSON.stringify({
        error: `AI provider '${provider}' is not configured. Set the API key in environment variables.`,
        code: "PROVIDER_NOT_CONFIGURED",
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required", code: "INVALID_REQUEST" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const temperature = body.temperature ?? 0.7;
    const maxTokens = body.maxTokens ?? 4096;
    const startTime = Date.now();

    let response: Response;
    try {
      response = await withRetry(() => adapter.call(messages, model, { temperature, maxTokens, jsonMode }));
    } catch (err) {
      const errMsg = (err as Error).message;
      const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
      await supabase.from("ai_usage").insert({
        user_id: user.id, provider, model, tool: tool || "ai-chat",
        tokens_in: 0, tokens_out: 0, duration_ms: Date.now() - startTime,
        status: "error", cost_usd: 0,
      });
      return new Response(JSON.stringify({
        error: isTimeout ? "Request timed out. Please try again." : `AI provider unavailable: ${errMsg}`,
        code: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      await supabase.from("ai_usage").insert({
        user_id: user.id, provider, model, tool: tool || "ai-chat",
        tokens_in: 0, tokens_out: 0, duration_ms: Date.now() - startTime,
        status: "error", cost_usd: 0,
      });
      return new Response(JSON.stringify({
        error: `AI provider error (${response.status})`,
        code: response.status === 429 ? "RATE_LIMIT" : "PROVIDER_ERROR",
        details: errText.slice(0, 500),
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (stream) {
      const encoder = new TextEncoder();
      let totalContent = "";
      let tokensIn = 0;
      let tokensOut = 0;

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of adapter.parseStream(response)) {
              totalContent += chunk;
              tokensOut++;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
            }
            tokensIn = Math.ceil(JSON.stringify(messages).length / 4);
            tokensOut = Math.ceil(tokensOut * 0.75);
            const costUsd = calculateCost(model, tokensIn, tokensOut);
            await supabase.from("ai_usage").insert({
              user_id: user.id, provider, model, tool: tool || "ai-chat",
              tokens_in: tokensIn, tokens_out: tokensOut, duration_ms: Date.now() - startTime,
              status: "success", cost_usd: costUsd,
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, tokensIn, tokensOut, costUsd, provider, model })}\n\n`));
          } catch (err) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (err as Error).message, code: "STREAM_ERROR" })}\n\n`));
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      });
    } else {
      let fullContent = "";
      for await (const chunk of adapter.parseStream(response)) {
        fullContent += chunk;
      }
      const tokensIn = Math.ceil(JSON.stringify(messages).length / 4);
      const tokensOut = Math.ceil(fullContent.length / 4);
      const costUsd = calculateCost(model, tokensIn, tokensOut);
      await supabase.from("ai_usage").insert({
        user_id: user.id, provider, model, tool: tool || "ai-chat",
        tokens_in: tokensIn, tokens_out: tokensOut, duration_ms: Date.now() - startTime,
        status: "success", cost_usd: costUsd,
      });

      // If jsonMode, try to parse and validate the response as JSON
      let parsedJson: unknown = null;
      if (jsonMode) {
        try {
          parsedJson = JSON.parse(fullContent);
        } catch {
          // Try to extract JSON from markdown code blocks
          const jsonMatch = fullContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            try { parsedJson = JSON.parse(jsonMatch[1].trim()); } catch { /* leave null */ }
          }
        }
      }

      return new Response(JSON.stringify({
        content: fullContent,
        json: parsedJson,
        tokensIn,
        tokensOut,
        model,
        provider,
        costUsd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(rateLimit.remaining) },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({
      error: (err as Error).message,
      code: "INTERNAL_ERROR",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


