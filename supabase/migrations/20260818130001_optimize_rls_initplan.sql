-- Optimize RLS policies: wrap auth.uid() in (select ...) to cache the value
-- This prevents re-evaluation per row and improves query performance at scale
-- Per Supabase docs: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING ((select auth.uid()) = id OR public.is_admin());
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING ((select auth.uid()) = id OR public.is_admin())
  WITH CHECK ((select auth.uid()) = id OR public.is_admin());
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING ((select auth.uid()) = id OR public.is_admin());

-- cvs
DROP POLICY IF EXISTS "select_own_cvs" ON cvs;
CREATE POLICY "select_own_cvs" ON cvs FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_cvs" ON cvs;
CREATE POLICY "insert_own_cvs" ON cvs FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_cvs" ON cvs;
CREATE POLICY "update_own_cvs" ON cvs FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_cvs" ON cvs;
CREATE POLICY "delete_own_cvs" ON cvs FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- projects
DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects" ON projects FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects" ON projects FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects" ON projects FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects" ON projects FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- workspace_files
DROP POLICY IF EXISTS "select_own_workspace_files" ON workspace_files;
CREATE POLICY "select_own_workspace_files" ON workspace_files FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_workspace_files" ON workspace_files;
CREATE POLICY "insert_own_workspace_files" ON workspace_files FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_workspace_files" ON workspace_files;
CREATE POLICY "update_own_workspace_files" ON workspace_files FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_workspace_files" ON workspace_files;
CREATE POLICY "delete_own_workspace_files" ON workspace_files FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- activity_log
DROP POLICY IF EXISTS "select_own_activity_log" ON activity_log;
CREATE POLICY "select_own_activity_log" ON activity_log FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_activity_log" ON activity_log;
CREATE POLICY "insert_own_activity_log" ON activity_log FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_activity_log" ON activity_log;
CREATE POLICY "delete_own_activity_log" ON activity_log FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- ai_conversations
DROP POLICY IF EXISTS "select_own_ai_conversations" ON ai_conversations;
CREATE POLICY "select_own_ai_conversations" ON ai_conversations FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_ai_conversations" ON ai_conversations;
CREATE POLICY "insert_own_ai_conversations" ON ai_conversations FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_ai_conversations" ON ai_conversations;
CREATE POLICY "update_own_ai_conversations" ON ai_conversations FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_ai_conversations" ON ai_conversations;
CREATE POLICY "delete_own_ai_conversations" ON ai_conversations FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- ai_messages
DROP POLICY IF EXISTS "select_own_ai_messages" ON ai_messages;
CREATE POLICY "select_own_ai_messages" ON ai_messages FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_ai_messages" ON ai_messages;
CREATE POLICY "insert_own_ai_messages" ON ai_messages FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_ai_messages" ON ai_messages;
CREATE POLICY "update_own_ai_messages" ON ai_messages FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_ai_messages" ON ai_messages;
CREATE POLICY "delete_own_ai_messages" ON ai_messages FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- ai_usage
DROP POLICY IF EXISTS "select_own_ai_usage" ON ai_usage;
CREATE POLICY "select_own_ai_usage" ON ai_usage FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_ai_usage" ON ai_usage;
CREATE POLICY "insert_own_ai_usage" ON ai_usage FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);

-- tool_preferences
DROP POLICY IF EXISTS "select_own_tool_preferences" ON tool_preferences;
CREATE POLICY "select_own_tool_preferences" ON tool_preferences FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_tool_preferences" ON tool_preferences;
CREATE POLICY "insert_own_tool_preferences" ON tool_preferences FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_tool_preferences" ON tool_preferences;
CREATE POLICY "update_own_tool_preferences" ON tool_preferences FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- subscriptions
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- user_onboarding
DROP POLICY IF EXISTS "select_own_onboarding" ON user_onboarding;
CREATE POLICY "select_own_onboarding" ON user_onboarding FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_onboarding" ON user_onboarding;
CREATE POLICY "insert_own_onboarding" ON user_onboarding FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_onboarding" ON user_onboarding;
CREATE POLICY "update_own_onboarding" ON user_onboarding FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- notifications
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- user_preferences
DROP POLICY IF EXISTS "select_own_user_preferences" ON user_preferences;
CREATE POLICY "select_own_user_preferences" ON user_preferences FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_user_preferences" ON user_preferences;
CREATE POLICY "insert_own_user_preferences" ON user_preferences FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_user_preferences" ON user_preferences;
CREATE POLICY "update_own_user_preferences" ON user_preferences FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- ai_settings
DROP POLICY IF EXISTS "select_own_ai_settings" ON ai_settings;
CREATE POLICY "select_own_ai_settings" ON ai_settings FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_ai_settings" ON ai_settings;
CREATE POLICY "insert_own_ai_settings" ON ai_settings FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_ai_settings" ON ai_settings;
CREATE POLICY "update_own_ai_settings" ON ai_settings FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- support_tickets
DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id OR public.is_admin());
DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_tickets" ON support_tickets;
CREATE POLICY "update_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id OR public.is_admin())
  WITH CHECK ((select auth.uid()) = user_id OR public.is_admin());

-- cv_versions
DROP POLICY IF EXISTS "select_own_cv_versions" ON cv_versions;
CREATE POLICY "select_own_cv_versions" ON cv_versions FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_cv_versions" ON cv_versions;
CREATE POLICY "insert_own_cv_versions" ON cv_versions FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_cv_versions" ON cv_versions;
CREATE POLICY "delete_own_cv_versions" ON cv_versions FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);

-- project_items
DROP POLICY IF EXISTS "select_own_project_items" ON project_items;
CREATE POLICY "select_own_project_items" ON project_items FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "insert_own_project_items" ON project_items;
CREATE POLICY "insert_own_project_items" ON project_items FOR INSERT
  TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "update_own_project_items" ON project_items;
CREATE POLICY "update_own_project_items" ON project_items FOR UPDATE
  TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "delete_own_project_items" ON project_items;
CREATE POLICY "delete_own_project_items" ON project_items FOR DELETE
  TO authenticated USING ((select auth.uid()) = user_id);
