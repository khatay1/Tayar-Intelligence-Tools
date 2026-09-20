revoke insert, update, delete, truncate, references, trigger
on table public.website_custom_domains from authenticated;

grant select on table public.website_custom_domains to authenticated;
