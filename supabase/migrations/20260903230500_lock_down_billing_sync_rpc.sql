REVOKE ALL ON FUNCTION public.sync_billing_subscription(uuid, text, text, text, text, text, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_billing_subscription(uuid, text, text, text, text, text, timestamptz, boolean) TO service_role;
