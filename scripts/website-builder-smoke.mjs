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
check('Heading and text support inline canvas editing', builder.includes("Double-click to edit text") && builder.includes("editingInline") && builder.includes("updateInlineElementContent"));
check('Selected sections expose quick add element controls', builder.includes("onAddElement") && builder.includes("Add element") && builder.includes("ELEMENT_LABELS.spacer"));
check('Canvas exposes add section controls between sections', builder.includes("insertSectionAfter") && builder.includes("Add section") && builder.includes("Object.keys(SECTION_LABELS)"));
check('Element drag and drop reorders live while dragging', builder.includes("draggedElementRef.current") && builder.includes("dragOverElementPosition") && builder.includes("setSections((current) =>") && builder.includes("getBoundingClientRect()"));
check('Element drag and drop supports moving across sections', builder.includes("draggedElementSectionRef.current = targetSectionId") && builder.includes("containerId: undefined") && builder.includes("layoutColumn: undefined"));
check('Section drag and drop reorders live while dragging', builder.includes("draggedSectionRef.current") && builder.includes("dragOverSectionPosition") && builder.includes("setDragOverId(targetId)"));
check('Canvas shows before/after drop indicators', builder.includes("dragOverElementPosition === 'before'") && builder.includes("dragOverSectionPosition === 'before'"));
check('Canvas elements support free X/Y positioning', builder.includes("positionX") && builder.includes("positionY") && builder.includes("handleElementDragMove"));
check('Free positioning is device-aware and published', builder.includes("translate3d(${positionX}px,${positionY}px,0)") && builder.includes("responsive") && builder.includes("[device]"));
check('Shift drag preserves flow reordering', builder.includes("if (!e.shiftKey)") && builder.includes("Hold Shift while dragging to reorder instead."));
check('Inspector exposes X/Y and reset position controls', builder.includes("Free position") && builder.includes("positionX") && builder.includes("positionY") && builder.includes("positionX: 0, positionY: 0"));
check('Divider applies free-position transform like other elements', builder.includes("element.type === 'divider'") && builder.includes("style={{ ...commonStyle, backgroundColor: 'transparent'"));
check('Inspector advanced controls are collapsed', builder.includes("Structure & reusable components") && builder.includes("Advanced design & responsive"));
check('AI builder is first-class in the Add panel', builder.includes("Tayar AI Builder") && builder.includes(">V2<") && builder.includes("Build with Tayar Agent") && builder.includes("AI creates and patches real Tayar pages and sections"));
check('AI builder supports targeted follow-up edits', builder.includes("Apply AI change") && builder.includes("applyAIChange") && builder.includes("update_section") && builder.includes("remove_section"));
check('AI builder follow-up edits are undoable', builder.includes("Undo AI change") && builder.includes("setAiUndoSnapshot(snapshot)") && builder.includes("undoLastAIChange"));
check('AI builder can preserve unrelated content while patching', builder.includes("JSON.parse(JSON.stringify(currentPages))") && builder.includes("resolvePageIndex") && builder.includes("resolveSectionIndex"));
check('AI builder can generate and persist targeted images', builder.includes("generate_image") && builder.includes("requestGeneratedImage") && builder.includes("Media Library"));
check('Tayar Agent performs full build preparation', builder.includes("Build with Tayar Agent") && builder.includes("agentImagesGenerated") && builder.includes("nextGeneratedSeo"));
check('AI quality check can review and fix safe issues', builder.includes("AI Quality Check") && builder.includes("runAIQualityCheck") && builder.includes("Fix safe issues with AI"));
check('AI quality context includes SEO header and element details', builder.includes('responsiveModes: Object.keys(element.responsive || {})') && builder.includes('seoTitle: page.seoTitle') && builder.includes('showCta: headerConfig.showCta'));
check('AI patches can repair SEO and header CTA', builder.includes("update_seo") && builder.includes("update_header") && builder.includes('setSeo(nextSeo)') && builder.includes('setHeaderConfig(nextHeaderConfig)'));
check('AI builder can add pages without rebuilding the site', builder.includes("add_page") && builder.includes('sourcePage') && builder.includes('billingEntitlements.maxPages'));
check('AI builder protects home and final page from deletion', builder.includes("remove_page") && builder.includes('targetPage.id === nextHomePageId') && builder.includes('nextPages.length <= 1'));
check('AI builder can switch the homepage without rebuilding', builder.includes("set_home_page") && builder.includes('nextHomePageId') && builder.includes('setHomePageId(nextHomePageId)'));
check('Project history contains AI checkpoints', builder.includes("Before AI change") && builder.includes("After AI change") && builder.includes("slice(0, 30)"));
check('Publish actions expose Preview Check Publish flow', builder.includes("AI quality check before publishing") && builder.includes("Check") && builder.includes("Publish"));
check('Section palette remains available in focused Add panel', builder.includes("Object.keys(SECTION_LABELS)") && builder.includes("Sections & elements"));
check('Layers show elements only for the selected section', builder.includes("Select a section to see its elements.") && builder.includes("selectedId === section.id && (") && builder.includes("setInspectorOpen(true)"));
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
