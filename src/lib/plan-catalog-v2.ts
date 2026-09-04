import { supabase } from '@/lib/supabase';
import type { Language } from '@/lib/i18n';

export type PlanId = 'free' | 'pro' | 'business';
export type LocalizedPlanText = Record<Language, string>;

export interface PlanAdminEntryV2 {
  visible: boolean;
  featured: boolean;
  description: LocalizedPlanText;
}

export interface PlanAdminCatalogV2 {
  version: 2;
  plans: Record<PlanId, PlanAdminEntryV2>;
}

export interface PublicPlanToolV2 {
  id: string;
  label: string;
  minimumPlan: PlanId;
  limit: number | null;
  period: 'daily' | 'monthly' | 'lifetime';
}

export interface PublicPlanPriceV2 {
  priceId: string | null;
  unitAmount: number;
  currency: string;
  interval: 'month' | 'year' | 'forever';
}

export interface PublicPlanV2 {
  id: PlanId;
  visible: boolean;
  featured: boolean;
  description: LocalizedPlanText;
  price: PublicPlanPriceV2;
  tools: PublicPlanToolV2[];
}

export interface PublicPlanCatalogV2 {
  version: 2;
  plans: PublicPlanV2[];
}

export const DEFAULT_PLAN_ADMIN_CATALOG_V2: PlanAdminCatalogV2 = {
  version: 2,
  plans: {
    free: {
      visible: true,
      featured: false,
      description: {
        en: 'For exploring Tayar with the Free tools and limits enforced by your plan.',
        ar: 'لاستكشاف Tayar باستخدام أدوات وحدود الخطة المجانية الفعلية.',
        sv: 'För att utforska Tayar med de verktyg och gränser som faktiskt ingår i Free.',
      },
    },
    pro: {
      visible: true,
      featured: true,
      description: {
        en: 'For professionals who need Pro tools and higher usage limits.',
        ar: 'للمحترفين الذين يحتاجون أدوات Pro وحدود استخدام أعلى.',
        sv: 'För professionella som behöver Pro-verktyg och högre användningsgränser.',
      },
    },
    business: {
      visible: true,
      featured: false,
      description: {
        en: 'For teams and higher-volume work with Business-only tools and the highest limits.',
        ar: 'للفرق والعمل بحجم أكبر مع أدوات Business وأعلى حدود الاستخدام.',
        sv: 'För team och större arbetsvolymer med Business-verktyg och de högsta gränserna.',
      },
    },
  },
};

const PLAN_IDS: PlanId[] = ['free', 'pro', 'business'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function languageText(value: unknown, fallback: LocalizedPlanText): LocalizedPlanText {
  if (!isRecord(value)) return fallback;
  return {
    en: typeof value.en === 'string' && value.en.trim() ? value.en.trim() : fallback.en,
    ar: typeof value.ar === 'string' && value.ar.trim() ? value.ar.trim() : fallback.ar,
    sv: typeof value.sv === 'string' && value.sv.trim() ? value.sv.trim() : fallback.sv,
  };
}

export function normalizePlanAdminCatalogV2(value: unknown): PlanAdminCatalogV2 {
  const root = isRecord(value) ? value : {};
  const plans = isRecord(root.plans) ? root.plans : {};
  const normalized = structuredClone(DEFAULT_PLAN_ADMIN_CATALOG_V2);

  for (const planId of PLAN_IDS) {
    const current = isRecord(plans[planId]) ? plans[planId] as Record<string, unknown> : {};
    const fallback = DEFAULT_PLAN_ADMIN_CATALOG_V2.plans[planId];
    normalized.plans[planId] = {
      visible: typeof current.visible === 'boolean' ? current.visible : fallback.visible,
      featured: typeof current.featured === 'boolean' ? current.featured : fallback.featured,
      description: languageText(current.description, fallback.description),
    };
  }

  return normalized;
}

export async function fetchPublicPlanCatalogV2(): Promise<PublicPlanCatalogV2> {
  const { data, error } = await supabase.functions.invoke('public-plan-catalog', { body: {} });
  if (error) throw error;
  if (!isRecord(data) || data.version !== 2 || !Array.isArray(data.plans)) {
    throw new Error('Invalid public plan catalog response');
  }
  return data as unknown as PublicPlanCatalogV2;
}

export function planDisplayName(planId: PlanId): string {
  return planId === 'free' ? 'Free' : planId === 'pro' ? 'Pro' : 'Business';
}

export function languageLocale(language: Language): string {
  return language === 'ar' ? 'ar' : language === 'sv' ? 'sv-SE' : 'en-US';
}

export function formatPlanPrice(price: PublicPlanPriceV2, language: Language): string {
  if (price.unitAmount === 0) return '$0';
  try {
    return new Intl.NumberFormat(languageLocale(language), {
      style: 'currency',
      currency: price.currency.toUpperCase(),
      maximumFractionDigits: price.unitAmount % 100 === 0 ? 0 : 2,
    }).format(price.unitAmount / 100);
  } catch {
    return `${(price.unitAmount / 100).toLocaleString()} ${price.currency.toUpperCase()}`;
  }
}
