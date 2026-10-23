import assert from 'node:assert/strict';
import { infrastructureMigrationFiles } from './lib/website-infrastructure-activation-preflight.mjs';
import { inspectWebsiteInfrastructureReleaseCandidate as inspect } from './lib/website-infrastructure-release-candidate.mjs';

const candidateRef = 'abcdefghijklmnopqrst', productionRef = 'zzzzzzzzzzzzzzzzzzzz';
const rpcFunctions = [
  'website_link_application_backend', 'website_application_backend_credential',
  'website_record_application_backend', 'website_application_backend_record',
  'website_application_backend_public', 'website_application_published_release',
  'website_commit_application_release', 'website_application_release_outcome',
  'website_application_release_credential',
];
const input = {
  projectRef: candidateRef, target: 'preview', isolationKind: 'dedicated-project', projectStatus: 'ACTIVE_HEALTHY',
  migrations: infrastructureMigrationFiles.map(file => ({ version: file.split('_')[0] })),
  functions: ['github', 'supabase', 'vercel'].map(provider =>
    ({ name: `website-${provider}-connection`, status: 'ACTIVE', verify_jwt: false }))
    .concat(['website-byo-publish', 'website-application-backend-link', 'website-application-release']
      .map(name => ({ name, status: 'ACTIVE', verify_jwt: true }))),
  environmentKeys: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'WEBSITE_GITHUB_CONNECTION_URL',
    'WEBSITE_SUPABASE_CONNECTION_URL', 'WEBSITE_VERCEL_CONNECTION_URL']
    .map(key => ({ key: `VITE_${key}`, target: ['preview'] })),
  migrationHistory: { aligned: true, unknownRemoteCount: 0, missingRemoteCount: 0, pendingReviewCount: 0 },
  databaseCatalog: {
    projects: { rlsEnabled: true, ownerIsolationVerified: true, columns: ['id', 'user_id', 'content', 'created_at'] },
    applicationPermissionsVerified: true,
    rpcFunctions,
    buckets: [{ id: 'published-sites', public: false }, { id: 'website-application-releases', public: false }],
  },
};

const valid = inspect(input, candidateRef, productionRef);
assert.equal(valid.releaseCandidateReady, true);
assert.equal(valid.releaseAuthorized, false);
assert.equal(valid.productionPublishAuthorized, false);
assert.equal(valid.requiresCustomerFlowVerification, true);
assert.equal(valid.requiresIndependentProductionApproval, true);

const failures = [
  { ...input, projectRef: productionRef },
  { ...input, target: 'production' },
  { ...input, isolationKind: 'shared' },
  { ...input, projectStatus: 'INACTIVE' },
  { ...input, migrationHistory: { ...input.migrationHistory, aligned: false } },
  { ...input, migrationHistory: { ...input.migrationHistory, unknownRemoteCount: 1 } },
  { ...input, migrationHistory: { ...input.migrationHistory, missingRemoteCount: 1 } },
  { ...input, migrationHistory: { ...input.migrationHistory, pendingReviewCount: 1 } },
  { ...input, databaseCatalog: { ...input.databaseCatalog,
    projects: { ...input.databaseCatalog.projects, rlsEnabled: false } } },
  { ...input, databaseCatalog: { ...input.databaseCatalog,
    projects: { ...input.databaseCatalog.projects, ownerIsolationVerified: false } } },
  { ...input, databaseCatalog: { ...input.databaseCatalog,
    projects: { ...input.databaseCatalog.projects, columns: ['id', 'content'] } } },
  { ...input, databaseCatalog: { ...input.databaseCatalog, rpcFunctions: rpcFunctions.slice(1) } },
  { ...input, databaseCatalog: { ...input.databaseCatalog, rpcFunctions: [...rpcFunctions, rpcFunctions[0]] } },
  { ...input, databaseCatalog: { ...input.databaseCatalog, applicationPermissionsVerified: false } },
  { ...input, databaseCatalog: { ...input.databaseCatalog,
    buckets: [{ id: 'published-sites', public: true }, { id: 'website-application-releases', public: false }] } },
  { ...input, databaseCatalog: { ...input.databaseCatalog,
    buckets: [{ id: 'website-application-releases', public: false }] } },
];
for (const failure of failures) assert.equal(inspect(failure, candidateRef, productionRef).releaseCandidateReady, false);
assert.equal(inspect(input, candidateRef, candidateRef).releaseCandidateReady, false);
assert.equal(inspect({}, candidateRef, productionRef).releaseCandidateReady, false);
assert.ok(!JSON.stringify(inspect({ ...input, secret: 'must-not-be-returned' }, candidateRef, productionRef))
  .includes('must-not-be-returned'));

const activationShape = { ...input, migrationHistory: { ...input.migrationHistory, aligned: false,
  unknownRemoteCount: 5, missingRemoteCount: 8 }, databaseCatalog: { ...input.databaseCatalog,
  buckets: [{ id: 'published-sites', public: true }, { id: 'website-application-releases', public: false }] } };
const blocked = inspect(activationShape, candidateRef, productionRef);
assert.equal(blocked.releaseCandidateReady, false);
assert.equal(blocked.checks.find(check => check.id === 'migration-history-alignment').ok, false);
assert.deepEqual(blocked.checks.find(check => check.id === 'private-application-storage').missing, ['published-sites']);

console.log('PASS release-candidate guard: isolated healthy preview, aligned reviewed history, tenant isolation, application permissions, complete RPC catalog and private storage required; never authorizes promotion');

