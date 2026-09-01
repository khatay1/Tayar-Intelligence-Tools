import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const builderPath = resolve(root, 'src/modules/website-builder/WebsiteBuilderTool.tsx');
const qualityMigrationPath = resolve(root, 'supabase/migrations/20260828161000_quality_security_hardening.sql');
const teamMigrationPath = resolve(root, 'supabase/migrations/20260828155500_add_team_workspaces.sql');
const billingMigrationPath = resolve(root, 'supabase/migrations/20260828154000_add_secure_billing_entitlements.sql');
const adminEntitlementsMigrationPath = resolve(root, 'supabase/migrations/20260828223000_admin_business_entitlements.sql');
const publishedUrlHelperPath = resolve(root, 'src/lib/published-site-url.ts');
const publishedProxyPath = resolve(root, 'api/published-site.js');
const vercelConfigPath = resolve(root, 'vercel.json');
const serviceWorkerPath = resolve(root, 'public/sw.js');
const workspaceProjectsPath = resolve(root, 'src/lib/use-projects.ts');
const runtimeHardeningMigrationPath = resolve(root, 'supabase/migrations/20260831210500_harden_website_public_runtime.sql');
const sharedRuntimeMigrationPath = resolve(root, 'supabase/migrations/20260831222000_align_shared_website_runtime.sql');
const projectAccessCorePath = resolve(root, 'src/modules/website-builder/core/editor-project-access.ts');
const publishedStorageCorePath = resolve(root, 'src/modules/website-builder/core/editor-published-storage.ts');
const projectLifecycleCorePath = resolve(root, 'src/modules/website-builder/core/editor-project-lifecycle.ts');
const projectNormalizationPath = resolve(root, 'src/modules/website-builder/core/project-normalization.ts');
const projectCloudServicePath = resolve(root, 'src/modules/website-builder/services/projectCloudService.ts');
const publishedWebsiteServicePath = resolve(root, 'src/modules/website-builder/services/publishedWebsiteService.ts');
const autosavePolicyPath = resolve(root, 'src/modules/website-builder/core/editor-autosave-policy.ts');
const reusableSectionServicePath = resolve(root, 'src/modules/website-builder/services/reusableSectionService.ts');
const publishVersionServicePath = resolve(root, 'src/modules/website-builder/services/publishVersionService.ts');
const websiteLeadServicePath = resolve(root, 'src/modules/website-builder/services/websiteLeadService.ts');
const websiteAnalyticsServicePath = resolve(root, 'src/modules/website-builder/services/websiteAnalyticsService.ts');
const websiteAnalyticsSummaryPath = resolve(root, 'src/modules/website-builder/core/website-analytics-summary.ts');
const websiteMediaServicePath = resolve(root, 'src/modules/website-builder/services/websiteMediaService.ts');
const websiteAccessServicePath = resolve(root, 'src/modules/website-builder/services/websiteAccessService.ts');
const websiteBillingServicePath = resolve(root, 'src/modules/website-builder/services/websiteBillingService.ts');
const projectIdentifiersPath = resolve(root, 'src/modules/website-builder/core/project-identifiers.ts');
const projectReleaseMetricsPath = resolve(root, 'src/modules/website-builder/core/project-release-metrics.ts');
const websiteLeadUtilsPath = resolve(root, 'src/modules/website-builder/core/website-lead-utils.ts');
const deliveryConfigPath = resolve(root, 'src/modules/website-builder/core/delivery-config.ts');
const publishedSiteValidationPath = resolve(root, 'src/modules/website-builder/core/published-site-validation.ts');
const builderHistoryPanelPath = resolve(root, 'src/modules/website-builder/v2-ui/BuilderHistoryPanel.tsx');
const builderPanelRouterPath = resolve(root, 'src/modules/website-builder/v2-ui/BuilderPanelRouter.tsx');
const builderV2NativeBridgePath = resolve(root, 'src/modules/website-builder/v2-ui/BuilderV2NativeBridge.tsx');
const websiteBuilderV2BridgePath = resolve(root, 'src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx');
const builderComponentsPanelPath = resolve(root, 'src/modules/website-builder/v2-ui/BuilderComponentsPanel.tsx');
const websiteBuilderV2CssPath = resolve(root, 'src/modules/website-builder/v2-ui/website-builder-v2.css');
const editorNativePatchPath = resolve(root, 'src/modules/website-builder/core/editor-native-patch.ts');
const editorBatchPath = resolve(root, 'src/modules/website-builder/core/editor-batch.ts');
const editorOperationPolicyPath = resolve(root, 'src/modules/website-builder/core/editor-operation-policy.ts');
const editorCommandAdaptersPath = resolve(root, 'src/modules/website-builder/core/editor-command-adapters.ts');
const editorNativeOperationPath = resolve(root, 'src/modules/website-builder/core/editor-native-operation.ts');
const editorModelPath = resolve(root, 'src/modules/website-builder/core/editor-model.ts');
const editorSymbolCommandsPath = resolve(root, 'src/modules/website-builder/core/editor-symbol-commands.ts');
const editorPayloadSafetyPath = resolve(root, 'src/modules/website-builder/core/editor-payload-safety.ts');
const editorDesignCommandsPath = resolve(root, 'src/modules/website-builder/core/editor-design-commands.ts');
const editorInspectorOperationPath = resolve(root, 'src/modules/website-builder/core/editor-inspector-operation.ts');
const editorInspectorModelPath = resolve(root, 'src/modules/website-builder/core/editor-inspector-model.ts');
const editorValueSafetyPath = resolve(root, 'src/modules/website-builder/core/editor-value-safety.ts');
const editorAIOperationContextPath = resolve(root, 'src/modules/website-builder/core/editor-ai-operation-context.ts');
const editorAINativeBridgePath = resolve(root, 'src/modules/website-builder/core/editor-ai-native-bridge.ts');
const editorNativeProjectPatchPath = resolve(root, 'src/modules/website-builder/core/editor-native-project-patch.ts');
const editorAIWorkingProjectPath = resolve(root, 'src/modules/website-builder/core/editor-ai-working-project.ts');

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
  ['Published-site URL helper exists', publishedUrlHelperPath],
  ['Published-site HTML proxy exists', publishedProxyPath],
  ['Vercel routing config exists', vercelConfigPath],
  ['Service worker exists', serviceWorkerPath],
  ['Workspace project helper exists', workspaceProjectsPath],
  ['Website public runtime hardening migration exists', runtimeHardeningMigrationPath],
  ['Shared Website runtime migration exists', sharedRuntimeMigrationPath],
  ['Core project-access module exists', projectAccessCorePath],
  ['Core published-storage module exists', publishedStorageCorePath],
  ['Core project-lifecycle module exists', projectLifecycleCorePath],
  ['Project normalization module exists', projectNormalizationPath],
  ['Cloud project service exists', projectCloudServicePath],
  ['Published website service exists', publishedWebsiteServicePath],
  ['Autosave policy helper exists', autosavePolicyPath],
  ['Reusable section service exists', reusableSectionServicePath],
  ['Publish version service exists', publishVersionServicePath],
  ['Website lead service exists', websiteLeadServicePath],
  ['Website analytics service exists', websiteAnalyticsServicePath],
  ['Website analytics summary helper exists', websiteAnalyticsSummaryPath],
  ['Website media service exists', websiteMediaServicePath],
  ['Website access service exists', websiteAccessServicePath],
  ['Website billing service exists', websiteBillingServicePath],
  ['Project identifiers helper exists', projectIdentifiersPath],
  ['Project release metrics helper exists', projectReleaseMetricsPath],
  ['Website lead utils helper exists', websiteLeadUtilsPath],
  ['Delivery config helper exists', deliveryConfigPath],
  ['Published-site validation helper exists', publishedSiteValidationPath],
  ['V2 history panel exists', builderHistoryPanelPath],
  ['V2 panel router exists', builderPanelRouterPath],
  ['V2 native bridge exists', builderV2NativeBridgePath],
  ['V2 bridge exists', websiteBuilderV2BridgePath],
  ['V2 Components panel exists', builderComponentsPanelPath],
  ['V2 stylesheet exists', websiteBuilderV2CssPath],
  ['Native patch transaction core exists', editorNativePatchPath],
  ['Editor batch transaction core exists', editorBatchPath],
  ['Native operation policy exists', editorOperationPolicyPath],
  ['Native command adapters exist', editorCommandAdaptersPath],
  ['Native operation adapter exists', editorNativeOperationPath],
  ['Native editor model exists', editorModelPath],
  ['Native symbol commands exist', editorSymbolCommandsPath],
  ['Native payload safety helper exists', editorPayloadSafetyPath],
  ['Native design commands exist', editorDesignCommandsPath],
  ['Native inspector operation helper exists', editorInspectorOperationPath],
  ['Native inspector model exists', editorInspectorModelPath],
  ['Native semantic value safety helper exists', editorValueSafetyPath],
  ['AI async editor context helper exists', editorAIOperationContextPath],
  ['AI native operation bridge exists', editorAINativeBridgePath],
  ['Plain native project patch executor exists', editorNativeProjectPatchPath],
  ['AI working native project executor exists', editorAIWorkingProjectPath],
]) {
  check(label, existsSync(path));
}

const builder = existsSync(builderPath) ? readFileSync(builderPath, 'utf8') : '';
const migration = existsSync(qualityMigrationPath) ? readFileSync(qualityMigrationPath, 'utf8') : '';
const adminEntitlementsMigration = existsSync(adminEntitlementsMigrationPath) ? readFileSync(adminEntitlementsMigrationPath, 'utf8') : '';
const publishedUrlHelper = existsSync(publishedUrlHelperPath) ? readFileSync(publishedUrlHelperPath, 'utf8') : '';
const publishedProxy = existsSync(publishedProxyPath) ? readFileSync(publishedProxyPath, 'utf8') : '';
const vercelConfig = existsSync(vercelConfigPath) ? readFileSync(vercelConfigPath, 'utf8') : '';
const serviceWorker = existsSync(serviceWorkerPath) ? readFileSync(serviceWorkerPath, 'utf8') : '';
const workspaceProjects = existsSync(workspaceProjectsPath) ? readFileSync(workspaceProjectsPath, 'utf8') : '';
const runtimeHardeningMigration = existsSync(runtimeHardeningMigrationPath) ? readFileSync(runtimeHardeningMigrationPath, 'utf8') : '';
const sharedRuntimeMigration = existsSync(sharedRuntimeMigrationPath) ? readFileSync(sharedRuntimeMigrationPath, 'utf8') : '';
const projectAccessCore = existsSync(projectAccessCorePath) ? readFileSync(projectAccessCorePath, 'utf8') : '';
const publishedStorageCore = existsSync(publishedStorageCorePath) ? readFileSync(publishedStorageCorePath, 'utf8') : '';
const projectLifecycleCore = existsSync(projectLifecycleCorePath) ? readFileSync(projectLifecycleCorePath, 'utf8') : '';
const projectNormalization = existsSync(projectNormalizationPath) ? readFileSync(projectNormalizationPath, 'utf8') : '';
const projectCloudService = existsSync(projectCloudServicePath) ? readFileSync(projectCloudServicePath, 'utf8') : '';
const publishedWebsiteService = existsSync(publishedWebsiteServicePath) ? readFileSync(publishedWebsiteServicePath, 'utf8') : '';
const autosavePolicy = existsSync(autosavePolicyPath) ? readFileSync(autosavePolicyPath, 'utf8') : '';
const reusableSectionService = existsSync(reusableSectionServicePath) ? readFileSync(reusableSectionServicePath, 'utf8') : '';
const publishVersionService = existsSync(publishVersionServicePath) ? readFileSync(publishVersionServicePath, 'utf8') : '';
const websiteLeadService = existsSync(websiteLeadServicePath) ? readFileSync(websiteLeadServicePath, 'utf8') : '';
const websiteAnalyticsService = existsSync(websiteAnalyticsServicePath) ? readFileSync(websiteAnalyticsServicePath, 'utf8') : '';
const websiteAnalyticsSummary = existsSync(websiteAnalyticsSummaryPath) ? readFileSync(websiteAnalyticsSummaryPath, 'utf8') : '';
const websiteMediaService = existsSync(websiteMediaServicePath) ? readFileSync(websiteMediaServicePath, 'utf8') : '';
const websiteAccessService = existsSync(websiteAccessServicePath) ? readFileSync(websiteAccessServicePath, 'utf8') : '';
const websiteBillingService = existsSync(websiteBillingServicePath) ? readFileSync(websiteBillingServicePath, 'utf8') : '';
const projectIdentifiers = existsSync(projectIdentifiersPath) ? readFileSync(projectIdentifiersPath, 'utf8') : '';
const projectReleaseMetrics = existsSync(projectReleaseMetricsPath) ? readFileSync(projectReleaseMetricsPath, 'utf8') : '';
const websiteLeadUtils = existsSync(websiteLeadUtilsPath) ? readFileSync(websiteLeadUtilsPath, 'utf8') : '';
const deliveryConfig = existsSync(deliveryConfigPath) ? readFileSync(deliveryConfigPath, 'utf8') : '';
const publishedSiteValidation = existsSync(publishedSiteValidationPath) ? readFileSync(publishedSiteValidationPath, 'utf8') : '';
const builderHistoryPanel = existsSync(builderHistoryPanelPath) ? readFileSync(builderHistoryPanelPath, 'utf8') : '';
const builderPanelRouter = existsSync(builderPanelRouterPath) ? readFileSync(builderPanelRouterPath, 'utf8') : '';
const builderV2NativeBridge = existsSync(builderV2NativeBridgePath) ? readFileSync(builderV2NativeBridgePath, 'utf8') : '';
const websiteBuilderV2Bridge = existsSync(websiteBuilderV2BridgePath) ? readFileSync(websiteBuilderV2BridgePath, 'utf8') : '';
const builderComponentsPanel = existsSync(builderComponentsPanelPath) ? readFileSync(builderComponentsPanelPath, 'utf8') : '';
const websiteBuilderV2Css = existsSync(websiteBuilderV2CssPath) ? readFileSync(websiteBuilderV2CssPath, 'utf8') : '';
const editorNativePatch = existsSync(editorNativePatchPath) ? readFileSync(editorNativePatchPath, 'utf8') : '';
const editorBatch = existsSync(editorBatchPath) ? readFileSync(editorBatchPath, 'utf8') : '';
const editorOperationPolicy = existsSync(editorOperationPolicyPath) ? readFileSync(editorOperationPolicyPath, 'utf8') : '';
const editorCommandAdapters = existsSync(editorCommandAdaptersPath) ? readFileSync(editorCommandAdaptersPath, 'utf8') : '';
const editorNativeOperation = existsSync(editorNativeOperationPath) ? readFileSync(editorNativeOperationPath, 'utf8') : '';
const editorModel = existsSync(editorModelPath) ? readFileSync(editorModelPath, 'utf8') : '';
const editorSymbolCommands = existsSync(editorSymbolCommandsPath) ? readFileSync(editorSymbolCommandsPath, 'utf8') : '';
const editorPayloadSafety = existsSync(editorPayloadSafetyPath) ? readFileSync(editorPayloadSafetyPath, 'utf8') : '';
const editorDesignCommands = existsSync(editorDesignCommandsPath) ? readFileSync(editorDesignCommandsPath, 'utf8') : '';
const editorInspectorOperation = existsSync(editorInspectorOperationPath) ? readFileSync(editorInspectorOperationPath, 'utf8') : '';
const editorInspectorModel = existsSync(editorInspectorModelPath) ? readFileSync(editorInspectorModelPath, 'utf8') : '';
const editorValueSafety = existsSync(editorValueSafetyPath) ? readFileSync(editorValueSafetyPath, 'utf8') : '';
const editorAIOperationContext = existsSync(editorAIOperationContextPath) ? readFileSync(editorAIOperationContextPath, 'utf8') : '';
const editorAINativeBridge = existsSync(editorAINativeBridgePath) ? readFileSync(editorAINativeBridgePath, 'utf8') : '';
const editorNativeProjectPatch = existsSync(editorNativeProjectPatchPath) ? readFileSync(editorNativeProjectPatchPath, 'utf8') : '';
const editorAIWorkingProject = existsSync(editorAIWorkingProjectPath) ? readFileSync(editorAIWorkingProjectPath, 'utf8') : '';

check('No unresolved merge markers in Website Builder', !/(<<<<<<<|=======|>>>>>>>)/.test(builder));
check('Website Builder source has no mojibake markers', !/[ÂÃØÙð]|â(?:€™|€œ|€|€”|†|€¢|€¦|œ|˜|Œ|ˆ|ž|™)/.test(builder));
check('Published HTML never exposes direct Supabase Storage URLs', !builder.includes('/storage/v1/object/public/published-sites'));
check('Publish and preview use canonical Tayar renderer URLs', builder.includes('buildPublishedSiteBaseUrl') && builder.includes('buildPreviewSiteBaseUrl') && builder.includes('buildPublishedSiteUrl'));
check('Live verification checks rendered HTML content type', builder.includes("contentType.includes('text/html')") && builder.includes('verifyPublishedRoute'));
check('Legacy published URLs are normalized', publishedUrlHelper.includes('normalizePublishedSiteUrl') && publishedUrlHelper.includes('/storage/v1/object/public/published-sites/'));
check('Published-site proxy forces inline HTML rendering', publishedProxy.includes("'text/html; charset=utf-8'") && publishedProxy.includes("'Content-Disposition', 'inline'"));
check('Published-site proxy sandboxes customer HTML from Tayar auth origin', publishedProxy.includes('sandbox allow-scripts') && !publishedProxy.includes('allow-same-origin'));
check('Vercel routes live and preview websites through the proxy', vercelConfig.includes('"/site/:ownerId/:projectId/:file*"') && vercelConfig.includes('"/preview/:ownerId/:projectId/:previewToken/:file*"'));
check('Service worker never caches published sites or previews', serviceWorker.includes("url.pathname.startsWith('/site/')") && serviceWorker.includes("url.pathname.startsWith('/preview/')"));
check('Published-site cleanup paginates beyond 100 files', publishedStorageCore.includes('listAllPublishedSiteFiles') && publishedStorageCore.includes('offset += pageSize') && publishedStorageCore.includes('Published-site folder contains too many files to process safely.'));
check('Preview HTML cannot submit real leads', builder.includes('leadProjectId: trackAnalytics ? cloudProjectId : null'));
check('Imported backups detach old publication identity', builder.includes("const importedProject = {") && builder.includes("previewCreatedAt: null") && builder.includes("lastPublishedFingerprint: ''") && builder.includes("history: []"));
check('Workspace duplication detaches Website Builder publication identity', workspaceProjects.includes('sanitizedDuplicateContent(project)') && workspaceProjects.includes("publishedUrl: ''") && workspaceProjects.includes("previewToken: ''") && workspaceProjects.includes("lastPublishedVersionId: null") && workspaceProjects.includes("history: []"));
check('Public website ingestion requires a published project', runtimeHardeningMigration.includes("v_project_status <> 'completed'") && runtimeHardeningMigration.includes('trg_enforce_published_website_lead_ingestion') && runtimeHardeningMigration.includes('trg_enforce_published_website_analytics_ingestion'));
check('Shared live verification uses the project owner storage prefix', builder.includes('const path = `${activeProjectOwnerId}/${cloudProjectId}/index.html`;') && builder.includes('publicWebsiteUrl(cloudProjectId, activeProjectOwnerId)'));
check('Shared project recovery uses the actual project owner', builder.includes('const ownerId = project.user_id || user.id;') && builder.includes('publicWebsiteUrl(project.id, ownerId)'));
check('Lead operations require owner or workspace admin', builder.includes('Lead inbox is available to project owners and workspace admins.') && sharedRuntimeMigration.includes("IN ('owner', 'admin')"));
check('Analytics is available to shared editors without exposing leads', builder.includes('Analytics is available to project owners, admins, and editors.') && sharedRuntimeMigration.includes("IN ('owner', 'admin', 'editor')"));
check('Shared release history is read-only while rollback stays owner-only', sharedRuntimeMigration.includes("IN ('owner', 'admin', 'editor', 'viewer')") && builder.includes('Only the project owner can rollback a published release.') && builder.includes('Only the project owner can delete release archives.'));
check('Core V3 centralizes project access and owner resolution', projectAccessCore.includes('resolveEditorProjectOwnerId') && projectAccessCore.includes('normalizeEditorProjectAccess') && builder.includes("from './core/editor-project-access'"));
check('Core V3 centralizes published storage cleanup', publishedStorageCore.includes('publishedSiteFilePaths') && publishedStorageCore.includes('removePublishedSiteFiles') && publishedWebsiteService.includes("from '../core/editor-published-storage'") && builder.includes("from './services/publishedWebsiteService'"));
check('Shared lead policy keeps row ownership tied to the website owner', sharedRuntimeMigration.includes('website_leads.project_id'));
check('Recovery snapshot storage is enabled', projectLifecycleCore.includes('RECOVERY_STORAGE_KEY') && projectLifecycleCore.includes('saveRecoveryWebsiteProject') && builder.includes("from './core/editor-project-lifecycle'"));
check('Project load normalization is extracted from the builder', projectNormalization.includes('normalizeWebsiteProjectLoad') && builder.includes("from './core/project-normalization'"));
check('Cloud save/create is extracted from the builder', projectCloudService.includes('createWebsiteProjectInCloud') && projectCloudService.includes('updateWebsiteProjectInCloud') && builder.includes("from './services/projectCloudService'"));
check('Cloud project identity survives local re-entry', builder.includes('cloudProjectId?: string | null') && builder.includes('cloudProjectId,\n      siteName') && builder.includes('saveActiveWebsiteProjectId(savedIdentity)') && builder.includes('cloudProjectId: project.id'));
check('Autosave cannot create a duplicate draft while an existing identity reconnects', builder.includes('const preservedProjectId = projectId || loadActiveWebsiteProjectId()') && builder.includes('Tayar will not create a duplicate draft while its saved identity is available.'));
check('Duplicate and imported projects detach source cloud identity', builder.includes('cloudProjectId: null,\n      siteName: duplicateTitle') && builder.includes('cloudProjectId: null,\n          publishedUrl:'));
check('Publish and unpublish storage writes are extracted', publishedWebsiteService.includes('replacePublishedWebsiteFiles') && publishedWebsiteService.includes('removePublishedWebsiteFiles') && builder.includes("from './services/publishedWebsiteService'"));
check('Autosave policy and history entry creation are extracted', autosavePolicy.includes('decideEditorAutosave') && autosavePolicy.includes('createProjectHistoryEntry') && builder.includes("from './core/editor-autosave-policy'"));
check('Reusable section cloud mutations are extracted', reusableSectionService.includes('listReusableSectionsInCloud') && reusableSectionService.includes('saveReusableSectionInCloud') && reusableSectionService.includes('deleteReusableSectionInCloud') && builder.includes("from './services/reusableSectionService'"));
check('Publish version create/list/delete is extracted', publishVersionService.includes('createWebsitePublishVersion') && publishVersionService.includes('listWebsitePublishVersions') && publishVersionService.includes('deleteWebsitePublishVersionArchive') && builder.includes("from './services/publishVersionService'"));
check('Lead CRUD is extracted', websiteLeadService.includes('listWebsiteLeads') && websiteLeadService.includes('updateWebsiteLeadStatus') && websiteLeadService.includes('deleteWebsiteLead') && builder.includes("from './services/websiteLeadService'"));
check('Analytics querying and summary are extracted', websiteAnalyticsService.includes('listWebsiteAnalyticsEvents') && websiteAnalyticsSummary.includes('summarizeWebsiteAnalytics') && builder.includes("from './services/websiteAnalyticsService'") && builder.includes("from './core/website-analytics-summary'"));
check('Media storage operations are extracted', websiteMediaService.includes('listWebsiteMediaFiles') && websiteMediaService.includes('uploadWebsiteMediaFile') && websiteMediaService.includes('deleteWebsiteMediaFile') && builder.includes("from './services/websiteMediaService'"));
check('Project access RPC is extracted', websiteAccessService.includes('getWebsiteProjectTeamAccess') && builder.includes("from './services/websiteAccessService'"));
check('Billing RPC is extracted', websiteBillingService.includes('getWebsiteBuilderBillingState') && builder.includes("from './services/websiteBillingService'"));
check('Project slug and language identifiers are centralized', projectIdentifiers.includes('normalizeSlug') && projectIdentifiers.includes('normalizePageLanguage') && projectIdentifiers.includes('PAGE_LANGUAGE_LABELS') && builder.includes("from './core/project-identifiers'") && projectNormalization.includes("from './project-identifiers'"));
check('Release metrics are extracted', projectReleaseMetrics.includes('buildProjectSnapshotDiffSummary') && builder.includes("from './core/project-release-metrics'"));
check('Lead parsing utilities are extracted', websiteLeadUtils.includes('getWebsiteLeadPhone') && websiteLeadUtils.includes('getWebsiteLeadSource') && builder.includes("from './core/website-lead-utils'"));
check('Delivery config defaults and normalization are extracted', deliveryConfig.includes('DEFAULT_DELIVERY_CONFIG') && deliveryConfig.includes('normalizeDeliveryConfig') && builder.includes("from './core/delivery-config'"));
check('Published, preview and release bundles validate index.html before storage writes', publishedSiteValidation.includes('assertValidPublishedWebsiteBundle') && publishedSiteValidation.includes('isValidPublishedHtml') && (publishedWebsiteService.match(/assertValidPublishedWebsiteBundle\(files\)/g) || []).length >= 3 && publishedWebsiteService.includes('const verifiedHtml = await verifiedIndex.text()') && publishedWebsiteService.includes('await removePublishedSiteFiles(publishedSiteStorage, stalePaths)'));
check('Builder has no direct Supabase calls', !builder.includes("from '@/lib/supabase'") && !/\bsupabase\b/.test(builder) && !builder.includes(".from('projects')") && !builder.includes(".from('website_leads')") && !builder.includes(".from('website_analytics_events')") && !builder.includes(".from('website_publish_versions')") && !builder.includes(".from('website-media')") && !builder.includes(".from('published-sites')"));
check('Online/offline state is monitored', builder.includes("window.addEventListener('offline'"));
check('Failed cloud sync is tracked', builder.includes('cloudSyncFailed'));
check('Cloud mutations retry transient failures', projectCloudService.includes('retryCloudOperation') && builder.includes('createWebsiteProjectInCloud') && builder.includes('updateWebsiteProjectInCloud'));
check('Publish preflight blocks critical audit errors', builder.includes('Publish preflight blocked: fix'));
check('Publish preflight blocks offline deploys', builder.includes('Publish preflight blocked: you are offline'));
check('V2 Publish button uses hard operational blockers', builder.includes("!user ? 'Sign in before publishing.'") && builder.includes("!networkOnline ? 'Reconnect before publishing.'"));
check('Publish handler does not require non-essential launch checks', !builder.includes('Publish preflight blocked: ${v1LaunchStatus.blockers[0]') && builder.includes('Release history was skipped'));
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
check('AI builder is first-class in the Add panel', builder.includes("Tayar AI Builder") && builder.includes(">Agent<") && builder.includes("Build with Tayar Agent") && builder.includes("AI creates and patches real Tayar pages and sections"));
check('AI builder supports targeted follow-up edits', builder.includes("Apply AI change") && builder.includes("applyAIChange") && builder.includes("update_section") && builder.includes("remove_section"));
check('AI builder follow-up edits are undoable', builder.includes("Undo AI change") && builder.includes("setAiUndoSnapshot(snapshot)") && builder.includes("undoLastAIChange"));
check('AI builder can preserve unrelated content while patching', builder.includes("JSON.parse(JSON.stringify(currentPages))") && builder.includes("resolvePageIndex") && builder.includes("resolveSectionIndex"));
check('AI builder can generate and persist targeted images', builder.includes("generate_image") && builder.includes("requestGeneratedImage") && builder.includes("Media Library"));
check('Tayar Agent performs full build preparation', builder.includes("Build with Tayar Agent") && builder.includes("agentImagesGenerated") && builder.includes("nextGeneratedSeo"));
check('AI quality check can review and fix safe issues', builder.includes("AI Quality Check") && builder.includes("runAIQualityCheck") && builder.includes("Fix safe issues with AI"));
check('AI quality context includes SEO header and element details', builder.includes('selection: {') && builder.includes('responsive: element.responsive || {}') && builder.includes('seoTitle: page.seoTitle') && builder.includes('showCta: headerConfig.showCta'));
check('AI patches can repair SEO and header CTA', builder.includes("update_seo") && builder.includes("update_header") && builder.includes('setSeo(nextSeo)') && builder.includes('setHeaderConfig(nextHeaderConfig)'));
check('AI builder can add pages without rebuilding the site', builder.includes("add_page") && builder.includes('sourcePage') && builder.includes('billingEntitlements.maxPages'));
check('AI builder protects home and final page from deletion', builder.includes("remove_page") && builder.includes('targetPage.id === nextHomePageId') && builder.includes('nextPages.length <= 1'));
check('AI builder can switch the homepage without rebuilding', builder.includes("set_home_page") && builder.includes('nextHomePageId') && builder.includes('setHomePageId(nextHomePageId)'));
check('AI builder can reorder pages and sections safely', builder.includes("move_page") && builder.includes("move_section") && builder.includes('beforePageId') && builder.includes('beforeSectionId'));
check('AI builder can patch selected elements by device', builder.includes("update_element") && builder.includes('operation.elementId') && builder.includes("operation.device === 'mobile'") && builder.includes('[responsiveDevice]'));
check('AI builder exposes mobile responsive quick prompts', builder.includes('Make selected heading smaller on mobile') && builder.includes('Make selected button full width on mobile'));
check('AI builder can add remove and move elements safely', builder.includes("add_element") && builder.includes("remove_element") && builder.includes("move_element") && builder.includes('allowedElementTypes'));
check('AI element structure protects final and symbol-linked elements', builder.includes('targetSection.elements.length <= 1') && builder.includes('targetElement.symbolId') && builder.includes('destinationElement.symbolId'));
check('AI builder can patch section spacing and height by device', builder.includes('sectionMinHeight') && builder.includes('sectionPaddingY') && builder.includes('sectionLayoutGap') && builder.includes('targetSection.responsive?.[responsiveDevice]'));
check('AI builder can change section layout and content width', builder.includes('sectionLayout?: SectionLayout') && builder.includes('sectionContentWidth?: SectionContentWidth') && builder.includes('nextLayout: SectionLayout'));
check('AI builder can place selected elements in columns', builder.includes('elementColumn?: number') && builder.includes('elementColumnSpan?: number') && builder.includes('requestedColumn'));
check('AI builder can create and restyle native containers', builder.includes("add_container") && builder.includes("update_container") && builder.includes("assign_element_container") && builder.includes('containerBackgroundColor'));
check('AI builder can style sections with gradient image and overlay controls', builder.includes('sectionBackgroundMode') && builder.includes('sectionGradientAngle') && builder.includes('sectionOverlayOpacity') && builder.includes('sectionRadius'));
check('AI builder can add hover and reveal motion without custom code', builder.includes('elementHoverScale') && builder.includes('elementAnimation') && builder.includes('animationOnce'));
check('AI builder can edit contact form structure and success behavior', builder.includes("update_form") && builder.includes("add_form_field") && builder.includes("update_form_field") && builder.includes("remove_form_field") && builder.includes("move_form_field"));
check('AI builder sends containers and forms in edit context', builder.includes('containers: (section.containers || [])') && builder.includes("form: section.type === 'contact'"));
check('AI builder duplicates content without reusing source identities', builder.includes("duplicate_page") && builder.includes("duplicate_section") && builder.includes("duplicate_element") && builder.includes('cloneElementForAI') && builder.includes('symbolId: undefined'));
check('AI builder edits global typography spacing and theme tokens', builder.includes("update_theme") && builder.includes('themeContentWidth') && builder.includes('themeSectionSpacing') && editorAINativeBridge.includes("['Inter', 'Arial', 'Georgia', 'Trebuchet MS', 'Courier New', 'system-ui']"));
check('AI builder edits complete header behavior and styling', builder.includes('headerSticky') && builder.includes('headerMobileMenu') && builder.includes('headerBackgroundColor') && builder.includes('headerNavGap'));
check('AI builder exposes clone and global design quick prompts', builder.includes('Duplicate selected element and keep it editable') && builder.includes('Make global typography more premium') && builder.includes('Make the header compact and sticky'));
check('Manual builder page controls survive AI upgrades', builder.includes('function addPage()') && builder.includes('function duplicateActivePage()') && builder.includes('function movePage(') && builder.includes('function deleteActivePage()'));
check('Manual builder edit and history controls survive AI upgrades', builder.includes('function updateSelected(') && builder.includes('function undo()') && builder.includes('function redo()') && builder.includes('function updateSelectedElement('));
check('V2 history entries restore real editor checkpoints', builder.includes('function restoreEditHistoryEntry(entryId: string)') && builder.includes('onRestoreHistoryEntry={restoreEditHistoryEntry}') && builderHistoryPanel.includes('onRestoreEntry?.(entry.id)') && builderPanelRouter.includes('onRestoreEntry={props.onRestoreHistoryEntry}') && builderV2NativeBridge.includes('props.onRestoreHistoryEntry') && websiteBuilderV2Bridge.includes('onRestoreHistoryEntry'));
check('V2 Components insert at the selected editor location', builder.includes('const targetContainerId =') && builder.includes('selectedElement?.containerId') && builder.includes('selectedContainerId') && builder.includes('elements.splice(insertAt, 0, instance)'));
check('V2 Components panel explains linked behavior', builderComponentsPanel.includes('Components are reusable linked elements') && builderComponentsPanel.includes('Create component') && builderComponentsPanel.includes('Detach selected'));
check('V2 native operations round-trip global editor state', builder.includes('theme: {\n            ...theme,') && builder.includes('headerConfig: {\n            ...headerConfig,') && builder.includes('setHomePageId(nextHomePageId)') && builder.includes('setTheme(nextTheme)') && builder.includes('setSeo(nextSeo)') && builder.includes('setHeaderConfig(nextHeaderConfig)'));
check('V2 native operations carry reusable component catalog through EditorStore', builder.includes('symbols:\n            JSON.parse(') && builder.includes('const nextSymbols =') && builder.includes('setSymbols(nextSymbols)'));
check('V2 native homepage result is validated against surviving pages', builder.includes('const requestedHomePageId =') && builder.includes('nextPages.some(') && builder.includes("nextPages[0]?.id || ''"));
check('Native editor batches are atomic transactions', editorBatch.includes('applyEditorTransaction(current') && editorBatch.includes('for (const command of resolved)') && editorBatch.includes('project: clone(current)'));
check('Native patches validate the final project before commit', editorNativePatch.includes('executeEditorSessionBatch') && editorNativePatch.includes('validateEditorProject(candidate, options.limits)'));
check('Native preflight tracks removed containers and form fields', editorOperationPolicy.includes("operation.action === 'remove_container'") && editorOperationPolicy.includes("operation.action === 'remove_form_field'") && editorOperationPolicy.includes('referencedTargetKeys(operation)'));
check('Native element updates cannot bypass container assignment rules', editorOperationPolicy.includes('cannot change container assignment through update_element') && editorCommandAdapters.includes('Container not found:'));
check('Native identity registry spans project-wide structural IDs', editorModel.includes('export function editorProjectIdentitySet') && editorModel.includes("kind === 'section'") && editorModel.includes("kind === 'element'") && editorModel.includes("kind === 'container'") && editorModel.includes("kind === 'form-field'"));
check('Native inserts reject project-wide identity collisions before commit', editorCommandAdapters.includes("assertIdentityIdsAvailable(draft, 'section'") && editorCommandAdapters.includes("assertIdentityIdsAvailable(draft, 'element'") && editorCommandAdapters.includes("assertIdentityIdsAvailable(draft, 'container'") && editorCommandAdapters.includes("assertIdentityIdsAvailable(draft, 'form-field'"));
check('Native duplicate IDs retry against the live draft registry', editorCommandAdapters.includes('createCollisionSafeCloneIdFactory') && editorCommandAdapters.includes('for (let attempt = 0; attempt < 100; attempt += 1)') && editorCommandAdapters.includes('hasExplicitPosition(position)'));
check('Native move positions reject ambiguous and self-referential anchors', editorCommandAdapters.includes('Position must use exactly one of beforeId, afterId, or index') && editorCommandAdapters.includes('Move target cannot reference the moving ID'));
check('Native preflight blocks cross-operation identity and position collisions', editorOperationPolicy.includes('createdIdentityEntries(operation)') && editorOperationPolicy.includes('created.get(key)') && editorOperationPolicy.includes('positionTargetKey(operation, targetId)') && editorOperationPolicy.includes('validatePosition(operation, prefix, errors)'));
check('Reusable component insertion retries generated identity collisions', editorSymbolCommands.includes('nextUniqueGeneratedId') && editorSymbolCommands.includes("nextUniqueGeneratedId(draft, 'element'") && editorSymbolCommands.includes("nextUniqueGeneratedId(draft, 'symbol'"));
check('Native reference preflight receives the current project snapshot', editorNativePatch.includes('project: state.project') && editorOperationPolicy.includes('project?: EditorProjectLike'));
check('Native source references are validated against sequential project state', editorOperationPolicy.includes("label: 'sourceElementId'") && editorOperationPolicy.includes("label: 'sourceSectionId'") && editorOperationPolicy.includes('removeSectionFromState') && editorOperationPolicy.includes('removePageFromState'));
check('Native symbol references cannot be missing or forward-only', editorOperationPolicy.includes("kind: 'symbol', id: operation.symbolId") && editorOperationPolicy.includes("label: 'element.symbolId'") && editorOperationPolicy.includes("label: 'section element symbolId'") && editorOperationPolicy.includes("label: 'page element symbolId'"));
check('Native runtime structural payloads are validated before adaptation', editorOperationPolicy.includes('validateOperationPayloadShape') && editorOperationPolicy.includes('validatePagePayload') && editorOperationPolicy.includes('validateSectionPayload') && editorOperationPolicy.includes('section.elements must be a non-empty array'));
check('Native update operations cannot smuggle structural identities', editorOperationPolicy.includes('cannot change page identity') && editorOperationPolicy.includes('cannot change section identity') && editorOperationPolicy.includes('cannot change container identity') && editorOperationPolicy.includes('cannot change form-field identity'));
check('Invalid native operations do not mutate simulated reference state', editorOperationPolicy.includes('operationErrorStart') && editorOperationPolicy.includes('errors.length === operationErrorStart'));
check('Native position IDs fail safely on malformed runtime values', editorOperationPolicy.includes('position target ID must be non-blank') && editorOperationPolicy.includes('hasValidId(anchor)'));
check('Native container detach remains compatible while real container references stay strict', editorOperationPolicy.includes("operation.action === 'assign_element_container'") && editorOperationPolicy.includes("value === ''") && editorOperationPolicy.includes("operation.containerId !== ''"));
check('Native adapter reference parsing rejects non-string runtime IDs safely', editorNativeOperation.includes("typeof value !== 'string'") && editorNativeOperation.includes('cannot contain surrounding whitespace'));
check('Native payload safety rejects prototype-pollution and accessor keys', editorPayloadSafety.includes("'__proto__'") && editorPayloadSafety.includes("'prototype'") && editorPayloadSafety.includes("'constructor'") && editorPayloadSafety.includes('cannot use accessor properties'));
check('Native payload safety rejects non-finite and non-JSON runtime values', editorPayloadSafety.includes('contains a non-finite number') && editorPayloadSafety.includes("typeof candidate === 'bigint'") && editorPayloadSafety.includes("typeof candidate === 'function'") && editorPayloadSafety.includes("typeof candidate === 'symbol'") && editorPayloadSafety.includes('contains unsupported ${typeof candidate} data') && editorPayloadSafety.includes('contains a circular reference'));
check('Native payload safety bounds nesting collections and string volume', editorPayloadSafety.includes('maxDepth: 12') && editorPayloadSafety.includes('maxNodes: 5000') && editorPayloadSafety.includes('maxArrayLength: 500') && editorOperationPolicy.includes('aggregate string payload limit'));
check('Native change contracts reject unsupported mutation keys', editorOperationPolicy.includes('CHANGE_KEYS_BY_ACTION') && editorOperationPolicy.includes('contains unsupported key:') && editorOperationPolicy.includes('ELEMENT_STYLE_KEYS') && editorOperationPolicy.includes('SECTION_RESPONSIVE_KEYS'));
check('Native runtime actions and sources are explicitly allowlisted', editorOperationPolicy.includes('VALID_NATIVE_ACTIONS') && editorOperationPolicy.includes('source must be manual, ai, or system'));
check('Native command adapters sanitize payloads even without preflight', editorCommandAdapters.includes('safeEditorPayloadRecord') && editorCommandAdapters.includes('cloneSafeEditorPayload') && editorCommandAdapters.includes("'theme changes'") && editorCommandAdapters.includes("'container changes'"));
check('Native duplicate elements cannot restore symbol or container linkage through changes', editorCommandAdapters.includes("mergeWithoutIdentity(clone, changes, ['symbolId', 'containerId'])"));
check('Native duplicate sections reject form-field replacement payloads', editorOperationPolicy.includes('SECTION_DUPLICATE_CHANGE_KEYS') && editorOperationPolicy.includes("key !== 'formFields'"));
check('Native restyle mutations sanitize changes and keep aliases out of theme', editorDesignCommands.includes("safeEditorPayloadRecord(changes, 'restyle changes')") && editorDesignCommands.includes('accentColor: _accentColor') && editorDesignCommands.includes('cloneEditorValue(themeChanges)'));
check('Inspector payload paths block prototype-pollution segments', editorInspectorOperation.includes('editorPayloadHasForbiddenKey(part)') && editorInspectorModel.includes('editorPayloadHasForbiddenKey(part)') && editorInspectorOperation.includes('parts.length > 4'));
check('Native semantic preflight validates partial changes by action', editorOperationPolicy.includes('SEMANTIC_CHANGE_KIND_BY_ACTION') && editorOperationPolicy.includes('inspectEditorSemanticRecord') && editorOperationPolicy.includes('inspectEditorPageSemantic') && editorOperationPolicy.includes('inspectEditorSectionSemantic'));
check('Native semantic values enforce real editor enum contracts', editorValueSafety.includes('SECTION_LAYOUTS') && editorValueSafety.includes('ELEMENT_TYPES') && editorValueSafety.includes('FORM_FIELD_TYPES') && editorValueSafety.includes('FONT_FAMILIES'));
check('Native semantic values enforce editor numeric ranges', editorValueSafety.includes("'fontSize', 8, 160") && editorValueSafety.includes("'positionX', -2000, 2000") && editorValueSafety.includes("'contentWidth', 720, 1440") && editorValueSafety.includes("'navGap', 4, 48"));
check('Native semantic URLs reject unsafe schemes while keeping editor links', editorValueSafety.includes("parsed.protocol === 'http:' || parsed.protocol === 'https:'") && editorValueSafety.includes("/^(?:mailto|tel):/i") && editorValueSafety.includes("value.startsWith('#')"));
check('Native semantic colors distinguish theme tokens from element surfaces', editorValueSafety.includes('HEX_6_PATTERN') && editorValueSafety.includes('CSS_COLOR_PATTERN') && editorValueSafety.includes("'transparent'"));
check('Native semantic content preserves multiline text but keeps URLs control-free', editorValueSafety.includes('URL_CONTROL_CHARACTER_PATTERN') && editorValueSafety.includes('\\u000B') && editorValueSafety.includes('hasSafeUrlCharacters'));
check('Native command adapters enforce semantic values without preflight', editorCommandAdapters.includes('assertEditorSemanticRecord') && editorCommandAdapters.includes('assertEditorPageSemantic') && editorCommandAdapters.includes('assertEditorSectionLikeSemantic') && editorCommandAdapters.includes('assertEditorElementLikeSemantic'));
check('Native semantic form replacements require complete fields', editorValueSafety.includes("for (const requiredKey of ['name', 'label', 'type', 'required'])") && editorValueSafety.includes('formFields'));
check('Native restyle path validates semantic values before mutation', editorDesignCommands.includes("assertEditorSemanticRecord('restyle', safeChanges, 'restyle changes')"));
check('AI async context binds results to route project owner and load sequence', editorAIOperationContext.includes('routeProjectId') && editorAIOperationContext.includes('projectId') && editorAIOperationContext.includes('ownerId') && editorAIOperationContext.includes('loadSequence'));
check('AI async context can require unchanged editor content and selection', editorAIOperationContext.includes('editableFingerprint') && editorAIOperationContext.includes('requireEditableFingerprint') && editorAIOperationContext.includes('requireSelection') && editorAIOperationContext.includes('activePageId'));
check('Website Builder keeps a live memoized AI context snapshot', builder.includes('currentAIEditableFingerprint = useMemo') && builder.includes('aiEditorContextRef.current = currentAIEditorContext') && builder.includes('captureAIEditorContext()'));
check('AI project-load race is closed with direct ref checks', builder.includes('projectLoadSequenceRef.current !== expected.loadSequence') && builder.includes('activeUserIdRef.current !== expected.userId'));
check('Whole-site AI generation rejects stale editable project results', builder.includes('async function generateWithAI') && builder.includes('aiEditorContextIsCurrent(operationContext, false)'));
check('Targeted AI edits reject stale selection and content results', builder.includes('async function applyAIChange') && builder.includes('aiEditorContextIsCurrent(operationContext, true)'));
check('AI patch image generation rechecks context immediately after await', builder.includes('const generatedImage = await requestGeneratedImage(imagePrompt);\n            if (!operationCanApply()) return;'));
check('AI image and image-prompt operations require the original selection context', builder.includes('async function generateRealImage') && builder.includes('async function generateImagePrompt') && builder.match(/aiEditorContextIsCurrent\(operationContext, true\)/g)?.length >= 3);
check('AI quality reviews are invalidated when the editor changes before fixes', builder.includes('aiQualityReviewContextRef.current = operationContext') && builder.includes('The website changed after this quality review'));
check('AI undo snapshots cannot restore into another project lifecycle', builder.includes('aiUndoContextRef.current = operationContext') && builder.includes('aiProjectIdentityIsCurrent(undoContext)'));
check('AI busy cleanup uses request ownership instead of stale apply context', builder.includes('if (operationIsLatest()) {\n        setAiBusy(false);') && builder.includes('if (operationIsLatest()) setAiQualityBusy(false)'));
check('AI lifecycle resets stale undo and quality contexts', builder.includes('aiUndoContextRef.current = null') && builder.includes('aiQualityReviewContextRef.current = null'));
check('Plain native project patches reuse the canonical transaction path', editorNativeProjectPatch.includes('createEditorSession(project') && editorNativeProjectPatch.includes('applyEditorNativePatch(') && editorNativeProjectPatch.includes('result.state.project'));
check('AI working project executor isolates snapshot construction from Website Builder state', editorAIWorkingProject.includes('createWorkingProject(') && editorAIWorkingProject.includes('projectToWorkingState(') && editorAIWorkingProject.includes('applyEditorNativeProjectPatch('));
check('AI global bridge maps legacy theme SEO and header aliases into native fields', editorAINativeBridge.includes("'update_theme'") && editorAINativeBridge.includes("'update_seo'") && editorAINativeBridge.includes("'update_header'") && editorAINativeBridge.includes("'themeContentWidth'") && editorAINativeBridge.includes("'seoKeywords'") && editorAINativeBridge.includes("'headerNavGap'"));
check('AI global bridge rejects unsafe links and preserves empty logo compatibility', editorAINativeBridge.includes('safeLink(') && editorAINativeBridge.includes('/^https?:\\/\\//i') && editorAINativeBridge.includes("safeMediaUrl(changes.headerLogoUrl, 1000, false)"));
check('AI global edits execute through native project transactions', builder.includes('convertLegacyAIGlobalOperationToNative') && builder.includes('applyEditorAIWorkingNativeOperations(') && builder.includes('applyAIGlobalNativeOperation('));
check('Legacy AI global mutation branches are removed after native routing', !builder.includes("if (operation.action === 'update_theme')") && !builder.includes("if (operation.action === 'update_seo')") && !builder.includes("if (operation.action === 'update_header')"));
check('AI native bridge failures stay scoped as patch warnings', builder.includes('nativeBridgeWarnings') && builder.includes('if (!nativeResult.ok)') && builder.includes('...nativeBridgeWarnings'));
check('AI page bridge maps remove home and move operations into native commands', editorAINativeBridge.includes('PAGE_NATIVE_AI_ACTIONS') && editorAINativeBridge.includes("'remove_page'") && editorAINativeBridge.includes("'set_home_page'") && editorAINativeBridge.includes("'move_page'") && editorAINativeBridge.includes('convertLegacyAIPageOperationToNative'));
check('AI page moves translate before and after anchors into native positions', editorAINativeBridge.includes('{ beforeId }') && editorAINativeBridge.includes('{ afterId }'));
check('Website Builder routes safe AI page operations through the shared working executor', builder.includes('applyAIPageNativeOperation(') && builder.includes('convertLegacyAIPageOperationToNative') && builder.includes('applyAIWorkingNativeOperation('));
check('AI page bridge preserves legacy skip guards before native execution', builder.includes('nextPages.length <= 1') && builder.includes('pageId === nextHomePageId') && builder.includes('destinationId ===') && builder.includes('destinationExists'));
check('Legacy AI remove home and move page mutation branches are removed', !builder.includes("if (operation.action === 'remove_page')") && !builder.includes("if (operation.action === 'set_home_page')") && !builder.includes("if (operation.action === 'move_page')"));
check('AI page creation keeps legacy normalization but commits through native add_page', builder.includes("if (operation.action === 'add_page')") && builder.includes('const createdPage: WebsitePage') && builder.includes("action: 'add_page'"));
check('AI duplicate page normalization remains legacy for compatibility with historical styles', builder.includes("if (operation.action === 'duplicate_page')") && builder.includes('cloneSectionForAI'));
check('AI working native executor supports atomic operation batches', editorAIWorkingProject.includes('applyEditorAIWorkingNativeOperations') && editorAIWorkingProject.includes('operations.length') && editorAIWorkingProject.includes('maxOperations: 1'));
check('AI structural bridge covers section element container and form removals or moves', editorAINativeBridge.includes('STRUCTURAL_NATIVE_AI_ACTIONS') && editorAINativeBridge.includes("'remove_section'") && editorAINativeBridge.includes("'move_section'") && editorAINativeBridge.includes("'remove_element'") && editorAINativeBridge.includes("'move_element'") && editorAINativeBridge.includes("'remove_container'") && editorAINativeBridge.includes("'assign_element_container'") && editorAINativeBridge.includes("'remove_form_field'") && editorAINativeBridge.includes("'move_form_field'"));
check('AI container removal is translated into atomic detach then remove operations', editorAINativeBridge.includes('detachElementIds') && editorAINativeBridge.includes("action: 'assign_element_container'") && editorAINativeBridge.includes("containerId: ''") && editorAINativeBridge.includes("action: 'remove_container'") && builder.includes('applyAIWorkingNativeOperations('));
check('AI structural routing preserves linked-component element protections', builder.includes('if (!target || target.symbolId)') && builder.includes('if (!source || source.symbolId)') && builder.includes('destination.symbolId') && builder.includes('if (!element || element.symbolId)'));
check('AI structural routing preserves final section and final element protections', builder.includes('page.sections.length <= 1') && builder.includes('section.elements.length <= 1'));
check('AI form-field structural routing falls back to legacy defaults when fields are not materialized', builder.includes("section.type !== 'contact'") && builder.includes('!Array.isArray(\n              section.formFields,') && builder.includes("if (operation.action === 'remove_form_field')") && builder.includes("if (operation.action === 'move_form_field')"));
check('Legacy AI section element and container mutation branches are removed after native routing', !builder.includes("if (operation.action === 'remove_section')") && !builder.includes("if (operation.action === 'move_section')") && !builder.includes("if (operation.action === 'remove_element')") && !builder.includes("if (operation.action === 'move_element')") && !builder.includes("if (operation.action === 'remove_container')") && !builder.includes("if (operation.action === 'assign_element_container')"));
check('AI symbol detach is routed through the structural native bridge', editorAINativeBridge.includes("'detach_symbol'") && editorAINativeBridge.includes("action: 'detach_symbol'") && !builder.includes("if (operation.action === 'detach_symbol')"));
check('AI page updates use native semantic validation after legacy slug normalization', editorAINativeBridge.includes('convertLegacyAIPageUpdateOperationToNative') && editorAINativeBridge.includes(".replace(/[^a-z0-9]+/g, '-')") && builder.includes('convertLegacyAIPageUpdateOperationToNative') && !builder.includes('const nextName = typeof changes.name'));
check('AI container and materialized form updates translate legacy aliases to native changes', editorAINativeBridge.includes('convertLegacyAIUpdateOperationToNative') && editorAINativeBridge.includes('containerPadding') && editorAINativeBridge.includes('formFieldPlaceholder') && builder.includes('applyAISectionScopedUpdateNativeOperation'));
check('Legacy AI update_container branch is removed while old form defaults retain fallback', !builder.includes("if (operation.action === 'update_container')") && builder.includes("if (operation.action === 'update_form_field')"));
check('AI container creation is an atomic native add plus optional assignment', editorAINativeBridge.includes('convertLegacyAIAddOperationToNative') && editorAINativeBridge.includes("action: 'add_container'") && editorAINativeBridge.includes("action: 'assign_element_container'") && builder.includes('applyAISectionScopedAddNativeOperation'));
check('AI form creation preserves unique names and position before native commit', editorAINativeBridge.includes('existingFormFieldNames') && editorAINativeBridge.includes('existingFormFieldIds') && editorAINativeBridge.includes('uniqueName') && editorAINativeBridge.includes("action: 'add_form_field'"));
check('Legacy AI add_container branch is removed while old contact-form defaults retain add fallback', !builder.includes("if (operation.action === 'add_container')") && builder.includes("if (operation.action === 'add_form_field')"));
check('AI section creation keeps normalizeSection output but commits through native add_section', builder.includes("if (operation.action === 'add_section')") && builder.includes("action: 'add_section'") && builder.includes('const position = requestedAfter') && !builder.includes('sectionList.splice(insertAt, 0, created)'));
check('V2 native page growth respects billing while existing over-limit projects remain editable', builder.includes('const pageCountIncreased =') && builder.includes('candidate.pages.length >') && builder.includes('billingEntitlements.maxPages'));
check('Reusable components stop safely at 50 instead of evicting linked symbols', builder.includes('if (symbols.length >= 50)') && builder.includes('setSymbols((current) => [symbol, ...current]);') && !builder.includes('setSymbols((current) => [symbol, ...current].slice(0, 50))'));
check('Expanded V2 option groups stay in normal flow instead of overlapping', websiteBuilderV2Css.includes('Keep one scroll owner per side panel') && websiteBuilderV2Css.includes('.tayar-v2-inspector-section[open] > .tayar-v2-inspector-section__fields') && websiteBuilderV2Css.includes('position: static') && !websiteBuilderV2Css.includes('.tayar-v2-inspector-section[open] > .tayar-v2-inspector-section__body'));
check('Manual builder advanced controls survive AI upgrades', builder.includes('function createContainerForSelected()') && builder.includes('function assignSelectedToContainer(') && builder.includes('function deleteSelectedContainer()') && builder.includes('function createSymbolFromSelected()'));
check('AI builder uses guarded atomic transactions', builder.includes('validateAIProjectIntegrity') && builder.includes('destructiveOperations') && builder.includes('operations.length - applied'));
check('Manual container inspector remains null-safe', builder.includes('{selectedContainer && selectedSection && sectionColumnCount(selectedSection.layout) > 1 && ('));
check('AI builder can create insert and detach reusable components', builder.includes("create_symbol") && builder.includes("insert_symbol") && builder.includes("detach_symbol") && builder.includes('nextSymbols'));
check('AI builder keeps linked component instances synchronized', builder.includes('linkedSymbolId') && builder.includes('syncInstance') && builder.includes('cloneSymbolElement(updatedElement)'));
check('AI builder can repair basic accessibility without opaque markup', builder.includes("repair_accessibility") && builder.includes('candidateSection.title || candidatePage.name') && builder.includes("content: 'Learn more'"));
check('Manual symbol controls survive component Agent upgrade', builder.includes('function createSymbolFromSelected()') && builder.includes('function insertSymbol(') && builder.includes('function detachSelectedSymbol()') && builder.includes('function deleteSymbol('));
check('Agent plans before generating mutation operations', builder.includes('completeJSON<AIWebsiteAgentPlan>') && builder.includes("action: 'plan-edit'") && builder.includes('executionPlan: agentPlan'));
check('Agent plan is visible in chat before execution handoff', builder.includes('ai-plan-') && builder.includes('planPreview') && builder.includes('Planned ${(agentPlan.steps || []).length} step'));
check('Plan-first Agent still uses native manual-builder transaction path', builder.includes('validateAIProjectIntegrity') && builder.includes('setPages(nextPages)') && builder.includes('setSections(finalActive?.sections || [])') && builder.includes('setSymbols(nextSymbols)'));
check('Final Agent reviews its proposed result before canvas handoff', builder.includes('AIWebsiteAgentReview') && builder.includes("action: 'review-edit'") && builder.includes('proposedProject'));
check('Final Agent can copy section and element visual styles natively', builder.includes("copy_section_style") && builder.includes("copy_element_style") && builder.includes('copyVisualStyle'));
check('Final Agent responsive repair is device-aware and desktop-preserving', builder.includes("repair_responsive") && builder.includes('sectionResponsive.mobile') && builder.includes('sectionResponsive.tablet') && builder.includes('baseStyle'));
check('Final Agent returns focus to native Layers and Inspector', builder.includes('handoffOperation') && builder.includes("setBuilderPanel('layers')") && builder.includes('setInspectorOpen(true)'));
check('Manual editor contracts still survive final Agent polish', builder.includes('function addPage()') && builder.includes('function updateSelectedElement(') && builder.includes('function createSymbolFromSelected()') && builder.includes('function undo()') && builder.includes('function redo()'));
check('Final UX polish keeps a compact canvas-first shell', builder.includes("lg:w-56 xl:w-60") && builder.includes("lg:w-72 xl:w-80") && builder.includes("hidden 2xl:inline"));
check('Final UX polish keeps advanced manual controls progressively disclosed', builder.includes("l('Structure')") && builder.includes("l('Advanced')") && builder.includes("l('Advanced design & responsive')"));

check('Published output carries responsive section overrides', builder.includes('buildResponsiveSectionCss') && builder.includes('data-tayar-section-id') && builder.includes('${responsiveSectionCss}'));
check('Project history contains AI checkpoints', builder.includes("Before AI change") && builder.includes("After AI change") && builder.includes("slice(0, 30)"));
check('Publish actions expose Preview Check Publish flow', builder.includes("AI quality check before publishing") && builder.includes("Check") && builder.includes("Publish"));
check('Section palette remains available in focused Add panel', builder.includes("Object.keys(SECTION_LABELS)") && builder.includes("Sections & elements"));
check('Layers show elements only for the selected section', builder.includes("Select a section to see its elements.") && builder.includes("selectedId === section.id && (") && builder.includes("setInspectorOpen(true)"));
check('Legacy array backups use a valid default language', projectNormalization.includes('if (Array.isArray(input) && input.length)') && projectNormalization.includes("language: 'en'") && projectNormalization.includes("translationKey: 'home'"));
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
