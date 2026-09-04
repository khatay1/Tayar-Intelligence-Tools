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

type PaidPlan = "pro" | "business";

const FALLBACK_PRICE_IDS: Record<PaidPlan, string> = {
  pro: "price_1UBuNbPf8BnXUBSOvSHBpzC6",
  business: "price_1UBuNgPf8BnXUBSOLH3TM9ms",
};

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
  return { user, admin };
}

function planSettingKey(plan: PaidPlan) {
  return plan === "pro" ? "stripe_pro_price_id" : "stripe_business_price_id";
}

async function currentPriceId(admin: ReturnType<typeof createAdminClient>, plan: PaidPlan): Promise<string> {
  const key = planSettingKey(plan);
  const { data } = await admin.from("admin_settings").select("value").eq("key", key).maybeSingle();
  const stored = typeof data?.value === "string" ? data.value.replace(/^"|"$/g, "").trim() : "";
  const envKey = plan === "pro" ? Deno.env.get("STRIPE_PRO_PRICE_ID") : Deno.env.get("STRIPE_BUSINESS_PRICE_ID");
  return stored || envKey?.trim() || FALLBACK_PRICE_IDS[plan];
}

function parsePlan(value: unknown): PaidPlan {
  const plan = String(value || "").toLowerCase();
  if (plan !== "pro" && plan !== "business") throw new HttpError(400, "Choose Pro or Business");
  return plan;
}

function parsePositiveInteger(value: unknown, field: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new HttpError(400, `${field} must be a positive integer`);
  return number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { admin } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "create_price") {
      const plan = parsePlan(body?.plan);
      const unitAmount = parsePositiveInteger(body?.unitAmount, "unitAmount");
      if (unitAmount > 1_000_000_00) throw new HttpError(400, "Price is above the allowed administrative limit");
      const currency = String(body?.currency || "usd").trim().toLowerCase();
      if (!/^[a-z]{3}$/.test(currency)) throw new HttpError(400, "Currency must be a 3-letter code");
      const interval = String(body?.interval || "month").toLowerCase();
      if (!['month', 'year'].includes(interval)) throw new HttpError(400, "Interval must be month or year");

      const previousPriceId = await currentPriceId(admin, plan);
      const previousPrice = await stripeRequest<{ id: string; product: string | { id?: string }; livemode?: boolean }>(
        `/v1/prices/${encodeURIComponent(previousPriceId)}`,
        { method: "GET" },
      );
      const productId = typeof previousPrice.product === "string" ? previousPrice.product : previousPrice.product?.id;
      if (!productId) throw new HttpError(502, "Could not determine the Stripe product for this plan");

      const params = new URLSearchParams();
      params.set("product", productId);
      params.set("currency", currency);
      params.set("unit_amount", String(unitAmount));
      params.set("recurring[interval]", interval);
      params.set("nickname", `Tayar ${plan} ${unitAmount} ${currency}/${interval}`);
      params.set("metadata[tayar_plan]", plan);
      params.set("metadata[managed_by]", "tayar_admin");

      const price = await stripeRequest<{ id: string; active?: boolean; currency?: string; unit_amount?: number; recurring?: { interval?: string }; livemode?: boolean }>("/v1/prices", { params });
      if (!price.id) throw new HttpError(502, "Stripe did not return a new price ID");

      const { error } = await admin.from("admin_settings").upsert({
        key: planSettingKey(plan),
        value: price.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      if (error) throw new HttpError(500, "The Stripe price was created but Tayar could not activate it");

      return jsonResponse({ ok: true, plan, previousPriceId, price });
    }

    if (action === "create_coupon") {
      const code = String(body?.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new HttpError(400, "Coupon code must be 3-32 letters, numbers, underscores, or hyphens");
      const discountType = String(body?.discountType || "percent");
      const duration = String(body?.duration || "once");
      if (!['once', 'forever'].includes(duration)) throw new HttpError(400, "Duration must be once or forever");

      const couponParams = new URLSearchParams();
      couponParams.set("duration", duration);
      couponParams.set("name", code);
      couponParams.set("metadata[managed_by]", "tayar_admin");

      if (discountType === "percent") {
        const percent = Number(body?.percentOff);
        if (!Number.isFinite(percent) || percent <= 0 || percent > 100) throw new HttpError(400, "percentOff must be between 0 and 100");
        couponParams.set("percent_off", String(percent));
      } else if (discountType === "amount") {
        const amountOff = parsePositiveInteger(body?.amountOff, "amountOff");
        const currency = String(body?.currency || "usd").trim().toLowerCase();
        if (!/^[a-z]{3}$/.test(currency)) throw new HttpError(400, "Currency must be a 3-letter code");
        couponParams.set("amount_off", String(amountOff));
        couponParams.set("currency", currency);
      } else {
        throw new HttpError(400, "discountType must be percent or amount");
      }

      const coupon = await stripeRequest<{ id: string }>("/v1/coupons", { params: couponParams });
      if (!coupon.id) throw new HttpError(502, "Stripe did not return a coupon ID");

      const promotionParams = new URLSearchParams();
      promotionParams.set("promotion[coupon]", coupon.id);
      promotionParams.set("code", code);
      promotionParams.set("active", "true");
      if (body?.maxRedemptions !== undefined && body?.maxRedemptions !== null && body?.maxRedemptions !== '') {
        promotionParams.set("max_redemptions", String(parsePositiveInteger(body.maxRedemptions, "maxRedemptions")));
      }
      if (body?.expiresAt) {
        const expiresAt = Math.floor(new Date(String(body.expiresAt)).getTime() / 1000);
        if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) throw new HttpError(400, "expiresAt must be in the future");
        promotionParams.set("expires_at", String(expiresAt));
      }

      const promotion = await stripeRequest<{ id: string; code?: string; active?: boolean }>("/v1/promotion_codes", { params: promotionParams });
      return jsonResponse({ ok: true, couponId: coupon.id, promotion });
    }

    if (action === "list_coupons") {
      const promotions = await stripeRequest<{ data?: unknown[] }>("/v1/promotion_codes?limit=100", { method: "GET" });
      return jsonResponse({ ok: true, promotions: promotions.data || [] });
    }

    if (action === "disable_coupon") {
      const promotionCodeId = String(body?.promotionCodeId || "").trim();
      if (!/^promo_[A-Za-z0-9]+$/.test(promotionCodeId)) throw new HttpError(400, "Invalid promotion code ID");
      const params = new URLSearchParams();
      params.set("active", "false");
      const promotion = await stripeRequest(`/v1/promotion_codes/${encodeURIComponent(promotionCodeId)}`, { params });
      return jsonResponse({ ok: true, promotion });
    }

    throw new HttpError(400, "Unknown billing admin action");
  } catch (error) {
    return handleError(error);
  }
});
