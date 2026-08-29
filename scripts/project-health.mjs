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
