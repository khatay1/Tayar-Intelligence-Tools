import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createAdminClient,
  handleError,
  HttpError,
  jsonResponse,
  requireUser,
  stripeRequest,
} from "../_shared/billing.ts";

interface StripeAccount {
  id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  country?: string;
  default_currency?: string;
  business_profile?: { name?: string | null } | null;
  settings?: { dashboard?: { display_name?: string | null } | null } | null;
}

interface StripePrice {
  id?: string;
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  recurring?: { interval?: string | null } | null;
  livemode?: boolean;
}

interface StripeWebhookEndpoint {
  id?: string;
  url?: string;
  status?: string;
  enabled_events?: string[];
  livemode?: boolean;
}

function env(name: string): string {
  return Deno.env.get(name)?.trim() || "";
}

async function requireAdmin(req: Request): Promise<void> {
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
}

async function loadPrice(priceId: string): Promise<StripePrice | null> {
  if (!priceId) return null;
  try {
    return await stripeRequest<StripePrice>(`/v1/prices/${encodeURIComponent(priceId)}`, { method: "GET" });
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    await requireAdmin(req);

    const stripeSecret = env("STRIPE_SECRET_KEY");
    const webhookSecret = env("STRIPE_WEBHOOK_SECRET");
    const proPriceId = env("STRIPE_PRO_PRICE_ID");
    const businessPriceId = env("STRIPE_BUSINESS_PRICE_ID");
    const supabaseUrl = env("SUPABASE_URL");

    if (!stripeSecret) {
      return jsonResponse({
        connected: false,
        mode: "unconfigured",
        account: null,
        plans: {
          pro: { configured: Boolean(proPriceId), priceId: proPriceId || null, valid: false },
          business: { configured: Boolean(businessPriceId), priceId: businessPriceId || null, valid: false },
        },
        webhook: { secretConfigured: Boolean(webhookSecret), endpointConfigured: false, endpointUrl: null },
        checkoutReady: false,
        portalReady: false,
      });
    }

    const mode = stripeSecret.startsWith("sk_live_")
      ? "live"
      : stripeSecret.startsWith("sk_test_")
        ? "test"
        : "unknown";

    const [account, proPrice, businessPrice, webhookList] = await Promise.all([
      stripeRequest<StripeAccount>("/v1/account", { method: "GET" }),
      loadPrice(proPriceId),
      loadPrice(businessPriceId),
      stripeRequest<{ data?: StripeWebhookEndpoint[] }>("/v1/webhook_endpoints?limit=100", { method: "GET" })
        .catch(() => ({ data: [] })),
    ]);

    const expectedWebhookUrl = supabaseUrl
      ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/stripe-webhook`
      : null;
    const webhookEndpoint = (webhookList.data || []).find((endpoint) => endpoint.url === expectedWebhookUrl) || null;
    const requiredEvents = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
    ];
    const enabledEvents = webhookEndpoint?.enabled_events || [];
    const receivesRequiredEvents = enabledEvents.includes("*")
      || requiredEvents.every((event) => enabledEvents.includes(event));

    const planState = (priceId: string, price: StripePrice | null) => ({
      configured: Boolean(priceId),
      priceId: priceId || null,
      valid: Boolean(price?.id && price.active),
      currency: price?.currency || null,
      unitAmount: typeof price?.unit_amount === "number" ? price.unit_amount : null,
      interval: price?.recurring?.interval || null,
      livemode: typeof price?.livemode === "boolean" ? price.livemode : null,
    });

    const pro = planState(proPriceId, proPrice);
    const business = planState(businessPriceId, businessPrice);
    const modeMatchesPrices =
      (mode === "live" && pro.livemode !== false && business.livemode !== false)
      || (mode === "test" && pro.livemode !== true && business.livemode !== true)
      || mode === "unknown";

    return jsonResponse({
      connected: true,
      mode,
      account: {
        id: account.id || null,
        name: account.settings?.dashboard?.display_name || account.business_profile?.name || null,
        country: account.country || null,
        defaultCurrency: account.default_currency || null,
        chargesEnabled: account.charges_enabled === true,
        payoutsEnabled: account.payouts_enabled === true,
        detailsSubmitted: account.details_submitted === true,
      },
      plans: { pro, business },
      webhook: {
        secretConfigured: Boolean(webhookSecret),
        endpointConfigured: Boolean(webhookEndpoint),
        endpointUrl: expectedWebhookUrl,
        status: webhookEndpoint?.status || null,
        receivesRequiredEvents,
      },
      checkoutReady: Boolean(pro.valid && business.valid && account.charges_enabled && modeMatchesPrices),
      portalReady: Boolean(account.id),
      modeMatchesPrices,
    });
  } catch (error) {
    return handleError(error);
  }
});
