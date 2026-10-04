import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const infrastructureMigrationFiles = Object.freeze([
  '20260928205027_website_byo_infrastructure_connections.sql',
  '20260928215024_website_byo_oauth_state.sql',
  '20260928215959_website_byo_connection_handoff.sql',
  '20260929001500_website_byo_github_export_cursor.sql',
  '20260929170000_website_byo_supabase_oauth_custody.sql',
  '20260929182500_website_byo_supabase_disconnect.sql',
  '20260929190000_website_byo_custody_cleanup_schedule.sql',
  '20260929223000_website_byo_supabase_project_binding.sql',
  '20260929233000_website_byo_vercel_project_binding.sql',
  '20260930003000_website_byo_vercel_disconnect.sql',
  '20260930013000_website_byo_vercel_deployment_attempt.sql',
  '20260930020000_website_byo_vercel_secret_handoff.sql',
  '20260930023000_website_byo_vercel_secret_removal.sql',
  '20260930030000_website_byo_publish_checkpoint.sql',
  '20260930033000_website_byo_publish_adapters.sql',
  '20260930040000_website_byo_vercel_promotion.sql',
  '20260930043000_website_byo_production_publish_checkpoint.sql',
  '20260930050000_website_byo_publish_targets.sql',
  '20260930053000_website_byo_runtime_binding.sql',
  '20260930054500_website_byo_runtime_binding_reconciliation.sql',
  '20260930220555_website_byo_supabase_migration_attempts.sql',
  '20261001172554_website_byo_supabase_migration_target.sql',
  '20261001180025_website_byo_backend_preparation_target.sql',
  '20261002083524_website_byo_runtime_binding_identity.sql',
  '20261002084455_website_byo_runtime_environment_receipts.sql',
  '20261002085813_website_byo_runtime_environment_rotation.sql',
  '20261002090825_website_byo_deployment_runtime_receipt.sql',
  '20261002100908_website_byo_production_runtime_environment.sql',
  '20261002144040_website_byo_vercel_runtime_disconnect_cleanup.sql',
  '20261003231500_website_byo_github_oauth_custody.sql',
  '20261003231600_website_byo_github_custody_cleanup_schedule.sql',
  '20261004110500_website_byo_vercel_secret_handoff_recovery.sql',
  '20261004113000_website_byo_stripe_runtime_binding.sql',
]);

const publishFunctionName = 'website-byo-publish';
const providers = Object.freeze({
  github: {
    functionName: 'website-github-connection',
    callback: 'WEBSITE_GITHUB_CALLBACK_URL', returnUrl: 'WEBSITE_GITHUB_RETURN_URL', publicUrl: 'VITE_WEBSITE_GITHUB_CONNECTION_URL',
    secrets: ['WEBSITE_GITHUB_APP_CLIENT_ID', 'WEBSITE_GITHUB_APP_CLIENT_SECRET'],
  },
  supabase: {
    functionName: 'website-supabase-connection',
    callback: 'WEBSITE_SUPABASE_CALLBACK_URL', returnUrl: 'WEBSITE_SUPABASE_RETURN_URL', publicUrl: 'VITE_WEBSITE_SUPABASE_CONNECTION_URL',
    secrets: ['WEBSITE_SUPABASE_OAUTH_CLIENT_ID', 'WEBSITE_SUPABASE_OAUTH_CLIENT_SECRET', 'WEBSITE_SUPABASE_PKCE_SECRET',
      'WEBSITE_SUPABASE_PLATFORM_ORGANIZATION_ID'],
  },
  vercel: {
    functionName: 'website-vercel-connection',
    callback: 'WEBSITE_VERCEL_CALLBACK_URL', returnUrl: 'WEBSITE_VERCEL_RETURN_URL', publicUrl: 'VITE_WEBSITE_VERCEL_CONNECTION_URL',
    secrets: ['WEBSITE_VERCEL_INTEGRATION_SLUG', 'WEBSITE_VERCEL_CLIENT_ID', 'WEBSITE_VERCEL_CLIENT_SECRET',
      'TAYAR_PLATFORM_VERCEL_ACCOUNT_ID'],
  },
});
const nonEmpty = value => typeof value === 'string' && value.length > 0 && value.trim() === value && !value.includes('\0');
const safeUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
};
const result = (id, ok, missing = []) => Object.freeze({ id, ok, ...(missing.length ? { missing: Object.freeze([...missing]) } : {}) });

/** Read-only activation inspection. The report contains key/file names only;
 * it never returns configured values, provider tokens or secret material. */
export async function inspectWebsiteInfrastructureActivation(input = {}) {
  const environment = input.environment ?? process.env;
  const root = input.root ?? process.cwd();
  const exists = input.exists ?? (async path => { try { await access(path); return true; } catch { return false; } });
  const readText = input.readText ?? (path => readFile(path, 'utf8'));
  const checks = [];
  checks.push(result('isolated-mode', environment.TAYAR_INFRASTRUCTURE_ACTIVATION_MODE === 'isolated',
    environment.TAYAR_INFRASTRUCTURE_ACTIVATION_MODE === 'isolated' ? [] : ['TAYAR_INFRASTRUCTURE_ACTIVATION_MODE=isolated']));

  const missingMigrations = [];
  for (const file of infrastructureMigrationFiles)
    if (!(await exists(join(root, 'supabase/migrations', file)))) missingMigrations.push(file);
  checks.push(result('migration-manifest', missingMigrations.length === 0, missingMigrations));

  const functionFiles = [
    ...Object.values(providers).map(provider => `supabase/functions/${provider.functionName}/index.ts`),
    `supabase/functions/${publishFunctionName}/index.ts`,
  ];
  const missingFunctions = [];
  for (const file of functionFiles) if (!(await exists(join(root, file)))) missingFunctions.push(file);
  checks.push(result('generated-functions', missingFunctions.length === 0, missingFunctions));

  let config = '', deploymentGuard = '', deploymentGuardReadable = false;
  try { config = await readText(join(root, 'supabase/config.toml')); } catch { /* reported below */ }
  try {
    deploymentGuard = await readText(join(root, 'scripts/admin-hardening-deploy.ps1'));
    deploymentGuardReadable = true;
  } catch { /* reported below */ }
  const badConfig = Object.values(providers).filter(provider =>
    !config.includes(`[functions.${provider.functionName}]\nverify_jwt = false`)).map(provider => provider.functionName);
  checks.push(result('callback-jwt-config', badConfig.length === 0, badConfig));
  const publishJwtConfig = config.includes(`[functions.${publishFunctionName}]\nverify_jwt = true`);
  checks.push(result('publish-jwt-config', publishJwtConfig, publishJwtConfig ? [] : [publishFunctionName]));
  const accidentallyDeployed = Object.values(providers).filter(provider =>
    new RegExp(`['\"]${provider.functionName}['\"]`).test(deploymentGuard)).map(provider => provider.functionName);
  if (!deploymentGuardReadable) accidentallyDeployed.unshift('scripts/admin-hardening-deploy.ps1');
  checks.push(result('production-deploy-isolation', accidentallyDeployed.length === 0, accidentallyDeployed));

  const requiredKeys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    ...Object.values(providers).flatMap(provider => provider.secrets),
    ...Object.values(providers).flatMap(provider => [provider.callback, provider.returnUrl, provider.publicUrl])];
  const missingKeys = [...new Set(requiredKeys)].filter(key => !nonEmpty(environment[key]));
  checks.push(result('configuration-presence', missingKeys.length === 0, missingKeys));

  const applicationReturn = safeUrl(environment.WEBSITE_GITHUB_RETURN_URL);
  const applicationOrigin = applicationReturn && !applicationReturn.search && !applicationReturn.hash
    ? applicationReturn.origin : null;
  checks.push(result('application-origin', Boolean(applicationOrigin),
    applicationOrigin ? [] : ['WEBSITE_GITHUB_RETURN_URL']));
  const platform = safeUrl(environment.SUPABASE_URL);
  const platformOrigin = platform && platform.origin === environment.SUPABASE_URL && platform.pathname === '/'
    && /^[a-z0-9]{20}[.]supabase[.]co$/.test(platform.hostname) ? platform.origin : null;
  checks.push(result('platform-origin', Boolean(platformOrigin), platformOrigin ? [] : ['SUPABASE_URL']));
  const callbackFailures = [], endpointFailures = [], returnFailures = [], returnOrigins = new Set();
  for (const [name, provider] of Object.entries(providers)) {
    const callback = safeUrl(environment[provider.callback]);
    if (!platformOrigin || !callback || callback.origin !== platformOrigin
      || callback.pathname !== `/functions/v1/${provider.functionName}` || callback.search !== '?action=callback' || callback.hash)
      callbackFailures.push(name);
    const endpoint = safeUrl(environment[provider.publicUrl]);
    if (!platformOrigin || !endpoint || endpoint.origin !== platformOrigin
      || endpoint.pathname !== `/functions/v1/${provider.functionName}` || endpoint.search || endpoint.hash
      || endpoint.toString() !== environment[provider.publicUrl]) endpointFailures.push(name);
    const destination = safeUrl(environment[provider.returnUrl]);
    if (!destination || destination.search || destination.hash) returnFailures.push(name);
    else returnOrigins.add(destination.origin);
  }
  if (returnOrigins.size > 1) returnFailures.push('shared-origin');
  if (applicationOrigin && returnOrigins.size === 1 && !returnOrigins.has(applicationOrigin))
    returnFailures.push('application-origin');
  checks.push(result('oauth-callbacks', callbackFailures.length === 0, callbackFailures));
  checks.push(result('browser-endpoints', endpointFailures.length === 0, endpointFailures));
  checks.push(result('browser-return-origin', returnFailures.length === 0, returnFailures));

  const exposedSecretNames = Object.keys(environment).filter(key => nonEmpty(environment[key])
    && /^(?:VITE_|NEXT_PUBLIC_|PUBLIC_).*?(?:SECRET|SERVICE_ROLE|PRIVATE_KEY|PKCE)/i.test(key));
  checks.push(result('no-public-secrets', exposedSecretNames.length === 0, exposedSecretNames));
  return Object.freeze({ schemaVersion: 1, ready: checks.every(check => check.ok), checks: Object.freeze(checks) });
}
