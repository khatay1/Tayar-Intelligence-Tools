import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const publishedProxyModule = await import('../api/published-site.js');
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
  'src/lib/supabase.ts',
  'src/components/workspace/CookieConsent.tsx',
  'src/components/workspace/AIAssistant.tsx',
  'src/lib/published-site-url.ts',
  'api/published-site.js',
  'public/sw.js',
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
const supabase = read('src/lib/supabase.ts');
const consent = read('src/components/workspace/CookieConsent.tsx');
const aiAssistant = read('src/components/workspace/AIAssistant.tsx');
const publishedUrlHelper = read('src/lib/published-site-url.ts');
const publishedProxy = read('api/published-site.js');
const serviceWorker = read('public/sw.js');
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

check('Supabase browser configuration fails fast when missing',
  supabase.includes('VITE_SUPABASE_URL') &&
  supabase.includes('VITE_SUPABASE_ANON_KEY') &&
  supabase.includes('throw new Error'));

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

check('Published-site proxy module loads as a valid serverless handler',
  typeof publishedProxyModule.default === 'function');

check('Published HTML is rendered through an isolated Vercel proxy',
  publishedProxy.includes("'text/html; charset=utf-8'") &&
  publishedProxy.includes('sandbox allow-scripts') &&
  !publishedProxy.includes('allow-same-origin') &&
  vercelConfig.includes('/api/published-site'));

check('Published rewrites explicitly pass route parameters',
  vercelConfig.includes('ownerId=:ownerId&projectId=:projectId') &&
  vercelConfig.includes('previewToken=:previewToken') &&
  vercelConfig.includes('file=:file*'));

check('Published URL helper migrates legacy Supabase Storage links',
  publishedUrlHelper.includes('normalizePublishedSiteUrl') &&
  publishedUrlHelper.includes('/storage/v1/object/public/published-sites/'));

check('Published and preview routes bypass the app service worker',
  serviceWorker.includes("url.pathname.startsWith('/site/')") &&
  serviceWorker.includes("url.pathname.startsWith('/preview/')"));

check('AI Assistant escapes model output before applying markdown HTML',
  aiAssistant.includes('let html = escapeHtml(text)') &&
  aiAssistant.includes('dangerouslySetInnerHTML'));

async function runPublishedProxyCase(url, extraHeaders = {}) {
  const originalFetch = globalThis.fetch;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const requests = [];
  const headers = {};
  let body = Buffer.alloc(0);

  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return new Response('<!doctype html><html><body>Tayar published site</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    };

    const req = {
      method: 'GET',
      url,
      headers: { host: 'tayar.se', ...extraHeaders },
    };
    const res = {
      statusCode: 200,
      setHeader(name, value) { headers[String(name).toLowerCase()] = String(value); },
      end(value = '') { body = Buffer.isBuffer(value) ? value : Buffer.from(String(value)); },
    };

    await publishedProxyModule.default(req, res);
    return { statusCode: res.statusCode, headers, body: body.toString('utf8'), requests };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseUrl;
  }
}

const liveProxyCase = await runPublishedProxyCase('/site/user_123/project_456/about.html');
check('Published proxy resolves live pathname without relying on rewrite query params',
  liveProxyCase.statusCode === 200 &&
  liveProxyCase.headers['content-type'] === 'text/html; charset=utf-8' &&
  liveProxyCase.headers['content-disposition'] === 'inline' &&
  liveProxyCase.headers['x-tayar-published-site'] === '1' &&
  liveProxyCase.body.startsWith('<!doctype html>') &&
  liveProxyCase.requests[0]?.includes('/published-sites/user_123/project_456/about.html'));

const queryProxyCase = await runPublishedProxyCase('/api/published-site?ownerId=user_123&projectId=project_456&file=index.html');
check('Published proxy resolves explicit Vercel rewrite query parameters',
  queryProxyCase.statusCode === 200 &&
  queryProxyCase.headers['content-type'] === 'text/html; charset=utf-8' &&
  queryProxyCase.requests[0]?.includes('/published-sites/user_123/project_456/index.html'));

const previewProxyCase = await runPublishedProxyCase('/preview/user_123/project_456/token_789/index.html');
check('Preview proxy resolves token path and remains noindex',
  previewProxyCase.statusCode === 200 &&
  previewProxyCase.headers['x-robots-tag'] === 'noindex, nofollow, noarchive' &&
  previewProxyCase.requests[0]?.includes('/published-sites/user_123/project_456/previews/token_789/index.html'));

console.log(`Production hardening smoke test: ${passes.length} passed, ${failures.length} failed`);
for (const label of passes) console.log(`  ✓ ${label}`);
for (const label of failures) console.error(`  ✗ ${label}`);

if (failures.length) process.exit(1);
