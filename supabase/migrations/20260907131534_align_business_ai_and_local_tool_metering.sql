create or replace function public.tool_access_state(p_tool_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tool_id text := trim(coalesce(p_tool_id, ''));
  v_plan text;
  v_required text := 'free';
  v_enabled boolean := true;
  v_period text := 'monthly';
  v_limit bigint;
  v_count bigint := 0;
  v_window_start timestamptz;
  v_is_ai boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_tool_id = '' then raise exception 'Tool id is required'; end if;

  v_plan := public.team_effective_plan(v_user_id);

  select r.minimum_plan, r.enabled into v_required, v_enabled
  from public.tool_access_rules r where r.tool_id = v_tool_id;
  v_required := coalesce(v_required, 'free');
  v_enabled := coalesce(v_enabled, true);

  if not v_enabled then
    return jsonb_build_object('tool_id',v_tool_id,'enabled',false,'required_plan',v_required,'effective_plan',v_plan,'allowed',false,'reason','disabled');
  end if;

  if public.tool_plan_rank(v_plan) < public.tool_plan_rank(v_required) then
    return jsonb_build_object('tool_id',v_tool_id,'enabled',true,'required_plan',v_required,'effective_plan',v_plan,'allowed',false,'reason','plan_required');
  end if;

  select l.period,
         case v_plan when 'business' then l.business_limit when 'pro' then l.pro_limit else l.free_limit end
  into v_period, v_limit
  from public.tool_plan_limits l where l.tool_id = v_tool_id;

  v_period := coalesce(v_period, 'monthly');
  v_is_ai := v_tool_id in (
    'ai-chat','cv-builder','cover-letter','ai-writer','translator','document-ai',
    'study-assistant','website-builder','code-assistant',
    'email-writer','contract-writer','analytics-ai'
  );

  if v_limit is not null then
    v_window_start := public.tool_usage_window_start(v_period);
    if v_is_ai then
      select count(*) into v_count from public.ai_usage u
      where u.user_id=v_user_id and u.tool=v_tool_id and u.status='success'
        and (v_window_start is null or u.created_at >= v_window_start);
    else
      select count(*) into v_count from public.tool_usage_events e
      where e.user_id=v_user_id and e.tool_id=v_tool_id
        and (v_window_start is null or e.created_at >= v_window_start);
    end if;
  end if;

  return jsonb_build_object(
    'tool_id',v_tool_id,'enabled',true,'required_plan',v_required,'effective_plan',v_plan,
    'allowed',v_limit is null or v_count < v_limit,
    'reason',case when v_limit is not null and v_count >= v_limit then 'limit_reached' else 'allowed' end,
    'usage_count',v_count,'usage_limit',v_limit,
    'usage_remaining',case when v_limit is null then null else greatest(v_limit-v_count,0) end,
    'period',v_period
  );
end;
$function$;
