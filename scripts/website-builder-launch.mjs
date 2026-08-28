import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const read = (p) => fs.readFileSync(path.join(cwd, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(cwd, p));
const builder = read('src/modules/website-builder/WebsiteBuilderTool.tsx');
const moduleIndex = read('src/modules/website-builder/index.ts');
const packageJson = JSON.parse(read('package.json'));

const checks = [];
const check = (label, ok) => checks.push({ label, ok: Boolean(ok) });

check('Website Builder is registered as active', moduleIndex.includes("status: 'active'"));
check('Website Builder module is version 1.0.0', moduleIndex.includes("version: '1.0.0'"));
check('V1 Launch Center exists', builder.includes('Website Builder V1 Launch Center'));
check('Launch Center has automated checks', builder.includes('Automated launch checks'));
check('Launch Center has manual production sign-off', builder.includes('Manual production sign-off'));
check('Launch Center has quick-start onboarding', builder.includes('Quick-start onboarding'));
check('Launch Center includes template quick starts', builder.includes('PAGE_TEMPLATES.slice(0, 6)'));
check('Launch Center exports a final report', builder.includes('exportV1LaunchReport'));
check('Launch Center has a NO-GO state', builder.includes("'NO-GO'"));
check('Launch Center has READY TO PUBLISH state', builder.includes("'READY TO PUBLISH'"));
check('Launch Center has V1 LIVE state', builder.includes("'V1 LIVE'"));
check('Launch gate includes cloud sync', builder.includes('Resolve cloud sync before publishing.'));
check('Launch gate includes audit blockers', builder.includes('critical audit error'));
check('Launch gate includes maintenance mode', builder.includes('Disable maintenance mode for public launch.'));
check('Launch gate includes owner publish permission', builder.includes('The project owner must perform the publish.'));
check('Launch gate verifies billing backend', builder.includes('Billing backend'));
check('Launch gate verifies production URL', builder.includes('Production URL'));
check('Launch gate verifies live deployment', builder.includes('Live verification'));
check('Launch manual checks persist locally', builder.includes('LAUNCH_MANUAL_CHECKS_KEY'));
check('Launch welcome state persists locally', builder.includes('LAUNCH_CENTER_SEEN_KEY'));
check('Command palette opens Launch Center', builder.includes('Open V1 launch center'));
check('Smoke test script still exists', exists('scripts/website-builder-smoke.mjs'));
check('Quality/security migration still exists', exists('supabase/migrations/20260828161000_quality_security_hardening.sql'));
check('Team workspace migration still exists', exists('supabase/migrations/20260828155500_add_team_workspaces.sql'));
check('Billing migration still exists', exists('supabase/migrations/20260828154000_add_secure_billing_entitlements.sql'));
check('Final launch command is registered', packageJson.scripts?.['launch:website-builder']?.includes('website-builder-launch.mjs'));
check('No unresolved merge markers in Website Builder', !builder.includes('<<<<<<<') && !builder.includes('=======') && !builder.includes('>>>>>>>'));
check('No Stripe live secret literal appears in Website Builder', !/sk_live_[A-Za-z0-9]/.test(builder));

let failed = 0;
console.log('Website Builder V1 launch verification:');
for (const item of checks) {
  if (!item.ok) failed += 1;
  console.log(`  ${item.ok ? '✓' : '✗'} ${item.label}`);
}
console.log(`\n${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
