-- Add missing indexes on foreign key columns for query performance
-- Advisor identified these unindexed FKs across multiple tables

CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_versions_cv_id ON cv_versions(cv_id);
CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_user_id ON project_items(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_parent_project_id ON projects(parent_project_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
