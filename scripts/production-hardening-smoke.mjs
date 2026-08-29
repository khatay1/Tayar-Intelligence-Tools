import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const passes = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function check(label, condition) {
  (condition ? passes : failures).push(label);
}

const requiredFiles = [
  'vercel.json',
  'index.html',
  'public/robots.txt',
  'public/sitemap.xml',
  'src/lib/seo.ts',
  'src/lib/analytics.ts',
  'src/lib/monitoring.ts',
  'src/components/workspace/CookieConsent.tsx',
];

for (const path of requiredFiles) {
  check(`Production file exists: ${path}`, existsSync(resolve(root, path)));
}

const index = read('index.html');
const robots = read('public/robots.txt');
const sitemap = read('public/sitemap.xml');
const seo = read('src/lib/seo.ts');
const analytics = read('src/lib/analytics.ts');
const monitoring = read('src/lib/monitoring.ts');
const consent = read('src/components/workspace/CookieConsent.tsx');
const vercelConfig = read('vercel.json');

check('Canonical production domain is tayar.se',
  index.includes('https://tayar.se/') &&
  robots.includes('https://tayar.se/sitemap.xml') &&
  sitemap.includes('https://tayar.se/') &&
  seo.includes("'https://tayar.se'"));

check('Legacy tayar.ai production URLs are removed',
  !index.includes('tayar.ai') &&
  !robots.includes('tayar.ai') &&
  !sitemap.includes('tayar.ai') &&
  !seo.includes('tayar.ai'));

check('Analytics requires explicit consent',
  analytics.includes('hasAnalyticsConsent') &&
  analytics.includes('if (!hasAnalyticsConsent()) return;') &&
  consent.includes('analytics: false'));

check('External monitoring requires analytics consent',
  monitoring.includes('hasAnalyticsConsent') &&
  monitoring.includes('loadConsentedMonitoring'));

check('Consent changes are broadcast',
  consent.includes("'tayar-cookie-consent-changed'") &&
  analytics.includes("COOKIE_CONSENT_EVENT = 'tayar-cookie-consent-changed'"));

for (const header of [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
]) {
  check(`Vercel security header configured: ${header}`, vercelConfig.includes(header));
}

check('Service worker is revalidated on deploy',
  vercelConfig.includes('"source": "/sw.js"') &&
  vercelConfig.includes('max-age=0, must-revalidate'));

check('Hashed assets use immutable caching',
  vercelConfig.includes('"source": "/assets/(.*)"') &&
  vercelConfig.includes('max-age=31536000, immutable'));

console.log(`Production hardening smoke test: ${passes.length} passed, ${failures.length} failed`);
for (const label of passes) console.log(`  ✓ ${label}`);
for (const label of failures) console.error(`  ✗ ${label}`);

if (failures.length) process.exit(1);
