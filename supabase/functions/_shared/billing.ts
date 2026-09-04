import { createClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseNamedSecret(envName: string): string | null {
  const raw = Deno.env.get(envName);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default || Object.values(parsed)[0] || null;
  } catch {
    return null;
  }
}

export function getSupabaseUrl(): string {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) throw new HttpError(500, "SUPABASE_URL is not configured");
  return value;
}

export function getPublishableKey(): string {
  const value =
    parseNamedSecret("SUPABASE_PUBLISHABLE_KEYS") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY");
  if (!value) throw new HttpError(500, "Supabase publishable key is not configured");
  return value;
}

export function getSecretKey(): string {
  const value =
    parseNamedSecret("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) throw new HttpError(500, "Supabase secret key is not configured");
  return value;
}

export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function planRank(plan: string): number {
  return plan === "business" ? 2 : plan === "pro" ? 1 : 0;
}

function usageWindowStart(period: string): string | null {
  const now = new Date();
  if (period === "daily") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  }
  if (period === "monthly") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  return null;
}

/**
 * Server-side plan/quota guard for paid provider calls. This is intentionally
 * independent of browser UI state so every Edge Function request is checked.
 * Successful AI/provider requests are counted by ai_usage after completion.
 */
export async function assertServerToolAvailable(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  toolId: string,
): Promise<void> {
  const normalizedTool = toolId.trim().slice(0, 100);
  if (!normalizedTool) throw new HttpError(400, "Tool id is required");

  const [{ data: rule, error: ruleError }, { data: planData, error: planError }] = await Promise.all([
    admin.from("tool_access_rules").select("minimum_plan,enabled").eq("tool_id", normalizedTool).maybeSingle(),
    admin.rpc("team_effective_plan", { p_user_id: userId }),
  ]);

  if (ruleError || planError) {
    console.error("[TOOL ACCESS] Failed to load plan access state");
    throw new HttpError(503, "Tool access could not be verified");
  }
  if (!rule) throw new HttpError(503, "Tool access is not configured");

  const effectivePlan = typeof planData === "string" ? planData : "free";
  const requiredPlan = typeof rule.minimum_plan === "string" ? rule.minimum_plan : "free";
  if (rule.enabled === false) throw new HttpError(503, "This tool is temporarily unavailable");
  if (planRank(effectivePlan) < planRank(requiredPlan)) {
    throw new HttpError(403, "Your current plan does not include this tool");
  }

  const { data: limits, error: limitError } = await admin
    .from("tool_plan_limits")
    .select("period,free_limit,pro_limit,business_limit")
    .eq("tool_id", normalizedTool)
    .maybeSingle();

  if (limitError) {
    console.error("[TOOL ACCESS] Failed to load tool quota");
    throw new HttpError(503, "Tool limits could not be verified");
  }
  if (!limits) throw new HttpError(503, "Tool limits are not configured");

  const rawLimit = effectivePlan === "business"
    ? limits.business_limit
    : effectivePlan === "pro"
      ? limits.pro_limit
      : limits.free_limit;
  if (rawLimit === null || rawLimit === undefined) return;

  const limit = Number(rawLimit);
  if (!Number.isFinite(limit) || limit < 0) {
    throw new HttpError(503, "Tool limit configuration is invalid");
  }
  if (limit === 0) throw new HttpError(429, "Usage limit reached for this tool");

  let usageQuery = admin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tool", normalizedTool)
    .eq("status", "success");

  const windowStart = usageWindowStart(typeof limits.period === "string" ? limits.period : "monthly");
  if (windowStart) usageQuery = usageQuery.gte("created_at", windowStart);

  const { count, error: usageError } = await usageQuery;
  if (usageError) {
    console.error("[TOOL ACCESS] Failed to count tool usage");
    throw new HttpError(503, "Tool usage could not be verified");
  }
  if ((count || 0) >= limit) throw new HttpError(429, "Usage limit reached for this tool");
}

export async function requireUser(req: Request): Promise<User> {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "Missing authorization token");
  }

  const userClient = createClient(getSupabaseUrl(), getPublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session");

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("suspended")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new HttpError(503, "Account status could not be verified");
  }
  if (profile?.suspended === true) {
    throw new HttpError(403, "Account suspended");
  }

  return data.user;
}

export function getStripeSecret(): string {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new HttpError(503, "Stripe is not configured yet");
  return key;
}

export async function stripeRequest<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; params?: URLSearchParams } = {},
): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: init.method || "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecret()}`,
      ...(init.params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.params?.toString(),
  });

  const raw = await response.text();
  let data: unknown = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }
  if (!response.ok) {
    const stripeError = data && typeof data === "object"
      ? (data as { error?: { message?: unknown } }).error
      : undefined;
    const message = typeof stripeError?.message === "string"
      ? stripeError.message
      : `Stripe request failed (${response.status})`;
    throw new HttpError(response.status >= 500 ? 502 : 400, message);
  }
  return data as T;
}

export function safeAppOrigin(req: Request): string {
  const configured = Deno.env.get("APP_URL")?.trim();
  if (configured) {
    try { return new URL(configured).origin; } catch { /* fall through */ }
  }
  const origin = req.headers.get("Origin") || "";
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "https:" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return parsed.origin;
    }
  } catch { /* fall through */ }
  throw new HttpError(500, "APP_URL is not configured");
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleError(error: unknown): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error("[BILLING]", message);
  return jsonResponse({ error: message }, status);
}
