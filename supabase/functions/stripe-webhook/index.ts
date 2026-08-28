import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  getStripeSecret,
  handleError,
  HttpError,
  jsonResponse,
  stripeRequest,
} from "../_shared/billing.ts";

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<void> {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) throw new HttpError(400, "Invalid Stripe signature header");

  const unix = Number(timestamp);
  if (!Number.isFinite(unix) || Math.abs(Date.now() / 1000 - unix) > 300) {
    throw new HttpError(400, "Stripe webhook timestamp is outside tolerance");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = hex(digest);
  if (!signatures.some((signature) => timingSafeEqual(signature, expected))) {
    throw new HttpError(400, "Stripe signature verification failed");
  }
}

function planFromPrice(priceId: string | null | undefined, metadataPlan?: unknown): "free" | "pro" | "business" {
  const pro = Deno.env.get("STRIPE_PRO_PRICE_ID")?.trim();
  const business = Deno.env.get("STRIPE_BUSINESS_PRICE_ID")?.trim();
  if (priceId && business && priceId === business) return "business";
  if (priceId && pro && priceId === pro) return "pro";
  const meta = String(metadataPlan || "").toLowerCase();
  return meta === "business" ? "business" : meta === "pro" ? "pro" : "free";
}

function isoFromUnix(value: unknown): string | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000).toISOString() : null;
}

async function syncSubscription(subscription: any, fallbackUserId?: string | null): Promise<void> {
  const admin = createAdminClient();
  const stripeCustomerId = typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id || null;
  const stripeSubscriptionId = subscription?.id || null;
  const item = subscription?.items?.data?.[0] || null;
  const stripePriceId = item?.price?.id || item?.plan?.id || null;
  const periodEnd = item?.current_period_end ?? subscription?.current_period_end ?? null;
  let userId = String(subscription?.metadata?.user_id || fallbackUserId || "").trim() || null;

  if (!userId && stripeSubscriptionId) {
    const { data } = await admin.from("subscriptions").select("user_id").eq("stripe_subscription_id", stripeSubscriptionId).maybeSingle();
    userId = data?.user_id || null;
  }
  if (!userId && stripeCustomerId) {
    const { data } = await admin.from("subscriptions").select("user_id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
    userId = data?.user_id || null;
  }
  if (!userId) throw new HttpError(400, "Could not resolve subscription owner");

  const plan = planFromPrice(stripePriceId, subscription?.metadata?.plan);
  const status = String(subscription?.status || "canceled");
  const { error } = await admin.rpc("sync_billing_subscription", {
    p_user_id: userId,
    p_plan: plan,
    p_status: status,
    p_stripe_customer_id: stripeCustomerId,
    p_stripe_subscription_id: stripeSubscriptionId,
    p_stripe_price_id: stripePriceId,
    p_current_period_end: isoFromUnix(periodEnd),
    p_cancel_at_period_end: subscription?.cancel_at_period_end === true,
  });
  if (error) throw new HttpError(500, `Could not sync subscription: ${error.message}`);
}

async function retrieveSubscription(id: string): Promise<any> {
  // GET requests still authenticate with the server-side Stripe secret.
  getStripeSecret();
  return await stripeRequest(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "GET" });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!webhookSecret) throw new HttpError(503, "STRIPE_WEBHOOK_SECRET is not configured");
    const signature = req.headers.get("stripe-signature") || "";
    const payload = await req.text();
    await verifyStripeSignature(payload, signature, webhookSecret);
    const event = JSON.parse(payload);
    const object = event?.data?.object;

    if (event?.type === "checkout.session.completed" && object?.mode === "subscription") {
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : object.subscription?.id;
      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        await syncSubscription(subscription, object?.metadata?.user_id || object?.client_reference_id || null);
      }
    } else if ([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event?.type)) {
      await syncSubscription(object);
    } else if (event?.type === "invoice.payment_failed") {
      const subscriptionId = typeof object?.subscription === "string" ? object.subscription : object?.subscription?.id;
      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        await syncSubscription(subscription);
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    return handleError(error);
  }
});
