import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

check('Canonical README exists', exists('README.md'));
check('Git line-ending policy exists', exists('.gitattributes'));
check('Editor configuration exists', exists('.editorconfig'));
check('Canonical baseline notes exist', exists('docs/CANONICAL_BASELINE.md'));
check('Website Builder module exists', exists('src/modules/website-builder/WebsiteBuilderTool.tsx'));
check('Team Workspace module exists', exists('src/modules/team-workspace/TeamWorkspaceTool.tsx'));
check('Billing migration exists', exists('supabase/migrations/20260828154000_add_secure_billing_entitlements.sql'));
check('Team workspace migration exists', exists('supabase/migrations/20260828155500_add_team_workspaces.sql'));
check('Quality/security migration exists', exists('supabase/migrations/20260828161000_quality_security_hardening.sql'));
check('AI security migration exists', exists('supabase/migrations/20260829110000_ai_engine_security_hardening.sql'));
check('Admin hardening migration exists', exists('supabase/migrations/20260829144000_harden_admin_role_and_admin_access.sql'));
check('Admin full-access override migration exists', exists('supabase/migrations/20260829223500_admin_full_access_override.sql'));
check('Admin complimentary-access migration exists', exists('supabase/migrations/20260829225000_admin_access_overrides.sql'));
check('Account re-registration block migration exists', exists('supabase/migrations/20260829231500_account_block_re_registration.sql'));
check('Block-list/support immutability migration exists', exists('supabase/migrations/20260829233000_admin_block_list_and_support_immutability.sql'));
check('Subscription grace-period migration exists', exists('supabase/migrations/20260829234500_subscription_grace_period.sql'));
check('Signup policy migration exists', exists('supabase/migrations/20260829235500_enforce_signup_policy.sql'));
check('Supabase CLI config exists', exists('supabase/config.toml'));
check('Guarded admin deploy script exists', exists('scripts/admin-hardening-deploy.ps1'));
check('Admin deployment runbook exists', exists('docs/ADMIN_HARDENING_DEPLOYMENT.md'));

for (const rel of [
  '.bolt',
  'db-data.sql',
  'public/icon-512.webp',
  'scripts/upgrade-website-builder-ai.ps1',
  'src/components/Dashboard.tsx',
  'src/components/ui/GlassCard.tsx',
  'src/components/workspace/GlobalSearch.tsx',
  'src/components/workspace/AISettings.tsx',
  'src/lib/ai/image-service.ts',
  'src/lib/errors.ts',
]) check(`Legacy/junk path removed: ${rel}`, !exists(rel));

const auth = read('src/context/AuthContext.tsx');
const onboarding = read('src/context/OnboardingContext.tsx');
const aiEngine = read('supabase/functions/ai-engine/index.ts');
const aiService = read('src/lib/ai/service.ts');
const emailService = read('supabase/functions/email-service/index.ts');
const envExample = read('.env.example');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const aiSecurityMigration = read('supabase/migrations/20260829110000_ai_engine_security_hardening.sql');
const adminSecurityMigration = read('supabase/migrations/20260829144000_harden_admin_role_and_admin_access.sql');
const adminFullAccessMigration = read('supabase/migrations/20260829223500_admin_full_access_override.sql');
const adminAccessOverrideMigration = read('supabase/migrations/20260829225000_admin_access_overrides.sql');
const accountBlockMigration = read('supabase/migrations/20260829231500_account_block_re_registration.sql');
const blockListSupportMigration = read('supabase/migrations/20260829233000_admin_block_list_and_support_immutability.sql');
const subscriptionGraceMigration = read('supabase/migrations/20260829234500_subscription_grace_period.sql');
const signupPolicyMigration = read('supabase/migrations/20260829235500_enforce_signup_policy.sql');
const adminDeployScript = read('scripts/admin-hardening-deploy.ps1');
const adminContext = read('src/context/AdminContext.tsx');
const adminUsers = read('src/components/admin/AdminUsers.tsx');
const adminHooks = read('src/lib/admin-hooks.ts');
const adminContent = read('src/components/admin/AdminContent.tsx');
const adminSystem = read('src/components/admin/AdminSystem.tsx');
const adminTools = read('src/components/admin/AdminTools.tsx');
const adminAI = read('src/components/admin/AdminAI.tsx');
const adminSubscriptions = read('src/components/admin/AdminSubscriptions.tsx');
const billingAdminStatus = read('supabase/functions/billing-admin-status/index.ts');
const stripeWebhook = read('supabase/functions/stripe-webhook/index.ts');
const aiTypes = read('src/lib/ai/types.ts');
const sharedBilling = read('supabase/functions/_shared/billing.ts');
const app = read('src/App.tsx');
const manifest = read('public/manifest.webmanifest');
const vercelConfig = JSON.parse(read('vercel.json'));
const globalStyles = read('src/index.css');
const sitemap = read('public/sitemap.xml');
const allCore = [auth, onboarding, aiEngine, emailService].join('\n');

check('No unresolved merge markers in core files', !/(^|\n)(<{7}|={7}|>{7})/.test(allCore));
check('Auth debug logs removed', !/console\.log\(/.test(auth));
check('Onboarding debug logs removed', !/console\.log\(/.test(onboarding));
check('AI provider debug logs removed', !/console\.log\(/.test(aiEngine));
check('Email service does not log recipient/subject', !/console\.log\(/.test(emailService));
check('Email service supports explicit dev mode only', emailService.includes('EMAIL_DEV_MODE'));
check('AI engine authenticates users server-side', aiEngine.includes('requireUser(req)'));
check('AI stream handles JSON edge-function responses', aiService.includes("contentType.includes('application/json')"));
check('AI engine enforces server-side rate limits', aiEngine.includes('enforce_ai_rate_limit'));
check('AI engine caps request and output size', aiEngine.includes('MAX_REQUEST_CHARS') && aiEngine.includes('MAX_OUTPUT_TOKENS'));
check('AI engine records trusted usage server-side', aiEngine.includes('admin.from("ai_usage").insert'));
check('AI engine does not return raw provider details', !aiEngine.includes('details: raw') && !aiEngine.includes('details: imageData'));
check('Email service authenticates users server-side', emailService.includes('requireUser(req)'));
check('Email service restricts arbitrary recipients', emailService.includes('Email recipient must match the signed-in account'));
check('Contact email uses configured support recipient', emailService.includes('SUPPORT_EMAIL'));
check('Email templates escape user-controlled HTML', emailService.includes('function escapeHtml'));
check('AI usage inserts are no longer client-writable', aiSecurityMigration.includes('DROP POLICY IF EXISTS "insert_own_ai_usage"'));
check('ws security override is pinned to 8.21.3+', packageJson.overrides?.ws === '8.21.3' && packageLock.packages?.['node_modules/ws']?.version === '8.21.3');
check('Auth refreshes profile after auth state changes', auth.includes('void fetchProfile(nextSession.user.id)'));
check('Admin access uses trusted is_admin RPC', adminContext.includes("supabase.rpc('is_admin')") && !adminContext.includes(".select('role')"));
check('Admin role fields are not directly client-updatable', adminSecurityMigration.includes('REVOKE UPDATE ON public.profiles FROM authenticated') && adminSecurityMigration.includes('GRANT UPDATE (full_name, avatar_url, language)'));
check(
  'Admin user mutations use protected RPCs',
  adminUsers.includes("supabase.rpc('admin_update_user'") &&
  adminUsers.includes("admin_delete_user") &&
  adminUsers.includes("admin_delete_user_and_block") &&
  !adminUsers.includes(".from('profiles').update")
);
check('Admin user list uses server-side RPC', adminHooks.includes("supabase.rpc('admin_list_users')"));
check('Admin self-lockout protections exist', adminSecurityMigration.includes('You cannot remove or suspend your own administrator access') && adminSecurityMigration.includes('You cannot delete your own administrator account'));
check('Active admins receive business-level builder access without fake billing', adminFullAccessMigration.includes("v_plan := 'business'") && adminFullAccessMigration.includes("'accessSource'") && adminFullAccessMigration.includes("'admin'"));
check('Admin user list distinguishes admin access from paid plans', adminFullAccessMigration.includes("THEN 'admin'") && adminUsers.includes("Admin Access"));
{
  const grantStart = adminAccessOverrideMigration.indexOf('CREATE OR REPLACE FUNCTION public.admin_set_access_override');
  const grantEnd = adminAccessOverrideMigration.indexOf('CREATE OR REPLACE FUNCTION public.effective_access_plan');
  const grantBody = grantStart >= 0 && grantEnd > grantStart ? adminAccessOverrideMigration.slice(grantStart, grantEnd) : '';
  check(
    'Admin complimentary access stays separate from Stripe billing',
    grantBody.includes('admin_access_overrides') &&
    !grantBody.includes('INSERT INTO public.subscriptions') &&
    !grantBody.includes('UPDATE public.subscriptions') &&
    !grantBody.includes('sync_billing_subscription')
  );
}
check('Website Builder uses effective access plan', adminAccessOverrideMigration.includes('effective_access_plan') && adminAccessOverrideMigration.includes('v_plan := public.effective_access_plan'));
check('Admin user editor exposes complimentary access controls', adminUsers.includes('Complimentary Access') && adminUsers.includes("admin_set_access_override"));
check('Deleted identities can remain blocked from re-registration', accountBlockMigration.includes('account_blocks') && accountBlockMigration.includes('admin_delete_user_and_block') && accountBlockMigration.includes('is_email_blocked'));
check('Auth checks account block before sign-in and sign-up', auth.includes("supabase.rpc('is_email_blocked'") && auth.indexOf("is_email_blocked") < auth.indexOf("signInWithPassword") && auth.lastIndexOf("is_email_blocked") < auth.indexOf("auth.signUp"));
check('Admin delete UI distinguishes delete-only from delete-and-block', adminUsers.includes('Delete account only') && adminUsers.includes('Delete + Block re-registration') && adminUsers.includes("admin_delete_user_and_block"));
check('Submitted support ticket content becomes immutable', blockListSupportMigration.includes('protect_support_ticket_owner_content') && blockListSupportMigration.includes('Submitted support ticket content cannot be changed'));
check('Admin System exposes account block list management', adminSystem.includes('Account Blocks') && adminSystem.includes('admin_list_account_blocks') && adminSystem.includes('admin_unblock_email'));
check('Admin System exposes production readiness panel', adminSystem.includes('Production Readiness') && adminSystem.includes('Stripe connection') && adminSystem.includes('Stripe webhook'));
check('System logs show audit metadata', adminSystem.includes("select('id, level, category, message, metadata, created_at')") && adminSystem.includes('Object.entries(log.metadata)'));
check('Paid subscriptions use explicit 3-day past-due grace', subscriptionGraceMigration.includes("interval '3 days'") && subscriptionGraceMigration.includes("status = 'past_due'"));
check('Admin subscriptions labels past-due grace', adminSubscriptions.includes('Past Due / Grace') && adminSubscriptions.includes('3-day grace'));
check('Admin signup setting is enforced through trusted RPC', signupPolicyMigration.includes('is_signup_enabled') && auth.includes("supabase.rpc('is_signup_enabled'"));
check('Blocked email policy also guards OAuth sessions', auth.includes('isBlockedEmail(nextSession.user.email)') && auth.includes('await supabase.auth.signOut()'));
check('Google OAuth respects signup-disabled policy', auth.includes('async function signInWithGoogle()') && auth.includes('New registrations are temporarily disabled.'));
check('Admin settings are admin-readable only', adminSecurityMigration.includes('DROP POLICY IF EXISTS "admin_settings_select"') && adminSecurityMigration.includes('CREATE POLICY "admin_settings_select"') && adminSecurityMigration.includes('USING (public.is_admin())'));
check('Suspended accounts are blocked from workspace UI', app.includes('profile?.suspended') && app.includes('Account suspended'));
check('Profile updates whitelist ordinary fields', auth.includes("Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'language'>>"));
check('Suspended users are rejected by shared Edge Function auth', sharedBilling.includes('.select("suspended")') && sharedBilling.includes('throw new HttpError(403, "Account suspended")'));
check('Support admin-only fields are protected server-side', adminSecurityMigration.includes('protect_support_ticket_admin_fields') && adminSecurityMigration.includes('NEW.admin_response IS DISTINCT FROM OLD.admin_response'));
check('Admin content save persists instead of simulating success', adminContent.includes(".eq('key', 'content_draft')") && adminContent.includes(".upsert({") && !adminContent.includes('setTimeout'));
check('Admin system settings cannot overwrite content drafts', adminSystem.includes('SYSTEM_SETTING_KEYS') && adminSystem.includes(".in('key', [...SYSTEM_SETTING_KEYS])") && adminSystem.includes('SYSTEM_SETTING_KEYS.map'));
check('Admin system no longer exposes fake backup operations', !adminSystem.includes('mockBackups') && !adminSystem.includes('Backup created successfully'));
check('Admin tools no longer use random ratings', !adminTools.includes('Math.random()'));
check('AI engine resolves per-tool model before admin default', aiEngine.includes('resolveTextModel') && aiEngine.includes('.from("ai_settings")') && aiEngine.includes('"default_ai_model"'));
check('AI engine validates production model catalog', aiEngine.includes('BUILTIN_TEXT_MODELS') && aiEngine.includes('"ai_model_catalog"') && aiEngine.includes('allowedModels.has') && !aiEngine.includes('const model = "gemini-3.6-flash"'));
check('Admin model manager supports manual Gemini models', adminAI.includes('Add model manually') && adminAI.includes('ai_model_catalog') && adminAI.includes('GEMINI_MODEL_ID') && adminAI.includes('removeModel'));
check('Admin model manager uses dark controls instead of native select', !adminAI.includes('<select') && adminAI.includes('bg-[#090916]') && adminAI.includes('bg-[#0b0b18]'));
check('Admin subscriptions exposes secure Payment Settings', adminSubscriptions.includes('Payment Settings') && adminSubscriptions.includes("billing-admin-status") && adminSubscriptions.includes('Open Stripe Dashboard'));
check('Billing admin status never returns Stripe secret values', billingAdminStatus.includes('STRIPE_SECRET_KEY') && !billingAdminStatus.includes('stripeSecret,') && !billingAdminStatus.includes('webhookSecret,'));
check('Billing admin status verifies account, prices and webhook endpoint', billingAdminStatus.includes('/v1/account') && billingAdminStatus.includes('/v1/prices/') && billingAdminStatus.includes('/v1/webhook_endpoints'));
check('Stripe webhook still verifies signatures', stripeWebhook.includes('verifyStripeSignature') && stripeWebhook.includes('STRIPE_WEBHOOK_SECRET'));
check('Admin provider cards remain honest about backend support', adminAI.includes('Backend not enabled'));
check('Gemini registry uses current production model IDs', aiTypes.includes("'gemini-3.7-flash'") && aiTypes.includes("'gemini-3.6-flash'") && aiTypes.includes("'gemini-3.5-flash'") && !aiTypes.includes("'gemini-1.5-pro'"));
check('Gemini 3.x requests omit deprecated temperature sampling', !aiEngine.includes('temperature: clampNumber(body.temperature'));
check('AI engine accepts admin-added Gemini IDs only from catalog', aiEngine.includes('GEMINI_MODEL_ID') && aiEngine.includes('loadAllowedTextModels') && aiEngine.includes('source.enabled === false'));
check('Admin deploy defaults to dry-run', adminDeployScript.includes('db push --dry-run') && adminDeployScript.includes('if (-not $Apply)'));
check('Admin production deploy requires explicit confirmation', adminDeployScript.includes('if (-not $ConfirmProduction)') && adminDeployScript.includes('-Apply -ConfirmProduction'));
check('Admin deploy updates affected Edge Functions', ['ai-engine', 'billing-portal', 'create-checkout-session', 'stripe-webhook', 'billing-admin-status', 'email-service'].every((name) => adminDeployScript.includes(name)));
check('Admin deploy handles Windows env BOM', adminDeployScript.includes('Removing UTF-8 BOM from .env') && adminDeployScript.includes('[System.IO.File]::ReadAllBytes'));

for (const name of [
  'VITE_PUBLIC_SITE_URL', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'GEMINI_API_KEY', 'FAL_KEY', 'EMAIL_API_KEY', 'EMAIL_DEV_MODE',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRO_PRICE_ID',
  'STRIPE_BUSINESS_PRICE_ID', 'APP_URL', 'ALLOWED_ORIGINS', 'AI_RATE_LIMIT_PER_MINUTE',
  'AI_MAX_REQUEST_CHARS', 'AI_MAX_BODY_CHARS', 'AI_MAX_OUTPUT_TOKENS', 'SUPPORT_EMAIL',
]) check(`Environment template includes ${name}`, envExample.includes(name));

check('PWA manifest has no broken hash shortcuts', !manifest.includes('"shortcuts"'));
check('Sitemap excludes login hash route', !sitemap.includes('#login'));
check('Sitemap excludes register hash route', !sitemap.includes('#register'));
check('Sitemap excludes forgot-password hash route', !sitemap.includes('#forgot'));
check(
  'Vercel auto-deploys production main only',
  vercelConfig.git?.deploymentEnabled?.main === true &&
  vercelConfig.git?.deploymentEnabled?.['*'] === false
);
check('Production verification script exists', exists('scripts/verify-production.ps1'));
check('Tomorrow release runbook exists', exists('docs/TOMORROW_RELEASE.md'));
check('Native dropdown menus stay dark globally', globalStyles.includes('select,') && globalStyles.includes('option,') && globalStyles.includes('optgroup') && globalStyles.includes('color-scheme: dark') && !globalStyles.includes('html:not(.dark) { color-scheme: light; }'));

const failed = checks.filter((item) => !item.ok);
console.log(`Project health check: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const item of checks) console.log(`  ${item.ok ? '✓' : '✗'} ${item.name}`);
if (failed.length) process.exit(1);
