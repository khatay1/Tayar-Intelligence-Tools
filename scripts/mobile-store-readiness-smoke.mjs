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
const profile = read('apps/mobile/app/(tabs)/profile.tsx');
const login = read('apps/mobile/app/login.tsx');
const webApp = read('src/App.tsx');
const deletionPage = read('src/components/workspace/AccountDeletionPage.tsx');
const vercel = json('vercel.json');
const mobileSource = collectSourceFiles('apps/mobile').map(read).join('\n');

const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
const plugins = Array.isArray(appConfig.plugins) ? appConfig.plugins : [];
const imagePicker = plugins.find(entry => Array.isArray(entry) && entry[0] === 'expo-image-picker');
const imagePickerOptions = Array.isArray(imagePicker) && imagePicker[1] && typeof imagePicker[1] === 'object'
  ? imagePicker[1]
  : {};

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
