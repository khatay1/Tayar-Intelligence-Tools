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
const login = read('apps/mobile/app/login.tsx');
const webApp = read('src/App.tsx');
const deletionPage = read('src/components/workspace/AccountDeletionPage.tsx');
const supportPage = read('public/support.html');
const vercel = json('vercel.json');
const mobileSource = collectSourceFiles('apps/mobile').map(read).join('\n');

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

check('Mobile uses the production Tayar application identifiers',
  appConfig.ios?.bundleIdentifier === 'se.tayar.tools' && appConfig.android?.package === 'se.tayar.tools');
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
