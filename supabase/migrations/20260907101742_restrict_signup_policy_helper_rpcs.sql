revoke execute on function public.is_email_blocked(text) from public, anon, authenticated;
revoke execute on function public.is_signup_enabled() from public, anon, authenticated;

grant execute on function public.is_email_blocked(text) to service_role, supabase_auth_admin;
grant execute on function public.is_signup_enabled() to service_role, supabase_auth_admin;
