/*
# Add remaining RLS policies to activity_log (insert + delete)

The select_own_activity_log and the workspace_files policies were applied in the previous migration.
*/

DROP POLICY IF EXISTS "insert_own_activity_log" ON activity_log;
CREATE POLICY "insert_own_activity_log" ON activity_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_activity_log" ON activity_log;
CREATE POLICY "delete_own_activity_log" ON activity_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
