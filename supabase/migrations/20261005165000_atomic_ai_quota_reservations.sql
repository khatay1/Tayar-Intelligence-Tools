-- Reserve limited AI actions atomically before contacting a paid provider.
create table if not exists public.ai_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (length(tool) between 1 and 100),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now()
);

alter table public.ai_usage_reservations enable row level security;
revoke all on table public.ai_usage_reservations from anon, authenticated;

create index if not exists idx_ai_usage_reservations_active
  on public.ai_usage_reservations (user_id, tool, expires_at);

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
      where u.user_id = p_user_id and u.tool = v_tool and u.status = 'success'
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

create or replace function public.complete_ai_tool_usage(
  p_reservation_id uuid,
  p_user_id uuid,
  p_provider text,
  p_model text,
  p_tool text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_duration_ms integer,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool text := left(trim(coalesce(p_tool, '')), 100);
  v_reserved_tool text;
begin
  if p_status not in ('success', 'error') then raise exception 'Invalid usage status'; end if;

  select tool into v_reserved_tool
  from public.ai_usage_reservations
  where id = p_reservation_id and user_id = p_user_id
  for update;

  if v_reserved_tool is null or v_reserved_tool <> v_tool then
    raise exception 'AI usage reservation is unavailable';
  end if;

  insert into public.ai_usage(
    user_id, provider, model, tool, tokens_in, tokens_out, duration_ms, status, cost_usd
  ) values (
    p_user_id,
    left(coalesce(nullif(trim(p_provider), ''), 'internal'), 60),
    left(coalesce(nullif(trim(p_model), ''), 'none'), 100),
    v_tool,
    greatest(coalesce(p_tokens_in, 0), 0),
    greatest(coalesce(p_tokens_out, 0), 0),
    greatest(coalesce(p_duration_ms, 0), 0),
    p_status,
    0
  );

  delete from public.ai_usage_reservations where id = p_reservation_id;
end;
$$;

revoke all on function public.reserve_ai_tool_usage(uuid,text,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.complete_ai_tool_usage(uuid,uuid,text,text,text,integer,integer,integer,text) from public, anon, authenticated;
grant execute on function public.reserve_ai_tool_usage(uuid,text,integer,timestamptz) to service_role;
grant execute on function public.complete_ai_tool_usage(uuid,uuid,text,text,text,integer,integer,integer,text) to service_role;
