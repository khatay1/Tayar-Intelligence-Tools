import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

const app = read('src/App.tsx');
const auth = read('src/context/AuthContext.tsx');
const register = read('src/components/auth/Register.tsx');
const reset = read('src/components/auth/ResetPassword.tsx');
const suspendedAccount = read('src/components/auth/SuspendedAccount.tsx');
const settings = read('src/components/workspace/SettingsPage.tsx');
const adminUsers = read('src/components/admin/AdminUsers.tsx');
const subscription = read('src/components/workspace/SubscriptionView.tsx');
const gate = read('src/modules/shared/ToolAccessGate.tsx');
const builder = read('src/modules/website-builder/WebsiteBuilderTool.tsx');
const publishedService = read('src/modules/website-builder/services/publishedWebsiteService.ts');
const publishVersionService = read('src/modules/website-builder/services/publishVersionService.ts');
const sharedBilling = read('supabase/functions/_shared/billing.ts');
const checkout = read('supabase/functions/create-checkout-session/index.ts');
const webhook = read('supabase/functions/stripe-webhook/index.ts');
const deleteAccount = read('supabase/functions/delete-account/index.ts');
const adminBilling = read('supabase/functions/billing-admin-control/index.ts');
const billingStatus = read('supabase/functions/billing-admin-status/index.ts');
const publicCatalog = read('supabase/functions/public-plan-catalog/index.ts');
const migration = read('supabase/migrations/20260906100643_launch_auth_and_billing_hardening.sql');
const supabaseConfig = read('supabase/config.toml');
const cookieConsent = read('src/components/workspace/CookieConsent.tsx');
const monitoring = read('src/lib/monitoring.ts');
const privacy = read('src/components/workspace/PrivacyPolicy.tsx');
const terms = read('src/components/workspace/TermsOfService.tsx');
const legal = read('src/lib/legal.ts');
const legalDetails = read('src/components/workspace/LegalOperatorDetails.tsx');
const envExample = read('.env.example');
const deploymentGuard = read('scripts/admin-hardening-deploy.ps1');
const archiveDeleteFlow = publishVersionService.slice(
  publishVersionService.indexOf('export async function deleteWebsitePublishVersionArchive'),
  publishVersionService.indexOf('export async function discardWebsitePublishVersionArchive'),
);

check('Password recovery has an explicit redirect and recovery route',
  auth.includes("event === 'PASSWORD_RECOVERY'") &&
  auth.includes("searchParams.set('auth', 'recovery')") &&
  app.includes("get('auth') === 'recovery'") &&
  app.includes("hashRoute === 'reset'") &&
  app.indexOf("authPage === 'reset'") < app.indexOf('if (user && profile?.suspended)'));
check('Registration and reset share the strong password policy',
  register.includes('validatePassword(password)') &&
  reset.includes('validatePassword(password)') &&
  supabaseConfig.includes('minimum_password_length = 8') &&
  supabaseConfig.includes('password_requirements = "lower_upper_letters_digits"'));
check('Google sign-in is not blocked by the new-signup UI switch',
  !auth.slice(auth.indexOf('async function signInWithGoogle'), auth.indexOf('async function signOut')).includes('isSignupAllowed'));
check('Signup switch and email block list are enforced by the Auth hook',
  supabaseConfig.includes('[auth.hook.before_user_created]') &&
  migration.includes('hook_enforce_tayar_signup_policy') &&
  migration.includes('public.is_signup_enabled()') &&
  migration.includes('public.is_email_blocked(v_email)') &&
  migration.includes('to supabase_auth_admin'));
check('Internal SECURITY DEFINER functions are not anonymously executable',
  migration.includes('public.create_team_workspace(text) from public, anon') &&
  migration.includes('public.get_website_builder_billing_state(uuid) from public, anon') &&
  migration.includes('public.handle_new_user()') &&
  migration.includes('public, anon, authenticated') &&
  migration.includes('public.enforce_website_public_rate_limit'));

check('Manual Website Builder remains usable after AI quota exhaustion',
  gate.includes("MANUAL_AFTER_AI_QUOTA = new Set(['website-builder'])") &&
  gate.includes('manualQuotaBypass'));
check('Account deletion is server-side and cancels billing before Auth deletion',
  settings.includes("functions.invoke('delete-account'") &&
  adminUsers.includes("functions.invoke('delete-account'") &&
  !adminUsers.includes("rpc('admin_delete_user") &&
  deleteAccount.includes('stripeRequest(`/v1/subscriptions/') &&
  deleteAccount.includes('/v1/subscriptions?${query.toString()}') &&
  deleteAccount.includes('terminalSubscriptionStatuses') &&
  deleteAccount.includes('collectStoragePaths') &&
  deleteAccount.includes('admin.auth.admin.deleteUser') &&
  migration.includes('revoke all on function public.admin_delete_user(uuid)'));
check('Suspended users retain legal-page and self-deletion access',
  deleteAccount.includes('requireAuthenticatedUser(req)') &&
  suspendedAccount.includes("functions.invoke('delete-account'") &&
  app.includes('recoveryRequested || publicPage ||') &&
  app.indexOf('if (publicPage)') < app.indexOf('if (user && profile?.suspended)'));
check('Account export is paginated and fails closed on source errors',
  settings.includes('ACCOUNT_EXPORT_PAGE_SIZE') &&
  settings.includes('.range(offset, offset + ACCOUNT_EXPORT_PAGE_SIZE - 1)') &&
  settings.includes('storageManifest'));

check('Checkout uses configured prices, trusted redirects and idempotency keys',
  !checkout.includes('price_1') &&
  checkout.includes('A valid Checkout request ID is required') &&
  checkout.includes('idempotencyKey: `checkout:') &&
  sharedBilling.includes('Production must configure') &&
  billingStatus.includes('appUrlConfigured') &&
  billingStatus.includes('pro.livemode === true') &&
  billingStatus.includes('pro.livemode === false') &&
  !billingStatus.includes('mode === "unknown";'));
check('Subscription screen displays verified public snapshots for active Stripe prices',
  subscription.includes('fetchPublicPlanCatalogV2') &&
  subscription.includes('formatPlanPrice') &&
  publicCatalog.includes('stripe_${plan}_price_public') &&
  publicCatalog.includes('matchesCurrentPrice') &&
  publicCatalog.includes('unitAmount: matchesCurrentPrice') &&
  !publicCatalog.includes('fallbackAmount') &&
  adminBilling.includes('/v1/prices/${encodeURIComponent(previousPriceId)}') &&
  adminBilling.includes('publicPriceSettingKey(plan)') &&
  adminBilling.includes('value: publicPrice'));
check('New Stripe prices are retained in the plan mapping',
  adminBilling.includes('stripe_price_plan_map') && migration.includes('create table if not exists public.stripe_price_plan_map'));
check('Stripe webhook events are claimed idempotently and reject stale updates',
  webhook.includes('claim_stripe_webhook_event') &&
  webhook.includes('updateEventStatus') &&
  webhook.includes('p_event_created: event.created') &&
  migration.includes('create table if not exists public.stripe_webhook_events') &&
  migration.includes('p_event_created >= subscriptions.stripe_event_created'));

check('Publish and unpublish compensate storage when project state fails',
  publishedService.includes('snapshotPublishedWebsiteFiles') &&
  publishedService.includes('restorePublishedWebsiteSnapshot') &&
  builder.includes('publicationStateCommitted') &&
  builder.includes('await restorePublishedWebsiteSnapshot'));
check('Release archive uploads clean up partial failures',
  publishedService.includes('uploadedPaths') &&
  publishedService.includes('Archive cleanup was incomplete'));
check('Release archive deletion preserves record/file consistency',
  archiveDeleteFlow.indexOf(".from('website_publish_versions')") < archiveDeleteFlow.indexOf('removeWebsitePublishVersionArchiveFiles') &&
  publishVersionService.includes('discardWebsitePublishVersionArchive') &&
  builder.includes('await discardWebsitePublishVersionArchive(cleanup)'));

check('Optional analytics defaults off and phantom marketing consent is removed',
  cookieConsent.includes('analytics: false') &&
  !cookieConsent.includes('marketing:') &&
  !cookieConsent.includes("l('Marketing')"));
check('Analytics withdrawal stops external capture and session replay stays disabled',
  monitoring.includes('disable_session_recording: true') &&
  monitoring.includes('autocapture: false') &&
  monitoring.includes('opt_out_capturing') &&
  monitoring.includes("analytics_storage: enabled ? 'granted' : 'denied'") &&
  monitoring.includes('sentryOptions.enabled = enabled'));
check('Privacy and Terms support optional configured operator identity',
  privacy.includes('<LegalOperatorDetails />') &&
  terms.includes('<LegalOperatorDetails />') &&
  legalDetails.includes('configuredFields') &&
  legalDetails.includes('if (!configuredFields.length) return null') &&
  !legal.includes('missingLegalIdentityFields'));
check('Optional public legal identity variables are documented for deployment',
  ['VITE_LEGAL_ENTITY_NAME', 'VITE_LEGAL_REGISTRATION_NUMBER', 'VITE_LEGAL_POSTAL_ADDRESS', 'VITE_LEGAL_COUNTRY', 'VITE_LEGAL_CONTACT_EMAIL']
    .every(name => envExample.includes(name)));
check('Guarded Supabase release applies Auth config and every changed billing function',
  deploymentGuard.includes('Invoke-Supabase config push') &&
  ['billing-admin-control', 'billing-admin-status', 'billing-portal', 'create-checkout-session', 'delete-account', 'public-plan-catalog', 'stripe-webhook']
    .every(name => deploymentGuard.includes(`'${name}'`)) &&
  deploymentGuard.includes("@('public-plan-catalog', 'stripe-webhook')") &&
  deploymentGuard.includes('--no-verify-jwt') &&
  supabaseConfig.includes('[functions.public-plan-catalog]') &&
  supabaseConfig.includes('[functions.stripe-webhook]') &&
  (supabaseConfig.match(/verify_jwt = false/g) || []).length === 2 &&
  deploymentGuard.includes('ConfirmAuthConfig'));

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}`);
    failed += 1;
  }
}

console.log(`Pilot launch smoke test: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
