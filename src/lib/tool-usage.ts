import { supabase } from '@/lib/supabase';

export interface ToolUsageState {
  tool_id?: string;
  enabled?: boolean;
  required_plan?: 'free' | 'pro' | 'business';
  effective_plan?: 'free' | 'pro' | 'business';
  allowed?: boolean;
  usage_count?: number;
  usage_limit?: number | null;
  usage_remaining?: number | null;
  period?: 'daily' | 'monthly' | 'lifetime';
  reason?: string;
}

function usageErrorMessage(state?: ToolUsageState | null) {
  if (state?.reason === 'limit_reached') {
    const period = state.period || 'current period';
    return `Usage limit reached for this tool (${period}). Upgrade your plan or wait for the limit to reset.`;
  }
  if (state?.reason === 'plan_required') return 'Your current plan does not include this tool.';
  if (state?.reason === 'disabled') return 'This tool is temporarily unavailable.';
  return 'This action is not available with your current tool limits.';
}

/**
 * Checks whether a real tool action may run. This never consumes usage.
 * Opening or viewing a tool therefore never counts as usage.
 */
export async function assertToolActionAvailable(toolId: string): Promise<ToolUsageState> {
  const { data, error } = await supabase.rpc('tool_access_state', { p_tool_id: toolId });
  if (error) throw new Error(error.message || 'Could not verify tool usage limits.');
  const state = (data || {}) as ToolUsageState;
  if (state.allowed === false) throw new Error(usageErrorMessage(state));
  return state;
}

/**
 * Records one completed non-AI action. AI actions are metered by ai_usage on the server.
 */
export async function consumeToolAction(toolId: string, action: string): Promise<ToolUsageState> {
  const { data, error } = await supabase.rpc('consume_tool_usage', {
    p_tool_id: toolId,
    p_action: action,
  });
  if (error) throw new Error(error.message || 'Could not record tool usage.');
  const state = (data || {}) as ToolUsageState;
  if (state.allowed === false) throw new Error(usageErrorMessage(state));
  return state;
}

/**
 * Run local/browser work first, then atomically record the completed action before exposing the result.
 * Failed local processing does not consume a use.
 */
export async function completeMeteredLocalAction<T>(
  toolId: string,
  action: string,
  work: () => Promise<T> | T,
): Promise<T> {
  await assertToolActionAvailable(toolId);
  const result = await work();
  await consumeToolAction(toolId, action);
  return result;
}
