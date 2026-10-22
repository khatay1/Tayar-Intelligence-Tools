import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateProductionMigrationInventory } from './production-migration-preflight.mjs';
import { verifyMigrationSourceMap } from './verify-migration-source-map.mjs';

const GROUPS = [
  'historical-needs-provenance',
  'customer-production-release-hold',
  'social-hub-deferred',
  'stripe-handoff-deferred',
];
const FILE = /^\d{14}_[a-z][a-z0-9_]{0,120}\.sql$/;

/**
 * Verify an operator-reviewed *classification*, not migration safety.
 * Does not approve applying ANY SQL or promoting Production.
 */
export function evaluateProductionRolloutScope(report, manifest) {
  if (!report || !manifest || manifest.version !== 1 || !manifest.groups
    || !GROUPS.every(group => Array.isArray(manifest.groups[group]))
    || Object.keys(manifest.groups).length !== GROUPS.length) {
    throw Error('Invalid closed production rollout scope.');
  }
  const errors = [];
  const memberships = new Map();
  for (const group of GROUPS) {
    for (const filename of manifest.groups[group]) {
      if (typeof filename !== 'string' || !FILE.test(filename)) {
        errors.push('Malformed scoped migration filename.');
        continue;
      }
      if (memberships.has(filename)) errors.push('Duplicate scoped migration across groups.');
      memberships.set(filename, group);
    }
  }
  const historical = report.pendingHistorical ?? [];
  const candidates = report.pendingCandidates ?? [];
  if (!Array.isArray(historical) || !Array.isArray(candidates)) throw Error('Invalid pending inventory.');
  const pending = [...historical, ...candidates];
  const pendingSet = new Set(pending);
  if (pendingSet.size !== pending.length) errors.push('Duplicated pending migration identity.');
  const unclassified = pending.filter(filename => !memberships.has(filename));
  const staleClassifications = [...memberships.keys()].filter(filename => !pendingSet.has(filename));
  const wronglyGrouped = [
    ...historical.filter(filename => memberships.get(filename) !== 'historical-needs-provenance'),
    ...candidates.filter(filename => memberships.get(filename) === 'historical-needs-provenance'),
  ];
  if (unclassified.length) errors.push('New or unexpected pending migration is unclassified.');
  if (staleClassifications.length) errors.push('Classification contains migrations no longer pending.');
  if (wronglyGrouped.length) errors.push('Historical vs new candidate classification mismatch.');
  if (!report.historyIdentityMatched || (report.errors?.length ?? 0) !== 0) {
    errors.push('Remote migration history is not fully mapped to trusted local sources.');
  }
  return {
    status: 'BLOCKED',
    releaseAuthorized: false,
    databaseMutationAuthorized: false,
    customerActivationAuthorized: false,
    scopeExact: errors.length === 0,
    pendingCount: pending.length,
    classificationCounts: Object.fromEntries(GROUPS.map(group => [group, manifest.groups[group].length])),
    unclassified,
    staleClassifications,
    wronglyGrouped,
    errors,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/production-rollout-scope-guard.mjs <read-only-production-migration-snapshot.json>');
    process.exitCode = 2;
  } else {
    try {
      const root = process.cwd();
      const [snapshot, map, manifest, files] = await Promise.all([
        readFile(resolve(process.argv[2]), 'utf8').then(JSON.parse),
        readFile(resolve(root, 'supabase/migration-source-map.json'), 'utf8').then(JSON.parse),
        readFile(resolve(root, 'supabase/production-rollout-scope-20261022.json'), 'utf8').then(JSON.parse),
        readdir(resolve(root, 'supabase/migrations')),
      ]);
      if (snapshot?.projectRef !== map.projectRef || manifest.productionProjectRef !== map.projectRef)
        throw Error('Production project reference mismatch.');
      if (!Array.isArray(snapshot.migrations)) throw Error('Missing read-only migration history.');
      const report = evaluateProductionMigrationInventory({
        local: files.filter(filename => filename.endsWith('.sql')),
        remote: snapshot.migrations,
        map,
      });
      const scope = evaluateProductionRolloutScope(report, manifest);
      const provenance = await verifyMigrationSourceMap(map, root);
      if (provenance.issues.length) {
        scope.errors.push('Historical source digest verification failed.');
        scope.scopeExact = false;
      }
      console.log(JSON.stringify(scope, null, 2));
      // Even a completely classified inventory never authorizes execution.
      // Exit success ONLY as a scope inventory diagnostic, not a release check.
      // Calling workflows must not use this as an approval gate.
      process.exitCode = scope.scopeExact ? 0 : 1;
    } catch (error) {
      console.error('Read-only scope guard refused:', error.message);
      process.exitCode = 1;
    }
  }
}
