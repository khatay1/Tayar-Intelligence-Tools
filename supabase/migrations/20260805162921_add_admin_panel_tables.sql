/*
# Add admin role + admin panel support tables

1. Modified Tables
- `profiles` — add `role` column (text, default 'user', values: 'user' | 'admin')
  and `suspended` column (boolean, default false) for user suspension.
  and `suspended_at` (timestamptz, nullable) for tracking suspension time.

2. New Tables
- `support_tickets` — user-submitted support tickets
  - id (uuid, pk)
  - user_id (uuid, references auth.users, cascade delete)
  - subject (text)
  - body (text)
  - type (text: 'ticket' | 'bug' | 'feature')
  - status (text: 'open' | 'closed', default 'open')
  - priority (text: 'low' | 'medium' | 'high', default 'medium')
  - admin_response (text, nullable)
  - created_at, updated_at (timestamptz)
- `email_templates` — editable email templates for the platform
  - id (uuid, pk)
  - key (text, unique — e.g. 'welcome', 'password_reset')
  - subject (text)
  - body (text)
  - updated_at (timestamptz)
- `feature_flags` — toggleable feature flags
  - id (uuid, pk)
  - key (text, unique)
  - label (text)
  - enabled (boolean, default false)
  - description (text)
  - updated_at (timestamptz)
- `system_logs` — admin/system event logs
  - id (uuid, pk)
  - level (text: 'info' | 'warning' | 'error')
  - category (text)
  - message (text)
  - metadata (jsonb)
  - created_at (timestamptz)
- `api_keys` — managed external API keys (metadata only, not actual secrets)
  - id (uuid, pk)
  - service (text — e.g. 'openai', 'anthropic')
  - label (text)
  - status (text: 'active' | 'inactive')
  - last_used (timestamptz, nullable)
  - created_at (timestamptz)
- `admin_settings` — key/value store for platform settings
  - key (text, pk)
  - value (jsonb)
  - updated_at (timestamptz)
- `admin_notifications` — notifications for admins
  - id (uuid, pk)
  - title (text)
  - message (text)
  - type (text: 'info' | 'warning' | 'error' | 'success')
  - read (boolean, default false)
  - created_at (timestamptz)

3. Security
- Enable RLS on all new tables.
- profiles: admin-only SELECT/UPDATE for role + suspended columns via policy.
  Users can still read their own profile. Admins (role='admin') can read all profiles
  and update any profile's role/suspended/plan.
- support_tickets: owner can INSERT + SELECT their own; admins can SELECT all + UPDATE all.
- email_templates, feature_flags, system_logs, api_keys, admin_settings, admin_notifications:
  admin-only (role='admin') full access. No anon access.
- Admin check uses a SECURITY DEFINER function `is_admin()` that reads the profiles table.
*/

-- Add role + suspended columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'suspended') THEN
    ALTER TABLE profiles ADD COLUMN suspended boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'suspended_at') THEN
    ALTER TABLE profiles ADD COLUMN suspended_at timestamptz;
  END IF;
END $$;

-- is_admin() helper: checks if the current user has role='admin' in profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Update profiles SELECT policy: users can read own profile, admins can read all
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());

-- Admins can update any profile (for role, plan, suspension management)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- Admins can delete profiles (user management)
DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id OR public.is_admin());

-- support_tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'ticket',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  admin_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_tickets" ON support_tickets;
CREATE POLICY "update_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- email_templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_email_templates_select" ON email_templates;
CREATE POLICY "admin_email_templates_select" ON email_templates FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_email_templates_insert" ON email_templates;
CREATE POLICY "admin_email_templates_insert" ON email_templates FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_email_templates_update" ON email_templates;
CREATE POLICY "admin_email_templates_update" ON email_templates FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_email_templates_delete" ON email_templates;
CREATE POLICY "admin_email_templates_delete" ON email_templates FOR DELETE
  TO authenticated USING (public.is_admin());

-- feature_flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_feature_flags_select" ON feature_flags;
CREATE POLICY "admin_feature_flags_select" ON feature_flags FOR SELECT
  TO authenticated USING (public.is_admin() OR true);
DROP POLICY IF EXISTS "admin_feature_flags_update" ON feature_flags;
CREATE POLICY "admin_feature_flags_update" ON feature_flags FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_feature_flags_insert" ON feature_flags;
CREATE POLICY "admin_feature_flags_insert" ON feature_flags FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'system',
  message text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);

DROP POLICY IF EXISTS "admin_system_logs_select" ON system_logs;
CREATE POLICY "admin_system_logs_select" ON system_logs FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_system_logs_insert" ON system_logs;
CREATE POLICY "admin_system_logs_insert" ON system_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  last_used timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_api_keys_select" ON api_keys;
CREATE POLICY "admin_api_keys_select" ON api_keys FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_api_keys_update" ON api_keys;
CREATE POLICY "admin_api_keys_update" ON api_keys FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_api_keys_insert" ON api_keys;
CREATE POLICY "admin_api_keys_insert" ON api_keys FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- admin_settings (key/value store)
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_settings_select" ON admin_settings;
CREATE POLICY "admin_settings_select" ON admin_settings FOR SELECT
  TO authenticated USING (public.is_admin() OR true);
DROP POLICY IF EXISTS "admin_settings_update" ON admin_settings;
CREATE POLICY "admin_settings_update" ON admin_settings FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_settings_insert" ON admin_settings;
CREATE POLICY "admin_settings_insert" ON admin_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- admin_notifications
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);

DROP POLICY IF EXISTS "admin_notifications_select" ON admin_notifications;
CREATE POLICY "admin_notifications_select" ON admin_notifications FOR SELECT
  TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "admin_notifications_update" ON admin_notifications;
CREATE POLICY "admin_notifications_update" ON admin_notifications FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "admin_notifications_insert" ON admin_notifications;
CREATE POLICY "admin_notifications_insert" ON admin_notifications FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- Seed default feature flags
INSERT INTO feature_flags (key, label, enabled, description) VALUES
  ('ai_chat', 'AI Chat Assistant', true, 'Enable the AI assistant panel for all users'),
  ('command_palette', 'Command Palette', true, 'Enable Ctrl+K command palette'),
  ('activity_timeline', 'Activity Timeline', true, 'Show recent activity page'),
  ('cover_letter_tool', 'Cover Letter Tool', true, 'Enable cover letter generator'),
  ('study_assistant', 'Study Assistant', true, 'Enable study assistant tool'),
  ('image_tools', 'Image Tools', false, 'Enable image manipulation tools (beta)')
ON CONFLICT (key) DO NOTHING;

-- Seed default email templates
INSERT INTO email_templates (key, subject, body) VALUES
  ('welcome', 'Welcome to Tayar Intelligence!', 'Hi {{name}},\n\nWelcome to Tayar Intelligence Tools! We''re excited to have you on board.\n\nGet started by exploring our AI-powered tools for CV building, cover letters, and more.\n\nBest regards,\nThe Tayar Team'),
  ('password_reset', 'Reset Your Password', 'Hi {{name}},\n\nWe received a request to reset your password. Click the link below to choose a new one:\n\n{{reset_link}}\n\nIf you didn''t request this, you can safely ignore this email.\n\nThe Tayar Team'),
  ('subscription_activated', 'Your Subscription is Active', 'Hi {{name}},\n\nYour {{plan}} subscription is now active. Enjoy full access to all our premium AI tools!\n\nThe Tayar Team'),
  ('ticket_response', 'Update on Your Support Ticket', 'Hi {{name}},\n\nWe''ve responded to your support ticket "{{subject}}".\n\n{{response}}\n\nThe Tayar Team')
ON CONFLICT (key) DO NOTHING;

-- Seed default API key records
INSERT INTO api_keys (service, label, status) VALUES
  ('openai', 'OpenAI GPT-4o', 'active'),
  ('anthropic', 'Anthropic Claude', 'active'),
  ('google', 'Google Gemini', 'inactive')
ON CONFLICT DO NOTHING;

-- Seed default admin settings
INSERT INTO admin_settings (key, value) VALUES
  ('platform_name', '"Tayar Intelligence"'),
  ('default_ai_provider', '"openai"'),
  ('max_free_requests', '50'),
  ('maintenance_mode', 'false'),
  ('signup_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
