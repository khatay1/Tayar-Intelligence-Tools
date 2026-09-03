-- Tool usage is charged only for completed actions, never for opening/viewing a tool.
-- Older databases may not yet have the action column, so add it safely first.
alter table public.tool_usage_events add column if not exists action text;

create or replace function public.tool_access_state(p_tool_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if v_tool_id = '' then
    raise exception 'Tool id is required';
  end if;

  v_plan := public.team_effective_plan(v_user_id);

  select r.minimum_plan, r.enabled
  into v_required, v_enabled
  from public.tool_access_rules r
  where r.tool_id = v_tool_id;

  v_required := coalesce(v_required, 'free');
  v_enabled := coalesce(v_enabled, true);

  if not v_enabled then
    return jsonb_build_object(
      'tool_id', v_tool_id, 'enabled', false, 'required_plan', v_required,
      'effective_plan', v_plan, 'allowed', false, 'reason', 'disabled'
    );
  end if;

  if public.tool_plan_rank(v_plan) < public.tool_plan_rank(v_required) then
    return jsonb_build_object(
      'tool_id', v_tool_id, 'enabled', true, 'required_plan', v_required,
      'effective_plan', v_plan, 'allowed', false, 'reason', 'plan_required'
    );
  end if;

  select l.period,
         case v_plan when 'business' then l.business_limit when 'pro' then l.pro_limit else l.free_limit end
  into v_period, v_limit
  from public.tool_plan_limits l
  where l.tool_id = v_tool_id;

  v_period := coalesce(v_period, 'monthly');
  v_is_ai := v_tool_id in (
    'ai-chat','cv-builder','cover-letter','ai-writer','translator','document-ai',
    'study-assistant','website-builder','code-assistant','background-remover'
  );

  if v_limit is not null then
    v_window_start := public.tool_usage_window_start(v_period);
    if v_is_ai then
      select count(*) into v_count
      from public.ai_usage u
      where u.user_id = v_user_id
        and u.tool = v_tool_id
        and u.status = 'success'
        and (v_window_start is null or u.created_at >= v_window_start);
    else
      select count(*) into v_count
      from public.tool_usage_events e
      where e.user_id = v_user_id
        and e.tool_id = v_tool_id
        and (v_window_start is null or e.created_at >= v_window_start);
    end if;
  end if;

  return jsonb_build_object(
    'tool_id', v_tool_id,
    'enabled', true,
    'required_plan', v_required,
    'effective_plan', v_plan,
    'allowed', v_limit is null or v_count < v_limit,
    'reason', case when v_limit is not null and v_count >= v_limit then 'limit_reached' else 'allowed' end,
    'usage_count', v_count,
    'usage_limit', v_limit,
    'usage_remaining', case when v_limit is null then null else greatest(v_limit - v_count, 0) end,
    'period', v_period
  );
end;
$$;

create or replace function public.consume_tool_usage(p_tool_id text, p_action text default 'action')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tool_id text := trim(coalesce(p_tool_id, ''));
  v_state jsonb;
  v_action text := left(trim(coalesce(p_action, 'action')), 100);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_tool_id = '' then raise exception 'Tool id is required'; end if;

  if v_tool_id in (
    'ai-chat','cv-builder','cover-letter','ai-writer','translator','document-ai',
    'study-assistant','website-builder','code-assistant','background-remover'
  ) then
    raise exception 'AI tools are metered by successful AI requests';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_tool_id, 0));
  v_state := public.tool_access_state(v_tool_id);
  if coalesce((v_state->>'allowed')::boolean, false) is not true then
    if v_state->>'reason' = 'limit_reached' then
      raise exception 'Usage limit reached for this tool';
    end if;
    raise exception 'Tool action is not allowed';
  end if;

  insert into public.tool_usage_events(user_id, tool_id, action)
  values (v_user_id, v_tool_id, nullif(v_action, ''));

  return public.tool_access_state(v_tool_id);
end;
$$;

-- Browser clients may only write usage through the checked RPC.
revoke insert, update, delete on public.tool_usage_events from anon, authenticated;
grant select on public.tool_usage_events to authenticated;
revoke all on function public.consume_tool_usage(text,text) from public, anon;
grant execute on function public.consume_tool_usage(text,text) to authenticated;
revoke all on function public.tool_access_state(text) from public, anon;
grant execute on function public.tool_access_state(text) to authenticated;
