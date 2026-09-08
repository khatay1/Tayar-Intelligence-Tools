import fs from 'node:fs';
import path from 'node:path';

const read = filePath => fs.readFileSync(filePath, 'utf8');
const json = filePath => JSON.parse(read(filePath));
const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

function collectSourceFiles(root) {
  const files = [];
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'android' || entry.name === 'ios') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
    }
  };
  visit(root);
  return files;
}

const appConfig = json('apps/mobile/app.json').expo;
const eas = json('apps/mobile/eas.json');
const mobilePackage = json('apps/mobile/package.json');
const storeConfig = json('apps/mobile/store.config.json');
const profile = read('apps/mobile/app/(tabs)/profile.tsx');
const toolsTab = read('apps/mobile/app/(tabs)/tools.tsx');
const login = read('apps/mobile/app/login.tsx');
const rootLayout = read('apps/mobile/app/_layout.tsx');
const aiClient = read('apps/mobile/lib/ai.ts');
const toolAccess = read('apps/mobile/lib/tool-access.ts');
const supabaseClient = read('apps/mobile/lib/supabase.ts');
const reportFab = read('apps/mobile/components/AiContentReportFab.tsx');
const reviewNotes = read('docs/mobile-store-review-notes.md');
const webApp = read('src/App.tsx');
const deletionPage = read('src/components/workspace/AccountDeletionPage.tsx');
const supportPage = read('public/support.html');
const vercel = json('vercel.json');
const mobileSourceFiles = collectSourceFiles('apps/mobile');
const mobileSourceEntries = mobileSourceFiles.map(filePath => ({ filePath, source: read(filePath) }));
const mobileSource = mobileSourceEntries.map(entry => entry.source).join('\n');
const directAiEngineCallers = mobileSourceEntries
  .filter(entry => entry.source.includes("functions.invoke('ai-engine'"))
  .map(entry => entry.filePath.replace(/\\/g, '/'))
  .sort();
const auditedAiEngineCallers = [
  'apps/mobile/lib/ai.ts',
  'apps/mobile/lib/website-builder.ts',
].sort();

const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
const plugins = Array.isArray(appConfig.plugins) ? appConfig.plugins : [];
const imagePicker = plugins.find(entry => Array.isArray(entry) && entry[0] === 'expo-image-picker');
const imagePickerOptions = Array.isArray(imagePicker) && imagePicker[1] && typeof imagePicker[1] === 'object'
  ? imagePicker[1]
  : {};
const appleInfo = storeConfig.apple?.info || {};
const appleLocales = ['en-US', 'sv', 'ar-SA'];
const validAppleMetadata = appleLocales.every(locale => {
  const info = appleInfo[locale];
  if (!info) return false;
  const keywordBytes = Buffer.byteLength((info.keywords || []).join(','), 'utf8');
  return typeof info.title === 'string' && info.title.length >= 2 && info.title.length <= 30
    && typeof info.subtitle === 'string' && info.subtitle.length > 0 && info.subtitle.length <= 30
    && typeof info.description === 'string' && info.description.length >= 10 && info.description.length <= 4000
    && typeof info.promoText === 'string' && info.promoText.length <= 170
    && Array.isArray(info.keywords) && keywordBytes <= 100
    && info.marketingUrl === 'https://tayar.se/'
    && info.supportUrl === 'https://tayar.se/support.html'
    && info.privacyPolicyUrl === 'https://tayar.se/#privacy'
    && info.privacyChoicesUrl === 'https://tayar.se/account-deletion';
});
const appleMarketingCopy = appleLocales.map(locale => {
  const info = appleInfo[locale] || {};
  return `${info.description || ''}\n${info.promoText || ''}\n${(info.keywords || []).join(',')}`;
}).join('\n').toLowerCase();
const expoMajor = Number(String(mobilePackage.dependencies?.expo || '').match(/\d+/)?.[0] || 0);

check('Mobile uses the production Tayar application identifiers',
  appConfig.ios?.bundleIdentifier === 'se.tayar.tools' && appConfig.android?.package === 'se.tayar.tools');
check('Expo SDK baseline is API-36-capable for the 2026 Play target requirement', expoMajor >= 57);
check('Mobile pins the latest currently published Expo SDK 57 patches',
  mobilePackage.dependencies?.expo === '~57.0.20' && mobilePackage.dependencies?.['expo-router'] === '~57.0.19');
check('Android store builds are app bundles', eas.build?.production?.android?.buildType === 'app-bundle');
check('First Android submission is limited to Play internal testing', eas.submit?.production?.android?.track === 'internal');
check('Production builds auto-increment remote store versions',
  eas.cli?.appVersionSource === 'remote' && eas.build?.production?.autoIncrement === true);
check('iOS encryption declaration is explicit', appConfig.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false);
check('iOS privacy manifest declares tracking disabled', appConfig.ios?.privacyManifests?.NSPrivacyTracking === false);
check('Unused mobile camera and microphone access stay disabled',
  imagePickerOptions.cameraPermission === false && imagePickerOptions.microphonePermission === false && !mobilePackage.dependencies?.['expo-camera']);
check('High-risk Android permissions remain blocked',
  appConfig.android?.blockedPermissions?.includes('android.permission.SYSTEM_ALERT_WINDOW') &&
  appConfig.android?.blockedPermissions?.includes('android.permission.READ_PHONE_STATE'));

check('Mobile profile exposes permanent in-app account deletion',
  profile.includes("functions.invoke('delete-account'") &&
  profile.includes("confirmation: 'DELETE'") &&
  profile.includes('Delete account permanently'));
check('Mobile profile does not expose an in-app Stripe purchase or billing portal',
  !profile.includes("functions.invoke('billing-portal'") && !profile.includes('Manage subscription'));
check('Mobile source contains no alternate digital-purchase steering',
  !mobileSource.includes("functions.invoke('create-checkout-session'") &&
  !mobileSource.includes("functions.invoke('billing-portal'") &&
  !mobileSource.includes('https://tayar.se/#pricing') &&
  !mobileSource.includes('Upgrade now') &&
  !mobileSource.includes('Subscribe now'));
check('Privacy and Terms are reachable from the signed-in mobile profile',
  profile.includes("const PRIVACY_URL = 'https://tayar.se/#privacy'") &&
  profile.includes("const TERMS_URL = 'https://tayar.se/#terms'") &&
  profile.includes('Privacy Policy') && profile.includes('Terms of Service'));
check('Privacy and Terms are reachable before mobile sign-in',
  login.includes("const PRIVACY_URL = 'https://tayar.se/#privacy'") &&
  login.includes("const TERMS_URL = 'https://tayar.se/#terms'") &&
  login.includes('styles.legalRow'));

check('iOS release is enforced as a free companion independent of web or Android paid plans',
  toolAccess.includes("export const isIosFreeCompanion = Platform.OS === 'ios'") &&
  toolAccess.includes('IOS_COMPANION_AI_LIMIT = 25') &&
  toolAccess.includes("requiredPlan !== 'free'") &&
  toolAccess.includes("reason: 'ios_companion_free'") &&
  toolAccess.includes("effective_plan: 'free'") &&
  toolAccess.includes('if (isIosFreeCompanion) return assertToolAccess(toolId)'));
check('iOS tools catalog exposes only Free tools',
  toolsTab.includes("Platform.OS === 'ios' ? mobileTools.filter((tool) => tool.plan === 'Free') : mobileTools") &&
  toolsTab.includes('This iOS release includes the free Tayar companion toolset'));
check('iOS paid-tool deep links are guarded centrally',
  rootLayout.includes('IOS_COMPANION_BLOCKED_ROUTES') &&
  rootLayout.includes("'/tools/document-ai'") &&
  rootLayout.includes("'/tools/analytics-ai'") &&
  rootLayout.includes("'/tools/code-assistant'") &&
  rootLayout.includes("'/tools/contract-writer'") &&
  rootLayout.includes("'/tools/team-workspace'") &&
  rootLayout.includes("Platform.OS === 'ios'") &&
  rootLayout.includes("router.replace('/(tabs)/tools')"));
check('Shared AI client enforces tool access before every provider request',
  aiClient.includes("import { assertToolAccess } from './tool-access'") &&
  aiClient.includes('await assertToolAccess(tool)') &&
  aiClient.indexOf('await assertToolAccess(tool)') < aiClient.indexOf("functions.invoke('ai-engine'"));
check('iOS profile describes included access without purchase steering',
  profile.includes("iosCompanion = Platform.OS === 'ios'") &&
  profile.includes('Included mobile access') &&
  profile.includes('same included companion toolset to every signed-in account') &&
  profile.includes('No purchase is required in the app.'));
check('Apple metadata matches the free iOS companion feature set',
  appleLocales.every(locale => String(appleInfo[locale]?.description || '').includes('iOS') || locale === 'ar-SA') &&
  !appleMarketingCopy.includes('code assistance') &&
  !appleMarketingCopy.includes('kodassistans') &&
  !appleMarketingCopy.includes('برمجة'));
check('Reviewer notes document the iOS free-companion release contract',
  reviewNotes.includes('free stand-alone companion') &&
  reviewNotes.includes('Pro- and Business-only tools are not listed') &&
  reviewNotes.includes('same fixed free mobile allowance'));

check('Mobile Supabase transport records every successful ai-engine response for in-app reporting',
  supabaseClient.includes("url.includes('/functions/v1/ai-engine')") &&
  supabaseClient.includes('toolFromRequestBody(init?.body)') &&
  supabaseClient.includes('recordAiOutput(tool, outputFromPayload(payload))') &&
  supabaseClient.includes('fetch: trackedFetch'));
check('Structured mobile AI output remains reportable through the shared transport',
  supabaseClient.includes('payload.json') && supabaseClient.includes('JSON.stringify(payload.json)'));
check('Direct mobile ai-engine callers are limited to audited clients',
  JSON.stringify(directAiEngineCallers) === JSON.stringify(auditedAiEngineCallers));
check('In-app AI report control is mounted globally for tool routes',
  rootLayout.includes("import AiContentReportFab from '@/components/AiContentReportFab'") &&
  rootLayout.includes('<AiContentReportFab />') &&
  reportFab.includes("pathname.startsWith('/tools/')"));
check('AI report control sends a bounded output excerpt to support without prompt or source attachment',
  reportFab.includes('const MAX_REPORT_EXCERPT = 2_000') &&
  reportFab.includes("type: 'ai-content-report'") &&
  reportFab.includes("supabase.from('support_tickets').insert") &&
  reportFab.includes('Your prompt and source document are not included'));

check('Public account deletion route is rewritten to the SPA entry',
  rewrites.some(route => route?.source === '/account-deletion' && route?.destination === '/'));
check('Web app resolves /account-deletion without authentication',
  webApp.includes('directAccountDeletion') &&
  webApp.includes("? 'account-deletion' : null") &&
  webApp.includes('? AccountDeletionPage'));
check('Public account deletion page documents mobile and web deletion',
  deletionPage.includes('Delete your account now') &&
  deletionPage.includes('Mobile app: open Profile') &&
  deletionPage.includes('Web: sign in'));
check('Public deletion page provides a signed-out assistance path',
  deletionPage.includes('If you cannot sign in') && deletionPage.includes('Request deletion by email'));
check('Public mobile support page exists with legal and deletion paths',
  supportPage.includes('Tayar Tools Support') &&
  supportPage.includes('href="/account-deletion"') &&
  supportPage.includes('href="/#privacy"') &&
  supportPage.includes('href="/#terms"'));
check('Apple store metadata uses the supported EAS metadata schema and categories',
  storeConfig.configVersion === 0 &&
  Array.isArray(storeConfig.apple?.categories) &&
  storeConfig.apple.categories[0] === 'PRODUCTIVITY' &&
  storeConfig.apple.categories.includes('UTILITIES'));
check('Apple store metadata is complete and within limits for English Swedish and Arabic', validAppleMetadata);
check('Google Play listing draft is checked into release documentation', fs.existsSync('docs/mobile-google-play-listing.md'));
check('Store reviewer notes and privacy worksheet are checked into release documentation',
  fs.existsSync('docs/mobile-store-review-notes.md') && fs.existsSync('docs/mobile-store-privacy-worksheet.md'));
check('Store screenshot capture plan covers iPhone iPad and Google Play', fs.existsSync('docs/mobile-store-screenshot-plan.md'));

const projectId = appConfig.extra?.eas?.projectId;
console.log(`EAS project link: ${projectId ? 'configured' : 'external setup pending (extra.eas.projectId not committed yet)'}`);

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`✓ ${name}`);
  else {
    console.error(`✗ ${name}`);
    failed += 1;
  }
}

console.log(`Mobile store readiness smoke test: ${checks.length - failed} passed, ${failed} failed`);
if (failed) process.exit(1);
