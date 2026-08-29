import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const builderPath = resolve(root, 'src/modules/website-builder/WebsiteBuilderTool.tsx');
const qualityMigrationPath = resolve(root, 'supabase/migrations/20260828161000_quality_security_hardening.sql');
const teamMigrationPath = resolve(root, 'supabase/migrations/20260828155500_add_team_workspaces.sql');
const billingMigrationPath = resolve(root, 'supabase/migrations/20260828154000_add_secure_billing_entitlements.sql');
const adminEntitlementsMigrationPath = resolve(root, 'supabase/migrations/20260828223000_admin_business_entitlements.sql');

const failures = [];
const passes = [];

function check(label, condition) {
  (condition ? passes : failures).push(label);
}

for (const [label, path] of [
  ['Website Builder source exists', builderPath],
  ['Quality/security migration exists', qualityMigrationPath],
  ['Team workspace migration exists', teamMigrationPath],
  ['Billing migration exists', billingMigrationPath],
  ['Admin Business entitlements migration exists', adminEntitlementsMigrationPath],
]) {
  check(label, existsSync(path));
}

const builder = existsSync(builderPath) ? readFileSync(builderPath, 'utf8') : '';
const migration = existsSync(qualityMigrationPath) ? readFileSync(qualityMigrationPath, 'utf8') : '';
const adminEntitlementsMigration = existsSync(adminEntitlementsMigrationPath) ? readFileSync(adminEntitlementsMigrationPath, 'utf8') : '';

check('No unresolved merge markers in Website Builder', !/(<<<<<<<|=======|>>>>>>>)/.test(builder));
check('Recovery snapshot storage is enabled', builder.includes('RECOVERY_STORAGE_KEY'));
check('Online/offline state is monitored', builder.includes("window.addEventListener('offline'"));
check('Failed cloud sync is tracked', builder.includes('cloudSyncFailed'));
check('Cloud mutations retry transient failures', builder.includes('retryCloudOperation'));
check('Publish preflight blocks critical audit errors', builder.includes('Publish preflight blocked: fix'));
check('Publish preflight blocks offline deploys', builder.includes('Publish preflight blocked: you are offline'));
check('Top-level Publish button uses the complete launch preflight', builder.includes('disabled={!v1LaunchStatus.preflightReady || publishBusy'));
check('Publish handler enforces the complete launch preflight', builder.includes('Publish preflight blocked: ${v1LaunchStatus.blockers[0]'));
check('Launch blockers include production URL and SEO branding', builder.includes("!productionUrlReady ? 'Add a valid production URL.'") && builder.includes("!seoReady ? 'Complete the SEO title and favicon.'"));
check('Generated pages use a referrer policy', builder.includes('strict-origin-when-cross-origin'));
check('Generated pages include CSP', builder.includes('Content-Security-Policy'));
check('Generated pages have keyboard skip navigation', builder.includes('tayar-skip-link'));
check('Generated images use lazy loading', builder.includes('loading="lazy" decoding="async"'));
check('Large-project diagnostics are enabled', builder.includes('snapshotKb'));
check('Builder primary toolbar uses progressive disclosure', builder.includes("More website tools") && builder.includes("Advanced tools stay here until you need them."));
check('Page settings are collapsed by default', builder.includes('pageSettingsOpen') && builder.includes("Page settings"));
check('Site settings are collapsed by default', builder.includes('advancedSiteSettingsOpen') && builder.includes("Site settings"));
check('Element palette uses progressive disclosure', builder.includes("Add element") && builder.includes("Sections & elements") && builder.includes("<details"));
check('Builder sidebar uses focused Add/Pages/Layers modes', builder.includes("builderPanel") && builder.includes("setBuilderPanel") && builder.includes("['add', l('Add')]") && builder.includes("['pages', l('Pages')]") && builder.includes("['layers', l('Layers')]"));
check('Inspector exposes quick style before advanced controls', builder.includes("Quick style") && builder.includes("Advanced design & responsive"));
check('Selected elements expose direct canvas actions', builder.includes("renderSelectedElementToolbar") && builder.includes("onDuplicateSelectedElement") && builder.includes("onDeleteSelectedElement"));
check('Selected sections expose direct canvas actions', builder.includes("canMoveSectionUp") && builder.includes("onMoveSection") && builder.includes("onDeleteSection"));
check('Inspector advanced controls are collapsed', builder.includes("Structure & reusable components") && builder.includes("Advanced design & responsive"));
check('AI builder is optional by default', builder.includes("Build with AI") && builder.includes("Optional"));
check('Section palette remains available in focused Add panel', builder.includes("Object.keys(SECTION_LABELS)") && builder.includes("Sections & elements"));
check('Layers are collapsed by default', builder.includes("sections.length") && builder.includes("Layers") && builder.includes("<details"));
check('Legacy array backups use a valid default language', builder.includes("if (Array.isArray(input) && input.length)") && builder.includes("showInNavigation: true, language: 'en', translationKey: 'home'"));
check('Analytics CSV export uses the shared CSV serializer', builder.includes("-analytics.csv`, `\\uFEFF${buildCsv(rows)}`"));
check('Container column controls are reachable', builder.includes('selectedSection && sectionColumnCount(selectedSection.layout) > 1'));
check('Media insertion is not misclassified as a React hook', builder.includes('function applyMediaAsset') && !builder.includes('function useMediaAsset'));
check('Generated counter regex preserves numeric escapes', builder.includes('raw.match(/-?\\\\d+(?:\\\\.\\\\d+)?/)'));
check('Public rate-limit table exists', migration.includes('website_public_rate_limits'));
check('Form submission rate limit is enforced', migration.includes("'lead-form'"));
check('Analytics page-view rate limit is enforced', migration.includes("'analytics-page-view'"));
check('Analytics event rate limit is enforced', migration.includes("'analytics-event'"));
check('Plan ingestion caps are enforced', migration.includes('website_public_ingestion_limit'));
check('Admin role receives effective Business entitlements', adminEntitlementsMigration.includes("WHEN p.role = 'admin' THEN 'business'"));
check('Billing state uses the shared effective plan', adminEntitlementsMigration.includes('v_plan := public.team_effective_plan(v_owner_id)'));
check('Admin entitlement does not mutate subscription records', !/UPDATE\s+public\.subscriptions/i.test(adminEntitlementsMigration));
check('Server-side email validation exists', migration.includes('Invalid email address'));
check('Rate-limit table is not directly exposed to anon users', migration.includes('REVOKE ALL ON public.website_public_rate_limits'));
check('No Stripe live secret literal appears in changed source', !/sk_live_[A-Za-z0-9]+/.test(builder + migration));

console.log(`Website Builder smoke test: ${passes.length} passed, ${failures.length} failed`);
for (const label of passes) console.log(`  ✓ ${label}`);
for (const label of failures) console.error(`  ✗ ${label}`);

if (failures.length) process.exit(1);
