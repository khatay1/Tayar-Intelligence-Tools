create or replace function public.submit_website_lead(
  p_project_id uuid,
  p_name text,
  p_email text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_lead_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_message text := btrim(coalesce(p_message, ''));
  v_total integer;
  v_limit integer;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 120 then
    raise exception 'Invalid name';
  end if;

  if char_length(v_email) < 3 or char_length(v_email) > 200
     or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,63}$' then
    raise exception 'Invalid email';
  end if;

  if char_length(v_message) < 1 or char_length(v_message) > 4000 then
    raise exception 'Invalid message';
  end if;

  select projects.user_id
    into v_user_id
  from public.projects
  where projects.id = p_project_id
    and projects.type = 'website-builder';

  if v_user_id is null then
    raise exception 'Website project not found';
  end if;

  perform public.enforce_website_public_rate_limit(
    p_project_id,
    'lead-legacy',
    8,
    900,
    v_email
  );

  v_limit := public.website_public_ingestion_limit(p_project_id, 'leads');
  select count(*) into v_total
  from public.website_leads
  where project_id = p_project_id;

  if v_total >= v_limit then
    raise exception 'Lead storage limit reached';
  end if;

  insert into public.website_leads (project_id, user_id, name, email, message)
  values (p_project_id, v_user_id, v_name, v_email, v_message)
  returning id into v_lead_id;

  return v_lead_id;
end;
$function$;

revoke execute on function public.submit_website_lead(uuid, text, text, text) from public;
grant execute on function public.submit_website_lead(uuid, text, text, text) to anon, authenticated, service_role;
