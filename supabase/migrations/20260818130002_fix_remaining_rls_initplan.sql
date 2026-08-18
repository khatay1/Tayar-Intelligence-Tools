-- Fix remaining RLS policies that still use raw auth.uid() instead of (select auth.uid())

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "delete_own_ai_usage" ON ai_usage;
CREATE POLICY "delete_own_ai_usage" ON ai_usage FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);
