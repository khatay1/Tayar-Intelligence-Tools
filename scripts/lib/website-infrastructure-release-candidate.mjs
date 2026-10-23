import { inspectWebsiteInfrastructureDeploymentInventory } from './website-infrastructure-deployment-inventory.mjs';

const requiredRpcFunctions = Object.freeze([
  'website_link_application_backend',
  'website_application_backend_credential',
  'website_record_application_backend',
  'website_application_backend_record',
  'website_application_backend_public',
  'website_application_published_release',
  'website_commit_application_release',
  'website_application_release_outcome',
  'website_application_release_credential',
]);
const requiredProjectColumns = Object.freeze(['id', 'user_id', 'content']);
const requiredPrivateBuckets = Object.freeze(['published-sites', 'website-application-releases']);
const projectRef = value => typeof value === 'string' && /^[a-z0-9]{20}$/.test(value);

/** Sanitized, read-only release-candidate evidence. This deliberately requires
 * a non-production Supabase target whose migration history and application
 * catalog were inspected. Passing it never authorizes deployment or promotion. */
export function inspectWebsiteInfrastructureReleaseCandidate(input = {}, expectedCandidateRef, productionProjectRef) {
  const inventory = inspectWebsiteInfrastructureDeploymentInventory(input, expectedCandidateRef);
  const checks = [...inventory.checks];
  const check = (id, missing) => checks.push({ id, ok: missing.length === 0,
    ...(missing.length ? { missing } : {}) });

  check('isolated-candidate', projectRef(expectedCandidateRef)
    && projectRef(productionProjectRef) && expectedCandidateRef !== productionProjectRef
    && input.projectRef === expectedCandidateRef && input.target === 'preview'
    && ['dedicated-project', 'preview-branch'].includes(input.isolationKind)
    ? [] : ['isolated-preview-project']);
  check('candidate-health', input.projectStatus === 'ACTIVE_HEALTHY' ? [] : ['projectStatus']);

  const history = input.migrationHistory;
  check('migration-history-alignment', history?.aligned === true
    && history?.unknownRemoteCount === 0 && history?.missingRemoteCount === 0
    && history?.pendingReviewCount === 0 ? [] : ['aligned-reviewed-history']);

  const catalog = input.databaseCatalog;
  const projectColumns = new Set(Array.isArray(catalog?.projects?.columns) ? catalog.projects.columns : []);
  check('projects-tenant-boundary', catalog?.projects?.rlsEnabled === true
    && catalog?.projects?.ownerIsolationVerified === true
    && requiredProjectColumns.every(column => projectColumns.has(column))
    ? [] : [
      ...(catalog?.projects?.rlsEnabled === true ? [] : ['projects:rls']),
      ...(catalog?.projects?.ownerIsolationVerified === true ? [] : ['projects:owner-isolation']),
      ...requiredProjectColumns.filter(column => !projectColumns.has(column)),
    ]);

  const rpcFunctions = Array.isArray(catalog?.rpcFunctions) ? catalog.rpcFunctions : [];
  check('application-rpc-catalog', requiredRpcFunctions.filter(name =>
    rpcFunctions.filter(actual => actual === name).length !== 1));
  check('application-permissions', catalog?.applicationPermissionsVerified === true
    ? [] : ['application-permissions']);

  const buckets = Array.isArray(catalog?.buckets) ? catalog.buckets : [];
  check('private-application-storage', requiredPrivateBuckets.filter(name => {
    const matches = buckets.filter(bucket => bucket?.id === name);
    return matches.length !== 1 || matches[0].public !== false;
  }));

  return { schemaVersion: 1, releaseCandidateReady: checks.every(item => item.ok),
    releaseAuthorized: false, productionPublishAuthorized: false,
    requiresCustomerFlowVerification: true, requiresIndependentProductionApproval: true, checks };
}

