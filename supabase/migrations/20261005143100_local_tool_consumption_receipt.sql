-- Preserve the final permitted result after atomically consuming its use.
create or replace function public.consume_tool_usage(p_tool_id text, p_action text default 'action'::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_tool_id text := trim(coalesce(p_tool_id, ''));
  v_state jsonb;
  v_action text := left(trim(coalesce(p_action, 'action')),100);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_tool_id = '' then raise exception 'Tool id is required'; end if;

  if v_tool_id in ('ai-chat','cv-builder','cover-letter','ai-writer','translator','document-ai','study-assistant','website-builder','code-assistant') then
    raise exception 'AI tools are metered by successful AI requests';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_tool_id,0));
  v_state := public.tool_access_state(v_tool_id);
  if coalesce((v_state->>'allowed')::boolean,false) is not true then
    if v_state->>'reason'='limit_reached' then raise exception 'Usage limit reached for this tool'; end if;
    raise exception 'Tool action is not allowed';
  end if;

  insert into public.tool_usage_events(user_id,tool_id,action)
  values(v_user_id,v_tool_id,nullif(v_action,''));
  -- This is a receipt for the accepted action, not permission for the next one.
  -- A fresh tool_access_state call still reports an exhausted quota.
  return public.tool_access_state(v_tool_id) || jsonb_build_object('allowed',true,'reason','consumed');
end;
$function$;

