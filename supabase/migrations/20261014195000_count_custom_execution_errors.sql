-- A sandbox attempt consumes one custom-execution allowance even when the
-- customer program fails. Keep generic provider/tool error accounting intact.
create or replace function public.reserve_ai_tool_usage(
  p_user_id uuid,
  p_tool text,
  p_limit integer,
  p_window_start timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool text := left(trim(coalesce(p_tool, '')), 100);
  v_used integer;
  v_reservation_id uuid;
begin
  if p_user_id is null then raise exception 'User id is required'; end if;
  if v_tool = '' then raise exception 'Tool id is required'; end if;
  if p_limit is null or p_limit <= 0 then raise exception 'Usage limit reached for this tool'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || v_tool, 0));
  delete from public.ai_usage_reservations
    where user_id = p_user_id and tool = v_tool and expires_at <= now();

  select
    (select count(*) from public.ai_usage u
      where u.user_id = p_user_id and u.tool = v_tool
        and (u.status = 'success' or (v_tool = 'website-custom-execution' and u.status = 'error'))
        and (p_window_start is null or u.created_at >= p_window_start))
    +
    (select count(*) from public.ai_usage_reservations r
      where r.user_id = p_user_id and r.tool = v_tool and r.expires_at > now()
        and (p_window_start is null or r.created_at >= p_window_start))
  into v_used;

  if v_used >= p_limit then raise exception 'Usage limit reached for this tool'; end if;

  insert into public.ai_usage_reservations(user_id, tool)
  values (p_user_id, v_tool)
  returning id into v_reservation_id;
  return v_reservation_id;
end;
$$;
