-- Fix remaining DELETE policies using raw auth.uid()

DROP POLICY IF EXISTS "delete_own_tool_preferences" ON tool_preferences;
CREATE POLICY "delete_own_tool_preferences" ON tool_preferences FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own_user_preferences" ON user_preferences;
CREATE POLICY "delete_own_user_preferences" ON user_preferences FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own_ai_settings" ON ai_settings;
CREATE POLICY "delete_own_ai_settings" ON ai_settings FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "delete_own_onboarding" ON user_onboarding;
CREATE POLICY "delete_own_onboarding" ON user_onboarding FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);
