create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  label text not null,
  adapter text not null check (adapter in ('gemini','openai_compatible','anthropic')),
  base_url text not null,
  default_model text not null,
  enabled boolean not null default true,
  is_default boolean not null default false,
  secret_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_provider_configs_one_default_idx
  on public.ai_provider_configs ((is_default))
  where is_default = true;

alter table public.ai_provider_configs enable row level security;
revoke all on public.ai_provider_configs from anon, authenticated;
grant all on public.ai_provider_configs to service_role;

create or replace function public.ai_admin_list_providers()
returns table (
  id uuid,
  provider_key text,
  label text,
  adapter text,
  base_url text,
  default_model text,
  enabled boolean,
  is_default boolean,
  secret_configured boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, vault
as $$
  select
    c.id,
    c.provider_key,
    c.label,
    c.adapter,
    c.base_url,
    c.default_model,
    c.enabled,
    c.is_default,
    c.secret_id is not null as secret_configured,
    c.created_at,
    c.updated_at
  from public.ai_provider_configs c
  order by c.is_default desc, c.label asc;
$$;

revoke all on function public.ai_admin_list_providers() from public, anon, authenticated;
grant execute on function public.ai_admin_list_providers() to service_role;

create or replace function public.ai_admin_upsert_provider(
  p_provider_key text,
  p_label text,
  p_adapter text,
  p_base_url text,
  p_default_model text,
  p_api_secret text default null,
  p_enabled boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
  v_secret_id uuid;
  v_existing_secret_id uuid;
  v_key text := lower(trim(p_provider_key));
  v_secret_name text;
begin
  if v_key !~ '^[a-z0-9][a-z0-9_-]{1,49}$' then
    raise exception 'Invalid provider key';
  end if;
  if nullif(trim(p_label), '') is null then raise exception 'Provider label is required'; end if;
  if p_adapter not in ('gemini','openai_compatible','anthropic') then raise exception 'Unsupported provider adapter'; end if;
  if p_base_url !~ '^https://[^[:space:]]+$' then raise exception 'Base URL must use HTTPS'; end if;
  if nullif(trim(p_default_model), '') is null then raise exception 'Default model is required'; end if;

  select id, secret_id into v_id, v_existing_secret_id
  from public.ai_provider_configs where provider_key = v_key;

  if v_id is null then
    v_id := gen_random_uuid();
  end if;

  v_secret_name := 'tayar_ai_provider_' || v_id::text;
  if nullif(trim(coalesce(p_api_secret, '')), '') is not null then
    if v_existing_secret_id is null then
      v_secret_id := vault.create_secret(p_api_secret, v_secret_name, 'Tayar AI provider API secret', null);
    else
      perform vault.update_secret(v_existing_secret_id, p_api_secret, v_secret_name, 'Tayar AI provider API secret', null);
      v_secret_id := v_existing_secret_id;
    end if;
  else
    v_secret_id := v_existing_secret_id;
  end if;

  insert into public.ai_provider_configs (
    id, provider_key, label, adapter, base_url, default_model, enabled, secret_id, updated_at
  ) values (
    v_id, v_key, trim(p_label), p_adapter, rtrim(trim(p_base_url), '/'), trim(p_default_model), p_enabled, v_secret_id, now()
  )
  on conflict (provider_key) do update set
    label = excluded.label,
    adapter = excluded.adapter,
    base_url = excluded.base_url,
    default_model = excluded.default_model,
    enabled = excluded.enabled,
    secret_id = coalesce(excluded.secret_id, public.ai_provider_configs.secret_id),
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.ai_admin_upsert_provider(text,text,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.ai_admin_upsert_provider(text,text,text,text,text,text,boolean) to service_role;

create or replace function public.ai_admin_set_default_provider(p_provider_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ai_provider_configs
    where provider_key = lower(trim(p_provider_key)) and enabled = true
  ) then
    raise exception 'Provider does not exist or is disabled';
  end if;
  update public.ai_provider_configs set is_default = false, updated_at = now() where is_default = true;
  update public.ai_provider_configs
  set is_default = true, updated_at = now()
  where provider_key = lower(trim(p_provider_key));
end;
$$;

revoke all on function public.ai_admin_set_default_provider(text) from public, anon, authenticated;
grant execute on function public.ai_admin_set_default_provider(text) to service_role;

create or replace function public.ai_admin_set_provider_enabled(p_provider_key text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_enabled = false and exists (
    select 1 from public.ai_provider_configs
    where provider_key = lower(trim(p_provider_key)) and is_default = true
  ) then
    raise exception 'Choose another default provider before disabling this one';
  end if;
  update public.ai_provider_configs
  set enabled = p_enabled, updated_at = now()
  where provider_key = lower(trim(p_provider_key));
  if not found then raise exception 'Provider not found'; end if;
end;
$$;

revoke all on function public.ai_admin_set_provider_enabled(text,boolean) from public, anon, authenticated;
grant execute on function public.ai_admin_set_provider_enabled(text,boolean) to service_role;

create or replace function public.ai_provider_runtime(p_provider_key text default null)
returns table (
  provider_key text,
  label text,
  adapter text,
  base_url text,
  default_model text,
  api_secret text
)
language sql
security definer
set search_path = public, vault
as $$
  select
    c.provider_key,
    c.label,
    c.adapter,
    c.base_url,
    c.default_model,
    ds.decrypted_secret as api_secret
  from public.ai_provider_configs c
  left join vault.decrypted_secrets ds on ds.id = c.secret_id
  where c.enabled = true
    and (
      (p_provider_key is not null and c.provider_key = lower(trim(p_provider_key)))
      or (p_provider_key is null and c.is_default = true)
    )
  order by c.is_default desc
  limit 1;
$$;

revoke all on function public.ai_provider_runtime(text) from public, anon, authenticated;
grant execute on function public.ai_provider_runtime(text) to service_role;
