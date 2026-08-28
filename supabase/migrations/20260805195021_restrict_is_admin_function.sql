-- Restrict is_admin() SECURITY DEFINER function to authenticated role only
-- The advisor flagged that anon can execute this function, which could leak
-- whether a user is an admin. Revoke EXECUTE from anon and public, grant only to authenticated.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
