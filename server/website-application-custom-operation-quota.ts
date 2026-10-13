import type { SupabaseClient } from '@supabase/supabase-js';

export const WEBSITE_CUSTOM_EXECUTION_TOOL_ID = 'website-custom-execution';

type UsageScope = { projectId: string; releaseId: string; operationId: string };
const planRank: Record<string, number> = { free: 0, pro: 1, business: 2 };

function usageWindowStart(period: unknown): string | null {
  const now = new Date();
  if (period === 'lifetime') return new Date(0).toISOString();
  if (period === 'daily') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  if (period === 'monthly') return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  return null;
}

/** Reserves a bounded monthly tool quota through the existing atomic meter.
 * Missing settings, disabled policy and database errors all fail closed. */
export async function reserveWebsiteCustomExecutionUsage(
  admin: SupabaseClient,
  userId: string,
  _scope: UsageScope,
): Promise<string | null> {
  try {
    const tool = WEBSITE_CUSTOM_EXECUTION_TOOL_ID;
    const [{ data: rule, error: ruleError }, { data: effectivePlan, error: planError }] = await Promise.all([
      admin.from('tool_access_rules').select('minimum_plan,enabled').eq('tool_id', tool).maybeSingle(),
      admin.rpc('team_effective_plan', { p_user_id: userId }),
    ]);
    if (ruleError || planError || !rule || rule.enabled !== true) return null;
    const plan = typeof effectivePlan === 'string' && planRank[effectivePlan] !== undefined ? effectivePlan : 'free';
    const minimumPlan = typeof rule.minimum_plan === 'string' && planRank[rule.minimum_plan] !== undefined ? rule.minimum_plan : 'business';
    if (planRank[plan] < planRank[minimumPlan]) return null;

    const { data: limits, error: limitsError } = await admin.from('tool_plan_limits')
      .select('period,free_limit,pro_limit,business_limit').eq('tool_id', tool).maybeSingle();
    if (limitsError || !limits) return null;
    const rawLimit = plan === 'business' ? limits.business_limit : plan === 'pro' ? limits.pro_limit : limits.free_limit;
    const limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 10_000) return null;
    const windowStart = usageWindowStart(limits.period);
    if (!windowStart) return null;

    const { data: reservationId, error: reservationError } = await admin.rpc('reserve_ai_tool_usage', {
      p_user_id: userId,
      p_tool: tool,
      p_limit: limit,
      p_window_start: windowStart,
    });
    if (reservationError || typeof reservationId !== 'string' || !reservationId) return null;
    return reservationId;
  } catch {
    return null;
  }
}

/** Finalizes a consumed sandbox invocation. The recorded usage is a bounded
 * execution count; customer code output never affects billing metadata. */
export async function completeWebsiteCustomExecutionUsage(
  admin: SupabaseClient,
  userId: string,
  reservationId: string,
  durationMs: number,
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return false;
  try {
    const { error } = await admin.rpc('complete_ai_tool_usage', {
      p_reservation_id: reservationId,
      p_user_id: userId,
      p_provider: 'vercel-sandbox',
      p_model: 'node22',
      p_tool: WEBSITE_CUSTOM_EXECUTION_TOOL_ID,
      p_tokens_in: 0,
      p_tokens_out: 0,
      p_duration_ms: Math.min(10_000, Math.max(0, Math.floor(durationMs))),
      p_status: 'success',
    });
    return !error;
  } catch {
    return false;
  }
}
