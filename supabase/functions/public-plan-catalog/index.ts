import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, createAdminClient, handleError, HttpError } from "../_shared/billing.ts";

type PlanId = "free" | "pro" | "business";
type LimitPeriod = "daily" | "monthly" | "lifetime";
type LocalizedText = { en: string; ar: string; sv: string };

type PlanAdminEntry = {
  visible: boolean;
  featured: boolean;
  description: LocalizedText;
};

type PlanAdminCatalog = {
  version: 2;
  plans: Record<PlanId, PlanAdminEntry>;
};

type ToolRule = { tool_id: string; minimum_plan: PlanId; enabled: boolean };
type ToolLimit = {
  tool_id: string;
  free_limit: number | null;
  pro_limit: number | null;
  business_limit: number | null;
  period: LimitPeriod;
};

type PublicPrice = {
  priceId: string | null;
  unitAmount: number;
  currency: string;
  interval: "month" | "year" | "forever";
};

const PLAN_IDS: PlanId[] = ["free", "pro", "business"];
const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, business: 2 };
const FALLBACK_PRICE_IDS: Record<Exclude<PlanId, "free">, string> = {
  pro: "price_1UBuNbPf8BnXUBSOvSHBpzC6",
  business: "price_1UBuNgPf8BnXUBSOLH3TM9ms",
};

const DEFAULT_PLAN_CATALOG: PlanAdminCatalog = {
  version: 2,
  plans: {
    free: {
      visible: true,
      featured: false,
      description: {
        en: "For exploring Tayar with the Free tools and limits enforced by your plan.",
        ar: "لاستكشاف Tayar باستخدام أدوات وحدود الخطة المجانية الفعلية.",
        sv: "För att utforska Tayar med de verktyg och gränser som faktiskt ingår i Free.",
      },
    },
    pro: {
      visible: true,
      featured: true,
      description: {
        en: "For professionals who need Pro tools and higher usage limits.",
        ar: "للمحترفين الذين يحتاجون أدوات Pro وحدود استخدام أعلى.",
        sv: "För professionella som behöver Pro-verktyg och högre användningsgränser.",
      },
    },
    business: {
      visible: true,
      featured: false,
      description: {
        en: "For teams and higher-volume work with Business-only tools and the highest limits.",
        ar: "للفرق والعمل بحجم أكبر مع أدوات Business وأعلى حدود الاستخدام.",
        sv: "För team och större arbetsvolymer med Business-verktyg och de högsta gränserna.",
      },
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function localized(value: unknown, fallback: LocalizedText): LocalizedText {
  if (!isRecord(value)) return fallback;
  return {
    en: typeof value.en === "string" && value.en.trim() ? value.en.trim() : fallback.en,
    ar: typeof value.ar === "string" && value.ar.trim() ? value.ar.trim() : fallback.ar,
    sv: typeof value.sv === "string" && value.sv.trim() ? value.sv.trim() : fallback.sv,
  };
}

function normalizeCatalog(value: unknown): PlanAdminCatalog {
  const root = isRecord(value) ? value : {};
  const plans = isRecord(root.plans) ? root.plans : {};
  const result = structuredClone(DEFAULT_PLAN_CATALOG);
  for (const planId of PLAN_IDS) {
    const source = isRecord(plans[planId]) ? plans[planId] as Record<string, unknown> : {};
    const fallback = DEFAULT_PLAN_CATALOG.plans[planId];
    result.plans[planId] = {
      visible: typeof source.visible === "boolean" ? source.visible : fallback.visible,
      featured: typeof source.featured === "boolean" ? source.featured : fallback.featured,
      description: localized(source.description, fallback.description),
    };
  }
  return result;
}

function settingValue(settings: Map<string, unknown>, key: string): unknown {
  const value = settings.get(key);
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try { return JSON.parse(trimmed); } catch { return value.replace(/^"|"$/g, ""); }
}

function readPrice(settings: Map<string, unknown>, plan: Exclude<PlanId, "free">): PublicPrice {
  const fallbackAmount = plan === "pro" ? 1900 : 4900;
  const raw = settingValue(settings, `stripe_${plan}_price_public`);
  const currentPriceId = String(settingValue(settings, `stripe_${plan}_price_id`) || FALLBACK_PRICE_IDS[plan]);
  if (!isRecord(raw)) {
    return { priceId: currentPriceId, unitAmount: fallbackAmount, currency: "usd", interval: "month" };
  }
  const unitAmount = Number(raw.unitAmount);
  const interval = raw.interval === "year" ? "year" : "month";
  const currency = typeof raw.currency === "string" && /^[a-z]{3}$/i.test(raw.currency) ? raw.currency.toLowerCase() : "usd";
  const priceId = typeof raw.priceId === "string" && raw.priceId.trim() ? raw.priceId.trim() : currentPriceId;
  return {
    priceId,
    unitAmount: Number.isFinite(unitAmount) && unitAmount > 0 ? Math.floor(unitAmount) : fallbackAmount,
    currency,
    interval,
  };
}

function toolLabel(toolId: string): string {
  const acronyms: Record<string, string> = { ai: "AI", pdf: "PDF", csv: "CSV", cv: "CV" };
  return toolId.split("-").filter(Boolean).map((part) => acronyms[part.toLowerCase()] || `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

function planLimit(row: ToolLimit | undefined, plan: PlanId): number | null {
  if (!row) return null;
  const value = plan === "business" ? row.business_limit : plan === "pro" ? row.pro_limit : row.free_limit;
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function publicResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createAdminClient();
    const [settingsRes, rulesRes, limitsRes] = await Promise.all([
      admin.from("admin_settings").select("key,value").in("key", [
        "plan_catalog_v2",
        "stripe_pro_price_id",
        "stripe_business_price_id",
        "stripe_pro_price_public",
        "stripe_business_price_public",
      ]),
      admin.from("tool_access_rules").select("tool_id,minimum_plan,enabled").eq("enabled", true),
      admin.from("tool_plan_limits").select("tool_id,free_limit,pro_limit,business_limit,period"),
    ]);

    const queryError = settingsRes.error || rulesRes.error || limitsRes.error;
    if (queryError) throw new HttpError(503, "Plan catalog is temporarily unavailable");

    const settings = new Map<string, unknown>();
    for (const row of settingsRes.data || []) settings.set(String(row.key), row.value);
    const catalog = normalizeCatalog(settingValue(settings, "plan_catalog_v2"));
    const rules = (rulesRes.data || []) as ToolRule[];
    const limitMap = new Map<string, ToolLimit>();
    for (const row of (limitsRes.data || []) as ToolLimit[]) limitMap.set(row.tool_id, row);

    const prices: Record<PlanId, PublicPrice> = {
      free: { priceId: null, unitAmount: 0, currency: "usd", interval: "forever" },
      pro: readPrice(settings, "pro"),
      business: readPrice(settings, "business"),
    };

    const plans = PLAN_IDS.map((planId) => {
      const tools = rules
        .filter((rule) => PLAN_RANK[planId] >= PLAN_RANK[rule.minimum_plan])
        .map((rule) => {
          const limitRow = limitMap.get(rule.tool_id);
          return {
            id: rule.tool_id,
            label: toolLabel(rule.tool_id),
            minimumPlan: rule.minimum_plan,
            limit: planLimit(limitRow, planId),
            period: limitRow?.period || "monthly",
          };
        })
        .filter((tool) => tool.limit !== 0)
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        id: planId,
        visible: catalog.plans[planId].visible,
        featured: catalog.plans[planId].featured,
        description: catalog.plans[planId].description,
        price: prices[planId],
        tools,
      };
    });

    return publicResponse({ version: 2, plans });
  } catch (error) {
    return handleError(error);
  }
});
