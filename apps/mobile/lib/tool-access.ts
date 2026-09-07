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

function accessError(state: ToolAccessState) {
  if (state.reason === 'plan_required') return `This tool requires the ${state.required_plan || 'required'} plan.`;
  if (state.reason === 'limit_reached') return 'Your usage limit for this tool has been reached.';
  if (state.reason === 'disabled') return 'This tool is currently disabled by Tayar Admin.';
  return 'This tool is not available for this account.';
}

export async function assertToolAccess(toolId: string) {
  const { data, error } = await supabase.rpc('tool_access_state', { p_tool_id: toolId });
  if (error) throw new Error(error.message || 'Could not verify tool access.');
  const state = (data || {}) as ToolAccessState;
  if (state.allowed !== true) throw new Error(accessError(state));
  return state;
}

export async function recordLocalToolUsage(toolId: string, action: string) {
  const { data, error } = await supabase.rpc('consume_tool_usage', { p_tool_id: toolId, p_action: action });
  if (error) throw new Error(error.message || 'Could not record tool usage.');
  return (data || {}) as ToolAccessState;
}
