import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateProductionRolloutScope } from './production-rollout-scope-guard.mjs';

const manifest = JSON.parse(await readFile(new URL('../supabase/production-rollout-scope-20261022.json', import.meta.url)));
const historical = manifest.groups['historical-needs-provenance'];
const candidates = Object.entries(manifest.groups).filter(([g]) => g !== 'historical-needs-provenance').flatMap(([,files])=>files);
const report = { pendingHistorical: historical, pendingCandidates: candidates, historyIdentityMatched: true, errors: [] };
const result = evaluateProductionRolloutScope(report,manifest);
assert.equal(historical.length,9);
assert.equal(candidates.length,21);
assert.equal(result.pendingCount,30);
assert.deepEqual(result.classificationCounts,{
  'historical-needs-provenance':9,
  'customer-production-release-hold':6,
  'social-hub-deferred':14,
  'stripe-handoff-deferred':1,
});
assert.equal(result.scopeExact,true);
assert.equal(result.status,'BLOCKED');
assert.equal(result.releaseAuthorized,false);
assert.equal(result.databaseMutationAuthorized,false);
assert.equal(result.customerActivationAuthorized,false);

const unexpected = evaluateProductionRolloutScope({ ...report,pendingCandidates:[...candidates,'20261101000000_unreviewed.sql'] },manifest);
assert.equal(unexpected.scopeExact,false);
assert.deepEqual(unexpected.unclassified,['20261101000000_unreviewed.sql']);
const stale = evaluateProductionRolloutScope({...report,pendingCandidates:candidates.slice(1)},manifest);
assert.equal(stale.scopeExact,false);
assert.equal(stale.staleClassifications.length,1);
const drift = evaluateProductionRolloutScope({...report,historyIdentityMatched:false},manifest);
assert.equal(drift.scopeExact,false);
const wrongGroup = evaluateProductionRolloutScope({...report,pendingHistorical:[...historical,candidates[0]],pendingCandidates:candidates.slice(1)},manifest);
assert.equal(wrongGroup.scopeExact,false);
assert.equal(wrongGroup.wronglyGrouped.length,1);
const duplicate = structuredClone(manifest);
duplicate.groups['stripe-handoff-deferred'].push(historical[0]);
assert.equal(evaluateProductionRolloutScope(report,duplicate).scopeExact,false);
const malformed = structuredClone(manifest);
malformed.groups['stripe-handoff-deferred'].push('../../etc/passwd');
assert.equal(evaluateProductionRolloutScope(report,malformed).scopeExact,false);
const extraGroup = structuredClone(manifest);extraGroup.groups['auto-apply']=[];
assert.throws(()=>evaluateProductionRolloutScope(report,extraGroup),/Invalid closed/);
console.log('PASS Production rollout scope: 9+6+14+1 migration groups, exact inventory checks, unexpected/stale/wrong-group/duplicate refusal; always non-authorizing');
