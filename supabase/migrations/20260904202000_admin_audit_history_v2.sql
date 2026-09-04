-- Admin V2 audit history using the existing append-only system_logs table.
-- Captures future admin setting, tool access, and tool quota changes at the database layer.

create index if not exists idx_system_logs_admin_audit_created
  on public.system_logs (created_at desc)
  where category = 'admin_audit';

create or replace function public.audit_admin_control_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_before jsonb;
  v_after jsonb;
  v_target text;
  v_key text;
  v_claims jsonb := '{}'::jsonb;
  v_actor_user_id text;
  v_actor_email text;
  v_actor_role text;
  v_before_chars integer;
  v_after_chars integer;
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new);
  end if;

  begin
    v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  exception when others then
    v_claims := '{}'::jsonb;
  end;

  v_actor_user_id := coalesce(
    nullif(v_claims ->> 'sub', ''),
    nullif(v_new ->> 'updated_by', ''),
    nullif(v_old ->> 'updated_by', '')
  );
  v_actor_email := nullif(v_claims ->> 'email', '');
  v_actor_role := coalesce(nullif(v_claims ->> 'role', ''), 'database');

  if tg_table_name = 'admin_settings' then
    v_key := coalesce(v_new ->> 'key', v_old ->> 'key');
    v_target := v_key;

    if tg_op = 'UPDATE' and (v_old -> 'value') is not distinct from (v_new -> 'value') then
      return new;
    end if;

    if v_key ~* '(secret|token|password|credential|api[_-]?key)' then
      if v_old is not null then v_before := to_jsonb('[redacted]'::text); end if;
      if v_new is not null then v_after := to_jsonb('[redacted]'::text); end if;
    else
      if v_old is not null then v_before := v_old -> 'value'; end if;
      if v_new is not null then v_after := v_new -> 'value'; end if;
    end if;
  else
    v_target := coalesce(v_new ->> 'tool_id', v_old ->> 'tool_id');
    if v_old is not null then v_before := v_old - 'updated_at' - 'updated_by'; end if;
    if v_new is not null then v_after := v_new - 'updated_at' - 'updated_by'; end if;

    if tg_op = 'UPDATE' and v_before is not distinct from v_after then
      return new;
    end if;
  end if;

  v_before_chars := length(coalesce(v_before::text, ''));
  v_after_chars := length(coalesce(v_after::text, ''));

  if v_before_chars > 4000 then
    v_before := jsonb_build_object('_truncated', true, 'chars', v_before_chars);
  end if;
  if v_after_chars > 4000 then
    v_after := jsonb_build_object('_truncated', true, 'chars', v_after_chars);
  end if;

  insert into public.system_logs (level, category, message, metadata)
  values (
    'info',
    'admin_audit',
    format('%s %s: %s', replace(tg_table_name, '_', ' '), lower(tg_op), coalesce(v_target, 'unknown')),
    jsonb_strip_nulls(jsonb_build_object(
      'action', lower(tg_op),
      'surface', tg_table_name,
      'target', v_target,
      'actor_user_id', v_actor_user_id,
      'actor_email', v_actor_email,
      'actor_role', v_actor_role,
      'before', v_before,
      'after', v_after
    ))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_admin_control_change() from public, anon, authenticated;

-- Recreate explicitly so the migration is safe if replayed on a recovered environment.
drop trigger if exists admin_audit_admin_settings on public.admin_settings;
create trigger admin_audit_admin_settings
after insert or update or delete on public.admin_settings
for each row execute function public.audit_admin_control_change();

drop trigger if exists admin_audit_tool_access_rules on public.tool_access_rules;
create trigger admin_audit_tool_access_rules
after insert or update or delete on public.tool_access_rules
for each row execute function public.audit_admin_control_change();

drop trigger if exists admin_audit_tool_plan_limits on public.tool_plan_limits;
create trigger admin_audit_tool_plan_limits
after insert or update or delete on public.tool_plan_limits
for each row execute function public.audit_admin_control_change();
