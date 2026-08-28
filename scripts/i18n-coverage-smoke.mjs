import fs from 'node:fs';

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);
const read = (p) => fs.readFileSync(p, 'utf8');

const ui = read('src/lib/ui-localization.ts');
const onboarding = read('src/components/onboarding/OnboardingWizard.tsx');
const settings = read('src/components/workspace/SettingsPage.tsx');
const workspace = read('src/components/workspace/Workspace.tsx');
const builder = read('src/modules/website-builder/WebsiteBuilderTool.tsx');
const resume = read('src/components/cv/ResumeBuilder.tsx');
const admin = read('src/components/admin/AdminLayout.tsx');

check('UI localization layer exists', ui.includes('export function useLocalizer'));
check('Arabic UI map exists', ui.includes('const ar: PhraseMap'));
check('Swedish UI map exists', ui.includes('const sv: PhraseMap'));
check('Onboarding uses UI localizer', onboarding.includes('const l = useLocalizer()'));
check('Settings uses UI localizer', settings.includes('const l = useLocalizer()'));
check('Workspace uses UI localizer', workspace.includes('const l = useLocalizer()'));
check('Website Builder uses UI localizer', builder.includes('const l = useLocalizer()'));
check('Resume Builder uses UI localizer', resume.includes('const l = useLocalizer()'));
check('Admin UI uses UI localizer', admin.includes('const l = useLocalizer()'));
check('Stale workspace translation key removed', !workspace.includes("'nav.workspace'"));
check('Onboarding goals are localized', onboarding.includes('{l(g.label)}'));
check('Onboarding personas are localized', onboarding.includes('{l(ut.description)}'));
check('Resume dynamic navigation labels are localized', resume.includes('{l(item.label)}'));
check('Arabic onboarding translation included', ui.includes("'Get Started': 'ابدأ'"));
check('Swedish onboarding translation included', ui.includes("'Get Started': 'Kom igång'"));
check('Arabic admin translation included', ui.includes("'Access Denied': 'تم رفض الوصول'"));
check('Swedish admin translation included', ui.includes("'Access Denied': 'Åtkomst nekad'"));

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
console.log(`I18N coverage smoke test: ${checks.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
