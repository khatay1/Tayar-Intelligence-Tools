-- Make submitted support ticket content immutable for owners.
-- Owners may not rewrite the original subject/body/type after submission.
CREATE OR REPLACE FUNCTION public.protect_support_ticket_owner_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    IF NEW.subject IS DISTINCT FROM OLD.subject
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Submitted support ticket content cannot be changed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_support_ticket_owner_content ON public.support_tickets;
CREATE TRIGGER trg_protect_support_ticket_owner_content
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.protect_support_ticket_owner_content();

-- Admin-only RPC gives the UI a safe block-list view with actor email.
CREATE OR REPLACE FUNCTION public.admin_list_account_blocks()
RETURNS TABLE (
  email text,
  reason text,
  blocked_by uuid,
  blocked_by_email text,
  blocked_at timestamptz,
  expires_at timestamptz,
  source_user_id uuid,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  RETURN QUERY
  SELECT
    b.email::text,
    b.reason,
    b.blocked_by,
    coalesce(u.email, '')::text,
    b.blocked_at,
    b.expires_at,
    b.source_user_id,
    (b.expires_at IS NULL OR b.expires_at > now()) AS active
  FROM public.account_blocks b
  LEFT JOIN auth.users u ON u.id = b.blocked_by
  ORDER BY
    CASE WHEN b.expires_at IS NULL OR b.expires_at > now() THEN 0 ELSE 1 END,
    b.blocked_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_account_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_account_blocks() TO authenticated;
