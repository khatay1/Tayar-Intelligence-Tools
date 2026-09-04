-- Keep admin tool controls and quota reporting on the same authoritative paths used by runtime access checks.

create or replace function public.admin_tool_usage_summary()
returns table(tool_id text, usage_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return query
  with ai_tools(tool_id) as (
    values
      ('ai-chat'::text),('cv-builder'),('cover-letter'),('ai-writer'),('translator'),
      ('document-ai'),('study-assistant'),('website-builder'),('code-assistant'),('background-remover')
  ), usage_sources as (
    select e.tool_id as source_tool_id, count(*)::bigint as source_count
    from public.tool_usage_events e
    where not exists (select 1 from ai_tools a where a.tool_id = e.tool_id)
    group by e.tool_id

    union all

    select u.tool as source_tool_id, count(*)::bigint as source_count
    from public.ai_usage u
    join ai_tools a on a.tool_id = u.tool
    where u.status = 'success'
    group by u.tool
  )
  select s.source_tool_id, sum(s.source_count)::bigint
  from usage_sources s
  group by s.source_tool_id
  order by s.source_tool_id;
end;
$$;

-- Legacy one-argument callers must use the same checked path as current clients.
-- In particular, AI tools remain metered only after successful provider requests.
create or replace function public.consume_tool_usage(p_tool_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.consume_tool_usage(p_tool_id, 'legacy_action');
end;
$$;

revoke all on function public.admin_tool_usage_summary() from public, anon;
grant execute on function public.admin_tool_usage_summary() to authenticated;

revoke all on function public.consume_tool_usage(text) from public, anon;
grant execute on function public.consume_tool_usage(text) to authenticated, service_role;
