import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  getStripeSecret,
  handleError,
  HttpError,
  jsonResponse,
  stripeRequest,
} from "../_shared/billing.ts";

interface StripeReference { id?: string | null; }
interface StripeSubscriptionItem { current_period_end?: unknown; price?: StripeReference | null; plan?: StripeReference | null; }
interface StripeSubscription {
  customer?: string | StripeReference | null;
  id?: string | null;
  items?: { data?: StripeSubscriptionItem[] | null } | null;
  current_period_end?: unknown;
  metadata?: { user_id?: unknown; plan?: unknown } | null;
  status?: unknown;
  cancel_at_period_end?: boolean | null;
}
interface StripeInvoice {
  subscription?: string | StripeReference | null;
  parent?: { subscription_details?: { subscription?: string | StripeReference | null } | null } | null;
}
interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data?: { object?: Record<string, unknown> | null } | null;
}

type AdminClient = ReturnType<typeof createAdminClient>;
type Plan = "free" | "pro" | "business";

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

function metadataPlan(value: unknown): Plan | null {
  const normalized = String(value || "").toLowerCase();
  return normalized === "pro" || normalized === "business" ? normalized : null;
}

async function planFromPrice(
  admin: AdminClient,
  priceId: string | null,
  metadataValue: unknown,
  userId: string,
): Promise<Plan> {
  if (priceId) {
    const { data, error } = await admin
      .from("stripe_price_plan_map")
      .select("plan")
      .eq("price_id", priceId)
      .maybeSingle();
    if (error) throw new HttpError(503, "Could not resolve the Stripe price mapping");
    if (data?.plan === "pro" || data?.plan === "business") return data.plan;

    const pro = Deno.env.get("STRIPE_PRO_PRICE_ID")?.trim();
    const business = Deno.env.get("STRIPE_BUSINESS_PRICE_ID")?.trim();
    if (business && priceId === business) return "business";
    if (pro && priceId === pro) return "pro";
  }

  // A deletion for a legacy Price can safely inherit the already-known plan.
  // A new unmapped Price stops for review rather than silently granting Free.
  const { data: current, error } = await admin
    .from("subscriptions")
    .select("plan,stripe_price_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(503, "Could not inspect the current subscription plan");
  if (
    (current?.plan === "pro" || current?.plan === "business") &&
    (!priceId || current.stripe_price_id === priceId)
  ) {
    return current.plan;
  }

  if (!priceId) return metadataPlan(metadataValue) || "free";
  throw new HttpError(409, "Stripe Price is not mapped to a Tayar plan");
}

function isoFromUnix(value: unknown): string | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000).toISOString() : null;
}

function referenceId(value: string | StripeReference | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id || null;
}

function invoiceSubscriptionId(invoice: StripeInvoice | null | undefined): string | null {
  return referenceId(invoice?.subscription) || referenceId(invoice?.parent?.subscription_details?.subscription);
}

async function syncSubscription(
  admin: AdminClient,
  subscription: StripeSubscription,
  event: StripeEvent,
  fallbackUserId?: string | null,
): Promise<void> {
  const stripeCustomerId = typeof subscription?.customer === "string"
    ? subscription.customer
    : subscription?.customer?.id || null;
  const stripeSubscriptionId = subscription?.id || null;
  const item = subscription?.items?.data?.[0] || null;
  const stripePriceId = item?.price?.id || item?.plan?.id || null;
  const periodEnd = item?.current_period_end ?? subscription?.current_period_end ?? null;
  let userId = String(subscription?.metadata?.user_id || fallbackUserId || "").trim() || null;

  if (!userId && stripeSubscriptionId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    userId = data?.user_id || null;
  }
  if (!userId && stripeCustomerId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    userId = data?.user_id || null;
  }
  if (!userId) throw new HttpError(400, "Could not resolve subscription owner");

  const { data: owner, error: ownerError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (ownerError) throw new HttpError(503, "Could not verify the subscription owner");
  // Account deletion cancels Stripe before removing the Auth user. A delayed
  // cancellation webhook for that deleted owner is complete by definition.
  if (!owner) return;

  const plan = await planFromPrice(admin, stripePriceId, subscription?.metadata?.plan, userId);
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
    p_event_created: event.created,
    p_event_id: event.id,
  });
  if (error) throw new HttpError(500, `Could not sync subscription: ${error.message}`);
}

async function retrieveSubscription(id: string): Promise<StripeSubscription> {
  getStripeSecret();
  return await stripeRequest<StripeSubscription>(`/v1/subscriptions/${encodeURIComponent(id)}`, { method: "GET" });
}

async function claimEvent(
  admin: AdminClient,
  event: StripeEvent,
  objectId: string | null,
): Promise<"claimed" | "processed" | "processing"> {
  const { data, error } = await admin.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_object_id: objectId,
    p_event_created: event.created,
  });
  if (error) throw new HttpError(503, "Could not claim the Stripe webhook event");
  if (data === true) return "claimed";

  const { data: existing, error: lookupError } = await admin
    .from("stripe_webhook_events")
    .select("status")
    .eq("event_id", event.id)
    .maybeSingle();
  if (lookupError || !existing) throw new HttpError(503, "Could not verify the Stripe webhook event state");
  return existing.status === "processed" ? "processed" : "processing";
}

async function updateEventStatus(
  admin: AdminClient,
  eventId: string,
  status: "processed" | "failed",
  errorMessage?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("stripe_webhook_events")
    .update({
      status,
      processed_at: status === "processed" ? now : null,
      last_error: status === "failed" ? String(errorMessage || "Webhook processing failed").slice(0, 500) : null,
      updated_at: now,
    })
    .eq("event_id", eventId)
    .eq("status", "processing");
  if (error) throw new HttpError(503, `Could not mark the Stripe webhook event ${status}`);
}

async function pruneOldEventRecords(admin: AdminClient): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("stripe_webhook_events")
    .delete()
    .in("status", ["processed", "failed"])
    .lt("created_at", cutoff);
  if (error) console.error("[BILLING] Could not prune old webhook event records");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let claimedEventId: string | null = null;
  let admin: AdminClient | null = null;
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!webhookSecret) throw new HttpError(503, "STRIPE_WEBHOOK_SECRET is not configured");
    const signature = req.headers.get("stripe-signature") || "";
    const payload = await req.text();
    await verifyStripeSignature(payload, signature, webhookSecret);

    let parsed: unknown;
    try { parsed = JSON.parse(payload); } catch { throw new HttpError(400, "Invalid Stripe event payload"); }
    const candidate = parsed as Partial<StripeEvent>;
    const eventId = typeof candidate.id === "string" ? candidate.id : "";
    const eventType = typeof candidate.type === "string" ? candidate.type : "";
    const eventCreated = Number(candidate.created);
    if (!/^evt_[A-Za-z0-9]+$/.test(eventId) || !eventType || !Number.isInteger(eventCreated) || eventCreated < 0) {
      throw new HttpError(400, "Invalid Stripe event envelope");
    }
    const event = { ...candidate, id: eventId, type: eventType, created: eventCreated } as StripeEvent;
    const object = event.data?.object || null;
    const objectId = typeof object?.id === "string" ? object.id : null;

    admin = createAdminClient();
    const claim = await claimEvent(admin, event, objectId);
    if (claim === "processed") return jsonResponse({ received: true, duplicate: true });
    if (claim === "processing") throw new HttpError(503, "Stripe webhook event is already processing");
    claimedEventId = event.id;

    if (event.type === "checkout.session.completed" && object?.mode === "subscription") {
      const rawSubscription = object.subscription;
      const subscriptionId = typeof rawSubscription === "string"
        ? rawSubscription
        : referenceId(rawSubscription as StripeReference | null | undefined);
      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        const metadata = object.metadata as { user_id?: unknown } | null | undefined;
        await syncSubscription(
          admin,
          subscription,
          event,
          String(metadata?.user_id || object.client_reference_id || "") || null,
        );
      }
    } else if (["customer.subscription.created", "customer.subscription.updated"].includes(event.type)) {
      // Stripe can deliver events out of order. For non-terminal updates, read
      // the current object so a delayed webhook cannot restore older billing
      // state even when two events share the same `created` second.
      if (!objectId) throw new HttpError(400, "Stripe subscription event is missing its object ID");
      const subscription = await retrieveSubscription(objectId);
      await syncSubscription(admin, subscription, event);
    } else if (event.type === "customer.subscription.deleted") {
      // A fully canceled subscription can no longer be retrieved, so the
      // terminal event itself is the source of truth.
      await syncSubscription(admin, object as StripeSubscription, event);
    } else if (["invoice.payment_failed", "invoice.paid"].includes(event.type)) {
      const subscriptionId = invoiceSubscriptionId(object as StripeInvoice);
      if (subscriptionId) {
        const subscription = await retrieveSubscription(subscriptionId);
        await syncSubscription(admin, subscription, event);
      }
    }

    await updateEventStatus(admin, event.id, "processed");
    await pruneOldEventRecords(admin);
    claimedEventId = null;
    return jsonResponse({ received: true });
  } catch (error) {
    if (claimedEventId && admin) {
      try {
        await updateEventStatus(admin, claimedEventId, "failed", error instanceof Error ? error.message : undefined);
      } catch (statusError) {
        console.error("[BILLING] Could not record failed webhook state", statusError);
      }
    }
    return handleError(error);
  }
});
