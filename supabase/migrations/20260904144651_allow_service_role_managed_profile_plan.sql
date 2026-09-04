-- Billing updates must be able to synchronize profiles.plan while normal users remain blocked.

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role billing/admin backends may synchronize managed fields.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  -- Admins can change everything.
  if public.is_admin() then
    return new;
  end if;

  -- Normal users cannot change privilege-related fields.
  if new.role is distinct from old.role then
    raise exception 'You cannot change your role';
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'You cannot change your plan';
  end if;

  if new.suspended is distinct from old.suspended then
    raise exception 'You cannot change suspension status';
  end if;

  if new.suspended_at is distinct from old.suspended_at then
    raise exception 'You cannot change suspension status';
  end if;

  return new;
end;
$$;
