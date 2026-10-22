import assert from 'node:assert/strict';
import { evaluateProductionMigrationInventory } from './production-migration-preflight.mjs';

const same = '20261001000000_base.sql';
const oldName = '20261002000000_old_runtime.sql';
const historical = '20261003000000_legacy_unmapped.sql';
const future = '20261004000000_future_table.sql';
const map = {
  renamed: [{ name: 'old_runtime', localVersion: '20261002000000', remoteVersion: '20261002000001' }],
  localWithoutRemoteName: [{ name: 'legacy_unmapped', version: '20261003000000' }],
};
const local = [same, oldName, historical, future];
const remote = [{ version: '20261001000000', name: 'base' }, { version: '20261002000001', name: 'old_runtime' }];
const baseline = evaluateProductionMigrationInventory({ local, remote, map });
assert.equal(baseline.status, 'BLOCKED');
assert.equal(baseline.releaseAuthorized, false);
assert.equal(baseline.historyIdentityMatched, true);
assert.equal(baseline.matchedDirectCount, 1);
assert.equal(baseline.matchedHistoricalCount, 1);
assert.deepEqual(baseline.pendingHistorical, [historical]);
assert.deepEqual(baseline.pendingCandidates, [future]);
assert.equal(baseline.liveDatabaseRechecked, false);
assert.deepEqual(baseline.unknownRemote, []);

const foreign = evaluateProductionMigrationInventory({
  local, remote: [...remote, { version: '20261005000000', name: 'unknown' }], map,
});
assert.equal(foreign.historyIdentityMatched, false);
assert.equal(foreign.unknownRemote.length, 1);
assert.equal(foreign.releaseAuthorized, false);
const renamedIncorrectly = evaluateProductionMigrationInventory({
  local, remote: [remote[0], { ...remote[1], name: 'unexpected' }], map,
});
assert.ok(renamedIncorrectly.errors.length);
assert.equal(renamedIncorrectly.releaseAuthorized, false);
const missingMapping = evaluateProductionMigrationInventory({ local, remote, map: { ...map, renamed: [] } });
assert.ok(missingMapping.errors.length);
const duplicate = evaluateProductionMigrationInventory({ local: [...local, same], remote, map });
assert.ok(duplicate.errors.some(e => e.includes('Duplicate local')));
const duplicateRemote = evaluateProductionMigrationInventory({ local, remote: [...remote, remote[0]], map });
assert.ok(duplicateRemote.errors.some(e => e.includes('Duplicate remote')));
const removedSource = evaluateProductionMigrationInventory({ local: local.filter(n => n !== oldName), remote, map });
assert.ok(removedSource.errors.some(e => e.includes('Missing mapped local source')));
const matchedAll = evaluateProductionMigrationInventory({ local: [same, oldName], remote, map: { ...map, localWithoutRemoteName: [] } });
assert.equal(matchedAll.historyIdentityMatched, true);
assert.deepEqual(matchedAll.pendingCandidates, []);
assert.equal(matchedAll.releaseAuthorized, false, 'Even full inventory alignment never permits production mutation');
console.log('PASS read-only production migration preflight: 1:1 and historical matches, quarantined old sources, new candidates, malformed/foreign/duplicate refusal, no activation');
