import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { evaluateProductionMigrationInventory } from './production-migration-preflight.mjs';
import { evaluateProductionRolloutScope } from './production-rollout-scope-guard.mjs';
import { verifyMigrationSourceMap } from './verify-migration-source-map.mjs';

// Historical names/versions only, captured by a read-only Supabase list on
// 2026-10-23. No database is connected to, mutated or accessed by this CI test.
// A matching snapshot NEVER authorizes replay of pending SQL or a release.
const load = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const snapshot = await load('../supabase/production-migration-identity-snapshot-20261023.json');
const map = await load('../supabase/migration-source-map.json');
const manifest = await load('../supabase/production-rollout-scope-20261022.json');
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.productionProjectRef, map.projectRef);
assert.equal(snapshot.productionProjectRef, manifest.productionProjectRef);
assert.equal(snapshot.evidenceType, 'read-only-supabase-list-migrations-no-sql-or-user-data');
assert.equal(snapshot.migrations.length, 119);
assert.equal(new Set(snapshot.migrations.map(r => r.version)).size, 119);
const local = (await readdir(new URL('../supabase/migrations/', import.meta.url)))
  .filter(filename => filename.endsWith('.sql'));
assert.equal(local.length, 149);
const report = evaluateProductionMigrationInventory({ local, remote: snapshot.migrations, map });
assert.equal(report.historyIdentityMatched, true, JSON.stringify(report.errors));
assert.deepEqual(report.unknownRemote, []);
assert.equal(report.matchedDirectCount, 74);
assert.equal(report.matchedHistoricalCount, 45);
assert.equal(report.pendingHistorical.length, 9);
assert.equal(report.pendingCandidates.length, 21);
assert.equal(report.liveDatabaseRechecked, false);
assert.equal(report.releaseAuthorized, false);
const scope = evaluateProductionRolloutScope(report, manifest);
assert.equal(scope.scopeExact, true, JSON.stringify(scope.errors));
assert.equal(scope.pendingCount, 30);
assert.equal(scope.status, 'BLOCKED');
assert.equal(scope.databaseMutationAuthorized, false);
assert.equal(scope.customerActivationAuthorized, false);
const provenance = await verifyMigrationSourceMap(map, new URL('..', import.meta.url).pathname);
assert.deepEqual(provenance.issues, [], 'SHA-256 source map mismatches must fail CI');
const special = snapshot.migrations.find(row => row.version === '20260805165801');
assert.equal(special?.name, 'create_user_onboarding_table.sql');
assert.ok(local.includes('20260805165801_create_user_onboarding_table.sql.sql'));
const changed = structuredClone(snapshot.migrations);
changed[0].name = 'tampered_remote_identity';
const drift = evaluateProductionMigrationInventory({ local, remote: changed, map });
assert.equal(drift.historyIdentityMatched, false);
assert.equal(evaluateProductionRolloutScope(drift, manifest).scopeExact, false);
const unexpected = evaluateProductionMigrationInventory({
  local: [...local, '20261023000000_unreviewed.sql'], remote: snapshot.migrations, map,
});
assert.equal(evaluateProductionRolloutScope(unexpected, manifest).scopeExact, false);
console.log('PASS non-authorizing Production migration snapshot: 119 historical records, 149 local sources, 74 direct + 45 reviewed aliases, 30 held, unexpected versions blocked.');
