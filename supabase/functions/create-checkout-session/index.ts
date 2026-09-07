import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  assertOperationEnabled,
  corsHeaders,
  createAdminClient,
  handleError,
  HttpError,
  jsonResponse,
  requireUser,
  safeAppOrigin,
  stripeRequest,
} from "../_shared/billing.ts";

type PaidPlan = "pro" | "business";

function settingKeyForPlan(plan: PaidPlan): string {
  return plan === "pro" ? "stripe_pro_price_id" : "stripe_business_price_id";
}

function billingReturnUrl(origin: string, status: "success" | "canceled", nativeClient: boolean): string {
  const url = new URL(origin);
  url.pathname = "/";
  url.searchParams.set("billing", status);
  if (nativeClient) url.searchParams.set("native", "1");
  url.hash = "workspace/subscription";
  return url.toString();
}

async function priceForPlan(admin: ReturnType<typeof createAdminClient>, plan: PaidPlan): Promise<string> {
  const { data, error } = await admin
    .from("admin_settings")
    .select("value")
    .eq("key", settingKeyForPlan(plan))
    .maybeSingle();
  if (error) console.warn("[BILLING] Could not load the admin-managed Stripe price; checking the environment configuration", error.message);

  const stored = typeof data?.value === "string" ? data.value.replace(/^"|"$/g, "").trim() : "";
  const envKey = plan === "pro" ? "STRIPE_PRO_PRICE_ID" : "STRIPE_BUSINESS_PRICE_ID";
  const priceId = stored || Deno.env.get(envKey)?.trim() || "";
  if (!/^price_[A-Za-z0-9]+$/.test(priceId)) {
    throw new HttpError(503, `${plan} Checkout price is not configured`);
  }
  return priceId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan || "").toLowerCase() as PaidPlan;
    if (plan !== "pro" && plan !== "business") throw new HttpError(400, "Choose Pro or Business");
    const requestId = String(body?.requestId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new HttpError(400, "A valid Checkout request ID is required");
    }
    const nativeClient = String(body?.client || "web").trim().toLowerCase() === "native";

    const admin = createAdminClient();
    await assertOperationEnabled(admin, "checkout");

    const [{ data: existing, error }, priceId] = await Promise.all([
      admin
        .from("subscriptions")
        .select("plan,status,stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      priceForPlan(admin, plan),
    ]);
    if (error) throw new HttpError(500, "Could not load billing account");

    const managedPaidStatuses = ["active", "trialing", "past_due", "unpaid", "incomplete", "paused"];
    if (existing?.stripe_customer_id && managedPaidStatuses.includes(existing.status)) {
      if (existing.plan === plan && ["active", "trialing"].includes(existing.status)) {
        throw new HttpError(409, `Your ${plan} subscription is already active`);
      }
      throw new HttpError(409, "Manage the existing paid subscription in the billing portal before starting another checkout");
    }

    const origin = safeAppOrigin(req);
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", billingReturnUrl(origin, "success", nativeClient));
    params.set("cancel_url", billingReturnUrl(origin, "canceled", nativeClient));
    params.set("allow_promotion_codes", "true");
    params.set("client_reference_id", user.id);
    params.set("metadata[user_id]", user.id);
    params.set("metadata[plan]", plan);
    params.set("subscription_data[metadata][user_id]", user.id);
    params.set("subscription_data[metadata][plan]", plan);

    if (existing?.stripe_customer_id) params.set("customer", existing.stripe_customer_id);
    else if (user.email) params.set("customer_email", user.email);

    const session = await stripeRequest("/v1/checkout/sessions", {
      params,
      idempotencyKey: `checkout:${user.id}:${requestId}`,
    });
    if (!session?.url) throw new HttpError(502, "Stripe did not return a Checkout URL");
    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (error) {
    return handleError(error);
  }
});
