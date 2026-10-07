import assert from 'node:assert/strict';
import { infrastructureMigrationFiles } from './lib/website-infrastructure-activation-preflight.mjs';
import { inspectWebsiteInfrastructureDeploymentInventory as inspect } from './lib/website-infrastructure-deployment-inventory.mjs';

const ref = 'abcdefghijklmnopqrst';
const input = { projectRef: ref, target: 'production',
  migrations: infrastructureMigrationFiles.map(file => ({ version: file.split('_')[0] })),
  functions: ['github', 'supabase', 'vercel'].map(provider => ({ name: `website-${provider}-connection`, status: 'ACTIVE', verify_jwt: false }))
    .concat({ name: 'website-byo-publish', status: 'ACTIVE', verify_jwt: true }),
  environmentKeys: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'WEBSITE_GITHUB_CONNECTION_URL',
    'WEBSITE_SUPABASE_CONNECTION_URL', 'WEBSITE_VERCEL_CONNECTION_URL'].map(key => ({ key: `VITE_${key}`, target: ['production'] })),
};
assert.equal(inspect(input, ref).inventoryReady, true);
assert.equal(inspect(input, ref).requiresConfigurationAndCustomerFlowVerification, true);
assert.equal(inspect(input, 'zzzzzzzzzzzzzzzzzzzz').inventoryReady, false);
assert.equal(inspect({}, ref).inventoryReady, false);
assert.equal(inspect({ ...input, target: 'unknown' }, ref).inventoryReady, false);
assert.equal(inspect({ ...input, migrations: input.migrations.slice(1) }, ref).inventoryReady, false);
assert.equal(inspect({ ...input, functions: input.functions.map(item => ({ ...item, verify_jwt: false })) }, ref).inventoryReady, false);
assert.equal(inspect({ ...input, functions: input.functions.map(item => ({ ...item, status: 'REMOVED' })) }, ref).inventoryReady, false);
assert.equal(inspect({ ...input, environmentKeys: input.environmentKeys.map(item => ({ ...item, target: ['preview'] })) }, ref).inventoryReady, false);
assert.equal(inspect({ ...input, environmentKeys: input.environmentKeys.map(item => ({ ...item, gitBranch: 'feature/test' })) }, ref).inventoryReady, false);
assert.equal(inspect({ ...input, environmentKeys: input.environmentKeys.map(item => ({ ...item, customEnvironmentIds: ['env_custom'] })) }, ref).inventoryReady, false);
assert.ok(!JSON.stringify(inspect({ ...input, secret: 'must-not-be-returned' }, ref)).includes('must-not-be-returned'));
console.log('PASS remote infrastructure inventory: exact project, applied migrations, active JWT configuration and target-scoped browser keys');
