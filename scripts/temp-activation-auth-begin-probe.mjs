import { randomBytes, randomUUID } from 'node:crypto';

const base = 'https://uepltkguloltmebepvbo.supabase.co';
const apiKey = 'sb_publishable_XPyyhranUSrm3ArH7sntqg_nAXqto_J';
const email = `tayar-e2e-${process.env.GITHUB_RUN_ID || Date.now()}-${process.env.GITHUB_RUN_ATTEMPT || 1}@example.com`;
const password = randomBytes(24).toString('hex');

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  return { response, body };
}
function safeError(body) {
  return String(body?.msg ?? body?.message ?? body?.error_description ?? body?.error ?? 'unknown').slice(0, 240);
}

const signup = await jsonFetch(`${base}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: apiKey, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, data: { purpose: 'tayar-activation-e2e' } }),
});
const userId = typeof signup.body?.user?.id === 'string' ? signup.body.user.id : '';
const accessToken = typeof signup.body?.access_token === 'string' ? signup.body.access_token : '';
console.log(`SIGNUP_HTTP=${signup.response.status}`);
console.log(`USER_ID=${userId}`);
if (!userId) {
  console.log(`SIGNUP_ERROR=${safeError(signup.body)}`);
  process.exit(2);
}
if (!accessToken) {
  console.log('SIGNUP_SESSION=missing');
  process.exit(3);
}
console.log('SIGNUP_SESSION=present');

const projectId = randomUUID();
const fixture = {
  id: projectId,
  user_id: userId,
  title: 'Tayar Fullstack MAX Preview E2E',
  type: 'website-builder',
  status: 'draft',
  content: {
    homePageId: 'home',
    siteName: 'Tayar Fullstack MAX Preview E2E',
    application: {
      version: 1,
      tables: [],
      roles: [],
      auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true },
      pageAccess: [{ pageId: 'dashboard', access: 'authenticated' }],
    },
    pages: [
      { id: 'home', name: 'Home', slug: 'home', language: 'en', sections: [] },
      { id: 'dashboard', name: 'Dashboard', slug: 'dashboard', language: 'en', sections: [] },
    ],
  },
};
const project = await jsonFetch(`${base}/rest/v1/projects?select=id,user_id,type,status`, {
  method: 'POST',
  headers: {
    apikey: apiKey,
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    prefer: 'return=representation',
  },
  body: JSON.stringify(fixture),
});
console.log(`PROJECT_HTTP=${project.response.status}`);
console.log(`PROJECT_ID=${projectId}`);
if (!project.response.ok) {
  console.log(`PROJECT_ERROR=${safeError(project.body)}`);
  process.exit(4);
}

const expectations = {
  github: { host: 'github.com', path: '/login/oauth/authorize' },
  supabase: { host: 'api.supabase.com' },
  vercel: { host: 'vercel.com' },
};
for (const provider of ['github', 'supabase', 'vercel']) {
  const begin = await jsonFetch(`${base}/functions/v1/website-${provider}-connection?action=begin`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ projectId, environment: 'preview' }),
  });
  console.log(`${provider.toUpperCase()}_BEGIN_HTTP=${begin.response.status}`);
  const authorizationUrl = typeof begin.body?.authorizationUrl === 'string' ? begin.body.authorizationUrl : '';
  if (!begin.response.ok || !authorizationUrl) {
    console.log(`${provider.toUpperCase()}_BEGIN_ERROR=${safeError(begin.body)}`);
    process.exit(10);
  }
  const parsed = new URL(authorizationUrl);
  const expected = expectations[provider];
  if (parsed.protocol !== 'https:' || parsed.hostname !== expected.host
      || (expected.path && parsed.pathname !== expected.path) || !parsed.searchParams.get('state')) {
    console.log(`${provider.toUpperCase()}_BEGIN_ERROR=unexpected_authorization_url`);
    process.exit(11);
  }
  console.log(`${provider.toUpperCase()}_AUTH_ORIGIN=${parsed.origin}`);
  console.log(`${provider.toUpperCase()}_AUTH_PATH=${parsed.pathname}`);
}
console.log('ACTIVATION_BEGIN_PROBE=success');
