import fs from 'node:fs';
import path from 'node:path';

const checks = [];
const check = (name, ok) => checks.push([name, Boolean(ok)]);
const read = (p) => fs.readFileSync(p, 'utf8');

const uiPath = 'src/lib/ui-localization.ts';
const ui = read(uiPath);
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

function collectFiles(root) {
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(?:tsx|ts|jsx|js)$/.test(entry.name)) out.push(full);
    }
  };
  visit(root);
  return out;
}

function extractPhraseMapKeys(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : source.length;
  if (start < 0 || end < 0) return new Set();
  const section = source.slice(start, end);
  const keys = new Set();
  for (const match of section.matchAll(/'((?:\\'|[^'])+)'\s*:/g)) {
    keys.add(match[1].replace(/\\'/g, "'"));
  }
  return keys;
}

const arKeys = extractPhraseMapKeys(ui, 'const ar: PhraseMap', 'const sv: PhraseMap');
const svKeys = extractPhraseMapKeys(ui, 'const sv: PhraseMap', 'const maps:');

const sourceFiles = collectFiles('src');
const localizedUsage = new Map();
const hardcodedCandidates = [];

const hardcodedJsxRe = />\s*([A-Z][A-Za-z0-9][A-Za-z0-9 &+/.:'’(),!?–—·↗-]{2,110})\s*</g;
const ignoredHardcoded = new Set([
  'AI', 'API', 'CSV', 'CSS', 'HTML', 'ID', 'JS', 'JSON', 'PDF', 'PRO', 'SEO', 'TS', 'TSX', 'UI', 'URL',
  'V1.0', 'ZIP', 'PNG', 'JPG', 'Power BI', 'PowerPoint', 'Instagram', 'Facebook', 'LinkedIn',
  'Tayar Intelligence', 'Tayar AI', 'React · Supabase · Vite', 'Promise', 'PromiseLike',
  'Google Analytics 4', 'Google Tag Manager', 'Meta Pixel', 'Ctrl/Cmd+K',
]);
const contentOnlyFiles = new Set([
  'src/modules/code-assistant/seed-components.ts',
  'src/modules/website-builder/core/defaults.ts',
]);

for (const file of sourceFiles) {
  const source = read(file);

  for (const match of source.matchAll(/\bl\(\s*'((?:\\'|[^'])+)'\s*\)/g)) {
    const key = match[1].replace(/\\'/g, "'");
    const list = localizedUsage.get(key) || [];
    list.push(file);
    localizedUsage.set(key, list);
  }

  for (const match of source.matchAll(hardcodedJsxRe)) {
    const text = match[1].trim();
    if (ignoredHardcoded.has(text)) continue;
    if (/^(?:https?:|[A-Z0-9_.-]{2,})$/.test(text)) continue;
    const line = source.slice(0, match.index).split('\n').length;
    hardcodedCandidates.push({ file, line, text });
  }
}

const missingArabic = [];
const missingSwedish = [];
for (const [key, files] of localizedUsage) {
  if (!arKeys.has(key)) missingArabic.push({ key, files: [...new Set(files)] });
  if (!svKeys.has(key)) missingSwedish.push({ key, files: [...new Set(files)] });
}

const expectedContentCandidates = hardcodedCandidates.filter(({ file }) => contentOnlyFiles.has(file));
const unexpectedHardcoded = hardcodedCandidates.filter(({ file, text }) => {
  if (contentOnlyFiles.has(file)) return false;
  if (file === 'src/modules/website-builder/WebsiteBuilderTool.tsx' && text.startsWith('JSON.stringify(')) return false;
  return true;
});

check('Every useLocalizer phrase has an Arabic translation', missingArabic.length === 0);
check('Every useLocalizer phrase has a Swedish translation', missingSwedish.length === 0);
check('No unexpected hard-coded application UI remains', unexpectedHardcoded.length === 0);

if (missingArabic.length) {
  console.log('\nMissing Arabic UI phrases:');
  for (const item of missingArabic) console.log(`  - ${item.key}  [${item.files.join(', ')}]`);
}
if (missingSwedish.length) {
  console.log('\nMissing Swedish UI phrases:');
  for (const item of missingSwedish) console.log(`  - ${item.key}  [${item.files.join(', ')}]`);
}
if (unexpectedHardcoded.length) {
  console.log('\nUnexpected hard-coded application UI:');
  for (const item of unexpectedHardcoded) console.log(`  ! ${item.file}:${item.line}  ${item.text}`);
}

console.log(`\nI18N scan: ${sourceFiles.length} source files, ${localizedUsage.size} localized UI phrases.`);
console.log(`Expected customer/template content candidates: ${expectedContentCandidates.length}`);
for (const item of expectedContentCandidates) console.log(`  content ${item.file}:${item.line}  ${item.text}`);

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
console.log(`I18N coverage smoke test: ${checks.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
