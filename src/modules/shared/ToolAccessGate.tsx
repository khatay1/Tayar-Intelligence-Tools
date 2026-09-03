import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Loader2, LockKeyhole, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLocalizer } from '@/lib/ui-localization';

type ToolPlan = 'free' | 'pro' | 'business';

type ToolAccessState = {
  tool_id: string;
  enabled: boolean;
  required_plan: ToolPlan;
  effective_plan: ToolPlan;
  allowed: boolean;
};

interface ToolAccessGateProps {
  toolId: string;
  fallbackPlan: ToolPlan;
  children: ReactNode;
}

function planRank(plan: ToolPlan) {
  return plan === 'business' ? 2 : plan === 'pro' ? 1 : 0;
}

export default function ToolAccessGate({ toolId, fallbackPlan, children }: ToolAccessGateProps) {
  const l = useLocalizer();
  const [state, setState] = useState<ToolAccessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void supabase
      .rpc('tool_access_state', { p_tool_id: toolId })
      .then(({ data, error: accessError }) => {
        if (!active) return;
        if (accessError) {
          console.error(`[ToolAccessGate] Could not verify access for ${toolId}:`, accessError);
          setError(accessError.message || 'Could not verify tool access.');
          setState(null);
        } else {
          const raw = (data || {}) as Partial<ToolAccessState>;
          const required = raw.required_plan === 'business' || raw.required_plan === 'pro' || raw.required_plan === 'free'
            ? raw.required_plan
            : fallbackPlan;
          const effective = raw.effective_plan === 'business' || raw.effective_plan === 'pro' || raw.effective_plan === 'free'
            ? raw.effective_plan
            : 'free';
          setState({
            tool_id: toolId,
            enabled: raw.enabled !== false,
            required_plan: required,
            effective_plan: effective,
            allowed: typeof raw.allowed === 'boolean'
              ? raw.allowed
              : raw.enabled !== false && planRank(effective) >= planRank(required),
          });
        }
        setLoading(false);
      });

    return () => { active = false; };
  }, [toolId, fallbackPlan]);

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          {l('Checking access...')}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[45vh] max-w-xl items-center justify-center p-4 sm:p-6">
        <div className="w-full rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-5 text-center sm:p-7">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <h2 className="text-lg font-bold text-white">{l('Access check unavailable')}</h2>
          <p className="mt-2 break-words text-sm leading-6 text-gray-400">{l('We could not safely verify your plan. Please retry in a moment.')}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
            {l('Retry')}
          </button>
        </div>
      </div>
    );
  }

  if (state && !state.enabled) {
    return (
      <div className="mx-auto flex min-h-[45vh] max-w-xl items-center justify-center p-4 sm:p-6">
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center sm:p-7">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-gray-500" />
          <h2 className="text-lg font-bold text-white">{l('Tool temporarily unavailable')}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">{l('This tool has been disabled by the administrator.')}</p>
        </div>
      </div>
    );
  }

  if (state && !state.allowed) {
    const requiredLabel = state.required_plan === 'business' ? 'Business' : 'Pro';
    return (
      <div className="mx-auto flex min-h-[45vh] max-w-xl items-center justify-center p-4 sm:p-6">
        <div className="relative w-full overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0d0d20] p-5 text-center sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
              {state.required_plan === 'business' ? <Crown className="h-6 w-6 text-cyan-300" /> : <LockKeyhole className="h-6 w-6 text-violet-300" />}
            </div>
            <h2 className="text-xl font-black text-white">{l(`${requiredLabel} plan required`)}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">
              {l(`This tool requires the ${requiredLabel} plan or higher. Your current effective plan is ${state.effective_plan}.`)}
            </p>
            <button
              type="button"
              onClick={() => { window.location.hash = '#workspace/subscription'; }}
              className="mt-5 min-h-11 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-500 sm:w-auto sm:min-w-44"
            >
              {l('View plans')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
