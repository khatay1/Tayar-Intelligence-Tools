CREATE TABLE IF NOT EXISTS public.tool_access_rules (
  tool_id text PRIMARY KEY,
  minimum_plan text NOT NULL DEFAULT 'free' CHECK (minimum_plan IN ('free', 'pro', 'business')),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.tool_access_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tool_access_rules FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tool_access_rules TO authenticated;
GRANT ALL ON TABLE public.tool_access_rules TO service_role;

DROP POLICY IF EXISTS tool_access_rules_select ON public.tool_access_rules;
CREATE POLICY tool_access_rules_select
ON public.tool_access_rules
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS tool_access_rules_admin_insert ON public.tool_access_rules;
CREATE POLICY tool_access_rules_admin_insert
ON public.tool_access_rules
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS tool_access_rules_admin_update ON public.tool_access_rules;
CREATE POLICY tool_access_rules_admin_update
ON public.tool_access_rules
FOR UPDATE
TO authenticated
USING ((SELECT public.is_admin()))
WITH CHECK ((SELECT public.is_admin()));

CREATE OR REPLACE FUNCTION public.current_effective_plan()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'free'
    ELSE public.team_effective_plan(auth.uid())
  END;
$$;

REVOKE ALL ON FUNCTION public.current_effective_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_effective_plan() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_use_tool(p_tool_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_plan text := public.current_effective_plan();
  v_required text := 'free';
  v_enabled boolean := true;
BEGIN
  SELECT r.minimum_plan, r.enabled
  INTO v_required, v_enabled
  FROM public.tool_access_rules r
  WHERE r.tool_id = trim(coalesce(p_tool_id, ''));

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF NOT v_enabled THEN
    RETURN false;
  END IF;

  RETURN CASE v_required
    WHEN 'free' THEN true
    WHEN 'pro' THEN v_plan IN ('pro', 'business')
    WHEN 'business' THEN v_plan = 'business'
    ELSE false
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.can_use_tool(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_tool(text) TO authenticated, service_role;

INSERT INTO public.tool_access_rules(tool_id, minimum_plan, enabled)
VALUES
  ('document-ai', 'pro', true),
  ('code-assistant', 'pro', true),
  ('team-workspace', 'business', true)
ON CONFLICT (tool_id) DO NOTHING;