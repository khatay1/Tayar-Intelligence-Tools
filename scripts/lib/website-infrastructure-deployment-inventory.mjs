import { infrastructureMigrationFiles } from './website-infrastructure-activation-preflight.mjs';

const functions = Object.freeze([
  { name: 'website-github-connection', verify_jwt: false },
  { name: 'website-supabase-connection', verify_jwt: false },
  { name: 'website-vercel-connection', verify_jwt: false },
  { name: 'website-byo-publish', verify_jwt: true },
]);
const keys = Object.freeze([
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'VITE_WEBSITE_GITHUB_CONNECTION_URL', 'VITE_WEBSITE_SUPABASE_CONNECTION_URL',
  'VITE_WEBSITE_VERCEL_CONNECTION_URL',
]);

/** Names-only remote inventory. This complements configuration preflight; it
 * does not attest OAuth consent, endpoint values, or a working customer flow. */
export function inspectWebsiteInfrastructureDeploymentInventory(input = {}, expectedProjectRef) {
  const checks = [];
  const check = (id, missing) => checks.push({ id, ok: missing.length === 0,
    ...(missing.length ? { missing } : {}) });
  check('project-identity', /^[a-z0-9]{20}$/.test(expectedProjectRef ?? '')
    && input.projectRef === expectedProjectRef ? [] : ['projectRef']);
  check('deployment-target', ['preview', 'production'].includes(input.target) ? [] : ['target']);
  const migrations = new Set((Array.isArray(input.migrations) ? input.migrations : [])
    .filter(item => item && typeof item.version === 'string').map(item => item.version));
  check('applied-migrations', infrastructureMigrationFiles.filter(file => !migrations.has(file.split('_')[0])));
  const deployed = Array.isArray(input.functions) ? input.functions : [];
  check('active-functions', functions.filter(expected => !deployed.some(actual =>
    actual?.name === expected.name && actual.status === 'ACTIVE'
      && actual.verify_jwt === expected.verify_jwt)).map(item => item.name));
  const environment = Array.isArray(input.environmentKeys) ? input.environmentKeys : [];
  check('target-browser-configuration', keys.filter(key => !environment.some(item =>
    item?.key === key && Array.isArray(item.target) && item.target.includes(input.target)
      && !item.gitBranch && !item.customEnvironmentIds?.length)));
  return { schemaVersion: 1, inventoryReady: checks.every(item => item.ok),
    requiresConfigurationAndCustomerFlowVerification: true, checks };
}
