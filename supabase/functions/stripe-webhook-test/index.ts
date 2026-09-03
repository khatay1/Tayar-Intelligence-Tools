import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  handleError,
  HttpError,
  jsonResponse,
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

function testPlanFromPrice(priceId: string | null | undefined, metadataPlan?: unknown): "free" | "pro" | "business" {
  const pro = Deno.env.get("STRIPE_TEST_PRO_PRICE_ID")?.trim();
  const business = Deno.env.get("STRIPE_TEST_BUSINESS_PRICE_ID")?.trim();
  if (priceId && business && priceId === business) return "business";
  if (priceId && pro && priceId === pro) return "pro";
  const meta = String(metadataPlan || "").toLowerCase();
  return meta === "business" ? "business" : meta === "pro" ? "pro" : "free";
}

function isoFromUnix(value: unknown): string | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000).toISOString() : null;
}

async function syncSubscription(subscription: any): Promise<void> {
  if (subscription?.livemode !== false) throw new HttpError(400, "Test webhook only accepts Stripe test-mode events");

  const admin = createAdminClient();
  const item = subscription?.items?.data?.[0] || null;
  const stripePriceId = item?.price?.id || item?.plan?.id || null;
  const userId = String(subscription?.metadata?.user_id || "").trim();
  if (!userId) throw new HttpError(400, "Could not resolve subscription owner");

  const plan = testPlanFromPrice(stripePriceId, subscription?.metadata?.plan);
  const status = String(subscription?.status || "canceled");
  const stripeCustomerId = typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id || null;
  const periodEnd = item?.current_period_end ?? subscription?.current_period_end ?? null;

  const { error } = await admin.rpc("sync_billing_subscription", {
    p_user_id: userId,
    p_plan: plan,
    p_status: status,
    p_stripe_customer_id: stripeCustomerId,
    p_stripe_subscription_id: subscription?.id || null,
    p_stripe_price_id: stripePriceId,
    p_current_period_end: isoFromUnix(periodEnd),
    p_cancel_at_period_end: subscription?.cancel_at_period_end === true,
  });
  if (error) throw new HttpError(500, `Could not sync test subscription: ${error.message}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const webhookSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET")?.trim();
    if (!webhookSecret) throw new HttpError(503, "STRIPE_TEST_WEBHOOK_SECRET is not configured");

    const signature = req.headers.get("stripe-signature") || "";
    const payload = await req.text();
    await verifyStripeSignature(payload, signature, webhookSecret);
    const event = JSON.parse(payload);
    const object = event?.data?.object;

    if ([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event?.type)) {
      await syncSubscription(object);
    }

    return jsonResponse({ received: true, test: true });
  } catch (error) {
    return handleError(error);
  }
});
