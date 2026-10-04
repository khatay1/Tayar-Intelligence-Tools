import assert from 'node:assert/strict';
import { inspectWebsiteInfrastructureActivation, infrastructureMigrationFiles }
  from './lib/website-infrastructure-activation-preflight.mjs';

const platform = 'https://abcdefghijklmnopqrst.supabase.co';
const environment = {
  TAYAR_INFRASTRUCTURE_ACTIVATION_MODE: 'isolated', SUPABASE_URL: platform,
  SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${'s'.repeat(32)}`,
  WEBSITE_GITHUB_APP_CLIENT_ID: 'Iv1_fixture', WEBSITE_GITHUB_APP_CLIENT_SECRET: 'g'.repeat(32),
  WEBSITE_SUPABASE_OAUTH_CLIENT_ID: 'supabase-client', WEBSITE_SUPABASE_OAUTH_CLIENT_SECRET: 'u'.repeat(32),
  WEBSITE_SUPABASE_PKCE_SECRET: 'p'.repeat(40), WEBSITE_SUPABASE_PLATFORM_ORGANIZATION_ID: 'isolated-org',
  WEBSITE_VERCEL_INTEGRATION_SLUG: 'tayar-connect', WEBSITE_VERCEL_CLIENT_ID: 'vercel-client',
  WEBSITE_VERCEL_CLIENT_SECRET: 'v'.repeat(32), TAYAR_PLATFORM_VERCEL_ACCOUNT_ID: 'team_isolated',
};
for (const provider of ['github', 'supabase', 'vercel']) {
  const upper = provider.toUpperCase(), functionName = `website-${provider}-connection`;
  environment[`WEBSITE_${upper}_CALLBACK_URL`] = `${platform}/functions/v1/${functionName}?action=callback`;
  environment[`WEBSITE_${upper}_RETURN_URL`] = 'https://isolated.tayar.example/builder';
  environment[`VITE_WEBSITE_${upper}_CONNECTION_URL`] = `${platform}/functions/v1/${functionName}`;
}
const ready = await inspectWebsiteInfrastructureActivation({ environment });
assert.equal(ready.ready, true);
assert.equal(ready.checks.find(check => check.id === 'publish-jwt-config').ok, true);
assert.equal(ready.checks.find(check => check.id === 'application-origin').ok, true);
assert.equal(infrastructureMigrationFiles.length, 32);
assert.ok(ready.checks.every(check => check.ok));
const serialized = JSON.stringify(ready);
for (const secret of [environment.SUPABASE_SERVICE_ROLE_KEY, environment.WEBSITE_GITHUB_APP_CLIENT_SECRET,
  environment.WEBSITE_SUPABASE_PKCE_SECRET])
  assert.ok(!serialized.includes(secret), 'report must not expose configured values');

const incomplete = await inspectWebsiteInfrastructureActivation({ environment: {} });
assert.equal(incomplete.ready, false);
assert.ok(incomplete.checks.find(check => check.id === 'configuration-presence').missing.includes('SUPABASE_SERVICE_ROLE_KEY'));
const wrongOrigin = await inspectWebsiteInfrastructureActivation({ environment: {
  ...environment, VITE_WEBSITE_GITHUB_CONNECTION_URL: 'https://attacker.example/functions/v1/website-github-connection',
  NEXT_PUBLIC_WEBSITE_GITHUB_APP_SECRET: 'leak',
} });
assert.equal(wrongOrigin.ready, false);
assert.deepEqual(wrongOrigin.checks.find(check => check.id === 'browser-endpoints').missing, ['github']);
assert.deepEqual(wrongOrigin.checks.find(check => check.id === 'no-public-secrets').missing,
  ['NEXT_PUBLIC_WEBSITE_GITHUB_APP_SECRET']);
const missingFiles = await inspectWebsiteInfrastructureActivation({ environment, exists: async () => false,
  readText: async () => { throw new Error('missing fixture'); } });
assert.equal(missingFiles.ready, false);
assert.equal(missingFiles.checks.find(check => check.id === 'migration-manifest').missing.length, 31);
assert.equal(missingFiles.checks.find(check => check.id === 'generated-functions').missing.length, 4);
assert.deepEqual(missingFiles.checks.find(check => check.id === 'production-deploy-isolation').missing,
  ['scripts/admin-hardening-deploy.ps1']);
console.log('PASS Infrastructure activation preflight: fixed migration/function manifest, exact URLs, isolated mode and secret-free report');
