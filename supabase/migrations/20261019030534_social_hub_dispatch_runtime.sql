-- Service-only scheduler discovery. This does not claim or expose message bodies;
-- the existing per-job claim remains the only dispatch fence.
create function private.list_due_social_hub_outgoing(p_limit integer default 3)
returns jsonb language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'job_id', due.id,
    'scope_id', due.scope_id,
    'connection_id', due.connection_id
  ) order by due.available_at, due.id), '[]'::jsonb)
  from (
    select o.id, o.scope_id, o.connection_id, o.available_at
    from private.social_hub_outbox o
    join private.social_hub_scopes s on s.id=o.scope_id
    join private.social_hub_connections c on c.id=o.connection_id and c.scope_id=o.scope_id
    where o.status='queued' and o.available_at<=now() and o.attempt_count<5
      and s.enabled and c.status='connected' and c.permissions_verified and c.webhook_verified
      and (c.expires_at is null or c.expires_at>now())
    order by o.available_at, o.id
    limit greatest(1, least(coalesce(p_limit, 3), 3))
  ) due
$$;

revoke all on function private.list_due_social_hub_outgoing(integer) from public,anon,authenticated;
grant execute on function private.list_due_social_hub_outgoing(integer) to service_role;

create function public.list_due_social_hub_outgoing(p_limit integer default 3)
returns jsonb language sql security invoker set search_path='' as $$
  select private.list_due_social_hub_outgoing(p_limit)
$$;
revoke all on function public.list_due_social_hub_outgoing(integer) from public,anon,authenticated;
grant execute on function public.list_due_social_hub_outgoing(integer) to service_role;
