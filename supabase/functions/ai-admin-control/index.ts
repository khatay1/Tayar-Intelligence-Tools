import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createAdminClient,
  handleError,
  HttpError,
  jsonResponse,
  requireUser,
} from "../_shared/billing.ts";

type Adapter = "gemini" | "openai_compatible" | "anthropic";

interface RuntimeProvider {
  provider_key: string;
  label: string;
  adapter: Adapter;
  base_url: string;
  default_model: string;
  api_secret: string | null;
}

async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role,suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new HttpError(503, "Administrator status could not be verified");
  if (!data || data.role !== "admin" || data.suspended === true) {
    throw new HttpError(403, "Administrator access required");
  }
  return admin;
}

function providerKey(value: unknown): string {
  const key = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(key)) throw new HttpError(400, "Invalid provider key");
  return key;
}

function adapter(value: unknown): Adapter {
  const normalized = String(value || "");
  if (normalized !== "gemini" && normalized !== "openai_compatible" && normalized !== "anthropic") {
    throw new HttpError(400, "Unsupported provider adapter");
  }
  return normalized;
}

function httpsBaseUrl(value: unknown): string {
  const raw = String(value || "").trim().replace(/\/$/, "");
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new HttpError(400, "Invalid base URL"); }
  if (parsed.protocol !== "https:") throw new HttpError(400, "Provider base URL must use HTTPS");
  return parsed.toString().replace(/\/$/, "");
}

async function runtimeProvider(admin: ReturnType<typeof createAdminClient>, key: string): Promise<RuntimeProvider> {
  const { data, error } = await admin.rpc("ai_provider_runtime", { p_provider_key: key });
  if (error) throw new HttpError(500, "Could not load provider runtime configuration");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new HttpError(404, "Provider is not enabled or does not exist");
  return row as RuntimeProvider;
}

async function testProvider(provider: RuntimeProvider): Promise<{ ok: true; latencyMs: number; preview: string }> {
  const started = Date.now();
  if (!provider.api_secret) throw new HttpError(400, "Provider API secret is not configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    let response: Response;
    if (provider.adapter === "gemini") {
      const url = `${provider.base_url}/v1beta/models/${encodeURIComponent(provider.default_model)}:generateContent?key=${encodeURIComponent(provider.api_secret)}`;
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with OK" }] }], generationConfig: { maxOutputTokens: 8 } }),
        signal: controller.signal,
      });
    } else if (provider.adapter === "anthropic") {
      response = await fetch(`${provider.base_url}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": provider.api_secret,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model: provider.default_model, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK" }] }),
        signal: controller.signal,
      });
    } else {
      response = await fetch(`${provider.base_url}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${provider.api_secret}`,
        },
        body: JSON.stringify({ model: provider.default_model, max_tokens: 8, messages: [{ role: "user", content: "Reply with OK" }] }),
        signal: controller.signal,
      });
    }

    const raw = await response.text();
    if (!response.ok) {
      const auth = response.status === 401 || response.status === 403;
      throw new HttpError(auth ? 400 : 502, auth ? "Provider authentication failed" : `Provider test failed (${response.status})`);
    }
    return { ok: true, latencyMs: Date.now() - started, preview: raw.slice(0, 180) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new HttpError(504, "Provider test timed out");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const admin = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "list") {
      const { data, error } = await admin.rpc("ai_admin_list_providers");
      if (error) throw new HttpError(500, "Could not load AI providers");
      return jsonResponse({ ok: true, providers: data || [] });
    }

    if (action === "save") {
      const key = providerKey(body?.providerKey);
      const label = String(body?.label || "").trim().slice(0, 80);
      if (!label) throw new HttpError(400, "Provider name is required");
      const selectedAdapter = adapter(body?.adapter);
      const baseUrl = httpsBaseUrl(body?.baseUrl);
      const model = String(body?.model || "").trim().slice(0, 120);
      if (!model) throw new HttpError(400, "Model ID is required");
      const apiSecret = typeof body?.apiSecret === "string" && body.apiSecret.trim() ? body.apiSecret.trim() : null;

      const { data, error } = await admin.rpc("ai_admin_upsert_provider", {
        p_provider_key: key,
        p_label: label,
        p_adapter: selectedAdapter,
        p_base_url: baseUrl,
        p_default_model: model,
        p_api_secret: apiSecret,
        p_enabled: body?.enabled !== false,
      });
      if (error) throw new HttpError(400, error.message || "Could not save provider");
      return jsonResponse({ ok: true, id: data, providerKey: key });
    }

    if (action === "test") {
      const key = providerKey(body?.providerKey);
      const provider = await runtimeProvider(admin, key);
      return jsonResponse(await testProvider(provider));
    }

    if (action === "activate") {
      const key = providerKey(body?.providerKey);
      const { error } = await admin.rpc("ai_admin_set_default_provider", { p_provider_key: key });
      if (error) throw new HttpError(400, error.message || "Could not activate provider");
      return jsonResponse({ ok: true, providerKey: key });
    }

    if (action === "set_enabled") {
      const key = providerKey(body?.providerKey);
      const enabled = body?.enabled === true;
      const { error } = await admin.rpc("ai_admin_set_provider_enabled", { p_provider_key: key, p_enabled: enabled });
      if (error) throw new HttpError(400, error.message || "Could not change provider status");
      return jsonResponse({ ok: true, providerKey: key, enabled });
    }

    throw new HttpError(400, "Unknown AI admin action");
  } catch (error) {
    return handleError(error);
  }
});
