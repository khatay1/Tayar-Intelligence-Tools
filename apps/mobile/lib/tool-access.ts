import { Platform } from 'react-native';
import { supabase } from './supabase';

export type ToolAccessState = {
  tool_id?: string;
  enabled?: boolean;
  allowed?: boolean;
  reason?: string;
  required_plan?: string;
  effective_plan?: string;
  usage_count?: number | null;
  usage_limit?: number | null;
  usage_remaining?: number | null;
  period?: string;
};

export const isIosFreeCompanion = Platform.OS === 'ios';
export const IOS_COMPANION_AI_LIMIT = 25;

const IOS_COMPANION_AI_TOOL_IDS = new Set([
  'ai-chat',
  'cv-builder',
  'cover-letter',
  'ai-writer',
  'translator',
  'document-ai',
  'study-assistant',
  'website-builder',
  'code-assistant',
  'email-writer',
  'contract-writer',
  'analytics-ai',
]);

function normalizedCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function normalizeIosCompanionState(state: ToolAccessState): ToolAccessState {
  if (!isIosFreeCompanion) return state;

  const requiredPlan = String(state.required_plan || 'free').toLowerCase();
  const enabled = state.enabled !== false;
  const toolId = String(state.tool_id || '');

  if (!enabled) {
    return { ...state, effective_plan: 'free', allowed: false, reason: 'disabled' };
  }

  // The first iOS release is intentionally a free stand-alone companion.
  // Existing web/Android Pro or Business entitlements must never unlock iOS
  // functionality, otherwise App Store IAP parity would be required.
  if (requiredPlan !== 'free') {
    return {
      ...state,
      effective_plan: 'free',
      allowed: false,
      reason: 'ios_companion_free',
      usage_limit: 0,
      usage_remaining: 0,
    };
  }

  // Local/on-device free tools are included without a paid-plan multiplier.
  // Server-backed AI tools use the same fixed free allowance for every iOS
  // account, regardless of the account's web or Android subscription.
  if (!IOS_COMPANION_AI_TOOL_IDS.has(toolId)) {
    return {
      ...state,
      effective_plan: 'free',
      allowed: true,
      reason: 'allowed',
      usage_limit: null,
      usage_remaining: null,
    };
  }

  const usageCount = normalizedCount(state.usage_count);
  const remaining = Math.max(IOS_COMPANION_AI_LIMIT - usageCount, 0);
  const allowed = remaining > 0;
  return {
    ...state,
    effective_plan: 'free',
    allowed,
    reason: allowed ? 'allowed' : 'limit_reached',
    usage_count: usageCount,
    usage_limit: IOS_COMPANION_AI_LIMIT,
    usage_remaining: remaining,
    period: 'monthly',
  };
}

function accessError(state: ToolAccessState) {
  if (state.reason === 'ios_companion_free') return 'This iOS release includes free companion tools only.';
  if (state.reason === 'plan_required') return `This tool requires the ${state.required_plan || 'required'} plan.`;
  if (state.reason === 'limit_reached') return 'Your usage limit for this tool has been reached.';
  if (state.reason === 'disabled') return 'This tool is currently disabled by Tayar Admin.';
  return 'This tool is not available for this account.';
}

export async function getToolAccessState(toolId: string) {
  const { data, error } = await supabase.rpc('tool_access_state', { p_tool_id: toolId });
  if (error) throw new Error(error.message || 'Could not verify tool access.');
  return normalizeIosCompanionState((data || {}) as ToolAccessState);
}

export async function assertToolAccess(toolId: string) {
  const state = await getToolAccessState(toolId);
  if (state.allowed !== true) throw new Error(accessError(state));
  return state;
}

export async function recordLocalToolUsage(toolId: string, action: string) {
  // iOS companion local tools are included for every account and therefore do
  // not consume the web/Android plan-metered quota. AI usage is recorded by
  // ai-engine after a successful provider response and is capped above.
  if (isIosFreeCompanion) return assertToolAccess(toolId);

  const { data, error } = await supabase.rpc('consume_tool_usage', { p_tool_id: toolId, p_action: action });
  if (error) throw new Error(error.message || 'Could not record tool usage.');
  return (data || {}) as ToolAccessState;
}
