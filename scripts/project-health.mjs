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
const aiPrompts = read('src/lib/ai/prompts.ts');
const emailService = read('supabase/functions/email-service/index.ts');
const envExample = read('.env.example');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const aiSecurityMigration = read('supabase/migrations/20260829110000_ai_engine_security_hardening.sql');
const adminSecurityMigration = read('supabase/migrations/20260829144000_harden_admin_role_and_admin_access.sql');
const adminBusinessAccessMigration = read('supabase/migrations/20260830110500_fix_admin_business_access.sql');
const adminDeployScript = read('scripts/admin-hardening-deploy.ps1');
const vercelPrebuiltDeployScript = read('scripts/vercel-prebuilt-deploy.ps1');
const adminContext = read('src/context/AdminContext.tsx');
const adminUsers = read('src/components/admin/AdminUsers.tsx');
const adminHooks = read('src/lib/admin-hooks.ts');
const adminContent = read('src/components/admin/AdminContent.tsx');
const adminSystem = read('src/components/admin/AdminSystem.tsx');
const adminTools = read('src/components/admin/AdminTools.tsx');
const adminAI = read('src/components/admin/AdminAI.tsx');
const subscriptionView = read('src/components/workspace/SubscriptionView.tsx');
const websiteBuilder = read('src/modules/website-builder/WebsiteBuilderTool.tsx');
const aiTypes = read('src/lib/ai/types.ts');
const sharedBilling = read('supabase/functions/_shared/billing.ts');
const app = read('src/App.tsx');
const manifest = read('public/manifest.webmanifest');
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
check('Admin user mutations use protected RPCs', adminUsers.includes("supabase.rpc('admin_update_user'") && adminUsers.includes("supabase.rpc('admin_delete_user'") && !adminUsers.includes(".from('profiles').update"));
check('Admin user list uses server-side RPC', adminHooks.includes("supabase.rpc('admin_list_users')"));
check('Admin self-lockout protections exist', adminSecurityMigration.includes('You cannot remove or suspend your own administrator access') && adminSecurityMigration.includes('You cannot delete your own administrator account'));
check('Admin settings are admin-readable only', adminSecurityMigration.includes('DROP POLICY IF EXISTS "admin_settings_select"') && adminSecurityMigration.includes('CREATE POLICY "admin_settings_select"') && adminSecurityMigration.includes('USING (public.is_admin())'));
check('Admin effective plan is Business without mutating billing records', adminBusinessAccessMigration.includes("WHEN p.role = 'admin'") && adminBusinessAccessMigration.includes("THEN 'business'") && adminBusinessAccessMigration.includes('team_effective_plan'));
check('Admin user list reports effective Business access', adminBusinessAccessMigration.includes('CREATE OR REPLACE FUNCTION public.admin_list_users()') && adminBusinessAccessMigration.includes("WHEN p.role = 'admin' AND coalesce(p.suspended, false) = false THEN 'business'"));
check('Subscription view shows Admin Business access instead of Free', subscriptionView.includes('const { isAdmin } = useAdmin()') && subscriptionView.includes("const activePlan = isAdmin ? 'business'") && subscriptionView.includes('Admin · Business access'));
check('Website Builder AI prompt uses multi-page planner schema', aiPrompts.includes('Tayar AI Builder') && aiPrompts.includes('"pages": [') && aiPrompts.includes('Build 1-6 useful pages'));
check('Website Builder AI supports multi-page generation with legacy fallback', websiteBuilder.includes('interface AIWebsitePageGeneration') && websiteBuilder.includes('Array.isArray(generated?.pages)') && websiteBuilder.includes('Array.isArray(generated?.sections)') && websiteBuilder.includes('setPages(nextPages)'));
check('Website Builder AI exposes planning progress and plan summary', websiteBuilder.includes('AI_BUILDER_STAGE_ORDER') && websiteBuilder.includes("setAiStage('planning')") && websiteBuilder.includes("setAiStage('building')") && websiteBuilder.includes("setAiStage('styling')") && websiteBuilder.includes("setAiStage('ready')") && websiteBuilder.includes("l('Website plan')"));
check('Website Builder AI uses chat-style build history', websiteBuilder.includes('aiMessages.slice(-4)') && websiteBuilder.includes("role: 'assistant'") && websiteBuilder.includes("role: 'user'"));
check('Website Builder AI hands results to manual editor', websiteBuilder.includes("l('Edit manually')") && websiteBuilder.includes("setBuilderPanel('layers')") && websiteBuilder.includes('setInspectorOpen(true)'));
check('Website Builder AI respects page plan limits', websiteBuilder.includes('maxGeneratedPages') && websiteBuilder.includes('billingEntitlements.maxPages') && websiteBuilder.includes('.slice(0, maxGeneratedPages)'));
check('Website Builder AI edit prompt returns targeted patch operations', aiPrompts.includes("action === 'edit'") && aiPrompts.includes('update_section|add_section|remove_section|update_page|restyle_site|update_site|generate_image') && aiPrompts.includes('Do not return a full "pages" replacement in edit mode'));
check('Website Builder AI patch engine applies bounded targeted operations', websiteBuilder.includes('interface AIWebsitePatchOperation') && websiteBuilder.includes('operations.slice(0, 40)') && websiteBuilder.includes("operation.action === 'update_section'") && websiteBuilder.includes("operation.action === 'add_section'") && websiteBuilder.includes("operation.action === 'remove_section'"));
check('Website Builder AI patch engine preserves unrelated website content', websiteBuilder.includes('JSON.parse(JSON.stringify(currentPages))') && websiteBuilder.includes('const resolvePageIndex') && websiteBuilder.includes('const resolveSectionIndex') && websiteBuilder.includes('nextPages[pageIndex]'));
check('Website Builder AI supports site-wide restyling patches', websiteBuilder.includes("operation.action === 'restyle_site'") && websiteBuilder.includes('backgroundColor') && websiteBuilder.includes('accentColor') && websiteBuilder.includes('setTheme(nextTheme)'));
check('Website Builder AI stores and restores an undo snapshot', websiteBuilder.includes('AIWebsiteUndoSnapshot') && websiteBuilder.includes('setAiUndoSnapshot(snapshot)') && websiteBuilder.includes('undoLastAIChange') && websiteBuilder.includes("l('Undo AI change')"));
check('Website Builder AI exposes follow-up patch chat', websiteBuilder.includes('applyAIChange') && websiteBuilder.includes("l('Apply AI change')") && websiteBuilder.includes('Ask Tayar to change this website without rebuilding it') && websiteBuilder.includes("l('Rebuild from prompt')"));
check('Website Builder AI prompt includes design intelligence rules', aiPrompts.includes('restrained palette') && aiPrompts.includes('visual rhythm') && aiPrompts.includes('generous whitespace') && aiPrompts.includes('one obvious primary CTA'));
check('Website Builder AI applies generated palette to the full theme', websiteBuilder.includes('generatedSurfaceIsLight') && websiteBuilder.includes('generatedMutedTextColor') && websiteBuilder.includes('nextGeneratedTheme = normalizeTheme') && websiteBuilder.includes('setTheme(nextGeneratedTheme)') && websiteBuilder.includes('setHeaderConfig(nextGeneratedHeader)'));
check('Website Builder AI adapts spacing and radius to design tone', websiteBuilder.includes("tone === 'minimal' || tone === 'premium' ? 104 : 92") && websiteBuilder.includes("tone === 'premium' || tone === 'friendly' ? 16"));
check('AI image requests are forwarded to the edge engine', aiService.includes("typeof input.action === 'string'") && aiService.includes("{ action: input.action }") && aiService.includes("{ prompt: input.prompt }"));
check('AI engine persists generated images into Website Builder media', aiEngine.includes('from("website-media")') && aiEngine.includes('assetPath') && aiEngine.includes('persisted'));
check('Website Builder AI patch engine can generate targeted images', websiteBuilder.includes("operation.action === 'generate_image'") && websiteBuilder.includes('requestGeneratedImage(imagePrompt)') && websiteBuilder.includes("placement === 'section_background'"));
check('Website Builder AI image tool applies generated media to the selected target', websiteBuilder.includes('async function generateRealImage()') && websiteBuilder.includes('saved it to Media Library') && websiteBuilder.includes("backgroundMode: 'image'"));
check('Tayar Agent can generate a finished site with imagery and SEO fallback', websiteBuilder.includes('generateWithAI(agentMode = false)') && websiteBuilder.includes('Build with Tayar Agent') && websiteBuilder.includes('agentImagesGenerated') && websiteBuilder.includes('nextGeneratedSeo'));
check('Website Builder AI quality review covers publish readiness', aiPrompts.includes("action === 'quality-check'") && websiteBuilder.includes('runAIQualityCheck') && websiteBuilder.includes('AI Quality Check') && websiteBuilder.includes('fixAIQualityIssues'));
check('Website Builder uses Preview Check Publish workflow', websiteBuilder.includes("l('Preview')") && websiteBuilder.includes("l('Check')") && websiteBuilder.includes("Publish") && websiteBuilder.includes('runAIQualityCheck'));
check('Website Builder keeps durable AI checkpoints in project history', websiteBuilder.includes('pushProjectCheckpoint') && websiteBuilder.includes('Before Tayar Agent build') && websiteBuilder.includes('After Tayar Agent build') && websiteBuilder.includes('.slice(0, 30)'));
check('Website Builder has one-click canvas focus mode', websiteBuilder.includes('Focus on canvas') && websiteBuilder.includes('setLeftSidebarOpen(reopenPanels)') && websiteBuilder.includes('setInspectorOpen(reopenPanels)'));
check('Website Builder collapses section settings while editing elements', websiteBuilder.includes('sectionSettingsOpen') && websiteBuilder.includes('setSectionSettingsOpen(!selectedElementId)') && websiteBuilder.includes('collapsed while editing element'));
check('Website Builder keeps free positioning out of Quick style', websiteBuilder.includes("l('Free position')") && websiteBuilder.indexOf("l('Free position')") > websiteBuilder.indexOf("l('Advanced design & responsive')"));
check('Website Builder prioritizes popular sections in Add panel', websiteBuilder.includes("l('Popular sections')") && websiteBuilder.includes("l('More sections')") && websiteBuilder.includes("['hero', 'features', 'services', 'contact']"));
check('Website Builder hides advanced elements behind progressive disclosure', websiteBuilder.includes("l('Advanced elements')") && websiteBuilder.includes("['heading', 'text', 'button', 'image', 'video', 'list']"));
check('Website Builder Layers only expand the active section', websiteBuilder.includes("Select a section to see its elements.") && websiteBuilder.includes("selectedId === section.id && (") && websiteBuilder.includes("setInspectorOpen(true)"));
check('Website Builder supports direct canvas element resizing', websiteBuilder.includes('renderSelectedElementResizeHandle') && websiteBuilder.includes('cursor-ew-resize') && websiteBuilder.includes('onResizeElementWidth'));
check('Canvas resize is device-aware and undo-friendly', websiteBuilder.includes('beginElementResize') && websiteBuilder.includes('remember(sections)') && websiteBuilder.includes('[device]:') && websiteBuilder.includes('width: safeWidth'));
check('Selected element toolbar stays compact on canvas', websiteBuilder.includes('max-w-20 truncate') && websiteBuilder.includes('rounded-md border border-white/10 bg-[#111122]/95 p-0.5'));
check('Selected element toolbar follows canvas move offsets', websiteBuilder.includes('transform: `translate3d(${positionX}px, ${positionY}px, 0)`') && websiteBuilder.includes('Drag to move · Arrows nudge'));
check('Canvas free-position offsets can reset without Inspector', websiteBuilder.includes('onResetElementPosition') && websiteBuilder.includes('resetElementPosition') && websiteBuilder.includes('positionX: 0') && websiteBuilder.includes('positionY: 0'));
check('Canvas inline editing includes buttons', websiteBuilder.includes("element.type === 'button'") && websiteBuilder.includes('Double-click to edit button text') && websiteBuilder.includes('contentEditable={editingInline}'));
check('Canvas images can be replaced directly', websiteBuilder.includes("element.type === 'image' || element.type === 'video' || element.type === 'embed'") && websiteBuilder.includes("const sourceLabel = element.type === 'image' ? 'Image URL'") && websiteBuilder.includes('updateInlineElementSource'));
check('Selected canvas elements advertise direct editing', websiteBuilder.includes('Double-click edit') && websiteBuilder.includes('Double-click replace'));
check('Canvas toolbar exposes contextual quick editing', websiteBuilder.includes('onQuickUpdateElement') && websiteBuilder.includes('Edit button link') && websiteBuilder.includes('Open media library') && websiteBuilder.includes('Double-click to edit video URL'));
check('Canvas toolbar can reopen the Inspector directly', websiteBuilder.includes('onOpenInspector') && websiteBuilder.includes('title="Open inspector"'));
check('Selected canvas elements support keyboard nudging', websiteBuilder.includes('handleCanvasKeyDown') && websiteBuilder.includes("event.shiftKey ? 10 : 1") && websiteBuilder.includes('nudgeSelectedElement'));
check('Selected canvas elements support duplicate delete and escape shortcuts', websiteBuilder.includes("event.key.toLowerCase() === 'd'") && websiteBuilder.includes("event.key === 'Delete' || event.key === 'Backspace'") && websiteBuilder.includes("event.key === 'Escape'") && websiteBuilder.includes('setSelectedElementId(null)'));
check('Canvas video and embeds support direct source editing', websiteBuilder.includes("element.type === 'image' || element.type === 'video' || element.type === 'embed'") && websiteBuilder.includes('Double-click to edit video URL') && websiteBuilder.includes('Double-click to edit embed URL'));
check('Canvas selection toolbar avoids duplicate reorder controls', !websiteBuilder.includes('onMoveSelectedElement: (direction') && websiteBuilder.includes('Shift+drag reorder'));
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
check('Admin provider cards remain honest about backend support', adminAI.includes('Backend not enabled'));
check('Gemini registry uses current production model IDs', aiTypes.includes("'gemini-3.7-flash'") && aiTypes.includes("'gemini-3.6-flash'") && aiTypes.includes("'gemini-3.5-flash'") && !aiTypes.includes("'gemini-1.5-pro'"));
check('Gemini 3.x requests omit deprecated temperature sampling', !aiEngine.includes('temperature: clampNumber(body.temperature'));
check('AI engine accepts admin-added Gemini IDs only from catalog', aiEngine.includes('GEMINI_MODEL_ID') && aiEngine.includes('loadAllowedTextModels') && aiEngine.includes('source.enabled === false'));
check('Admin deploy defaults to dry-run', adminDeployScript.includes('db push --dry-run') && adminDeployScript.includes('if (-not $Apply)'));
check('Admin production deploy requires explicit confirmation', adminDeployScript.includes('if (-not $ConfirmProduction)') && adminDeployScript.includes('-Apply -ConfirmProduction'));
check('Admin deploy updates affected Edge Functions', ['ai-engine', 'billing-portal', 'create-checkout-session', 'email-service'].every((name) => adminDeployScript.includes(name)));
check('Admin deploy handles Windows env BOM', adminDeployScript.includes('Removing UTF-8 BOM from .env') && adminDeployScript.includes('[System.IO.File]::ReadAllBytes'));
check('Vercel prebuilt deploy helper exists', exists('scripts/vercel-prebuilt-deploy.ps1'));
check('Vercel fallback bypasses vercel build on Windows', !vercelPrebuiltDeployScript.includes('Invoke-Vercel build') && vercelPrebuiltDeployScript.includes('node.exe $ViteEntry build'));
check('Vercel fallback emits Build Output API v3 artifact', vercelPrebuiltDeployScript.includes(".vercel\\output") && vercelPrebuiltDeployScript.includes('version = 3') && vercelPrebuiltDeployScript.includes("handle = 'filesystem'"));
check('Vercel fallback preserves production security and cache headers', ['Strict-Transport-Security', 'X-Content-Type-Options', 'Service-Worker-Allowed', 'Cache-Control'].every((name) => vercelPrebuiltDeployScript.includes(name)));
check('Vercel fallback rejects redacted secrets', vercelPrebuiltDeployScript.includes("value -ne '[SENSITIVE]'") && vercelPrebuiltDeployScript.includes('Build output contains a redacted [SENSITIVE] placeholder'));
check('Vercel fallback validates Supabase browser config before build', vercelPrebuiltDeployScript.includes('Validated local Supabase browser configuration.') && vercelPrebuiltDeployScript.includes('VITE_SUPABASE_ANON_KEY is redacted by Vercel'));

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

const failed = checks.filter((item) => !item.ok);
console.log(`Project health check: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const item of checks) console.log(`  ${item.ok ? '✓' : '✗'} ${item.name}`);
if (failed.length) process.exit(1);
