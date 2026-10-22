import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMigrationSourceMap } from './verify-migration-source-map.mjs';

const validVersion = value => typeof value === 'string' && /^\d{14}$/.test(value);
const validName = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,120}$/.test(value);
const filePattern = /^(\d{14})_([a-z][a-z0-9_]{0,120})\.sql$/;

/** Read-only inventory comparison, NOT proof of live database parity or permission to migrate. */
export function evaluateProductionMigrationInventory({ local, remote, map }) {
  const errors = [];
  if (!Array.isArray(local) || !Array.isArray(remote) || !map || !Array.isArray(map.renamed)
    || !Array.isArray(map.localWithoutRemoteName)) throw Error('Invalid migration inventory input.');
  const localVersions = new Map(), localNames = new Map();
  const remoteVersions = new Set(), remoteNames = new Set(), mappedVersions = new Map();
  const localHistorical = new Set();
  for (const filename of local) {
    const match = typeof filename === 'string' && filePattern.exec(filename);
    if (!match) { errors.push('Invalid local migration filename.'); continue; }
    const [, version, name] = match;
    if (localVersions.has(version) || localNames.has(name)) errors.push(`Duplicate local migration identity: ${filename}`);
    localVersions.set(version, { version, name, filename });
    localNames.set(name, { version, name, filename });
  }
  for (const row of map.renamed) {
    if (!validVersion(row?.remoteVersion) || !validVersion(row?.localVersion) || !validName(row?.name)
      || mappedVersions.has(row.remoteVersion)) { errors.push('Invalid or duplicate historical mapping.'); continue; }
    mappedVersions.set(row.remoteVersion, row);
    if (localVersions.get(row.localVersion)?.name !== row.name) errors.push(`Missing mapped local source: ${row.name}`);
  }
  for (const row of map.localWithoutRemoteName) {
    if (!validVersion(row?.version) || !validName(row?.name) || localVersions.get(row.version)?.name !== row.name) {
      errors.push('Unmapped historical source is missing or malformed.'); continue;
    }
    localHistorical.add(`${row.version}_${row.name}.sql`);
  }
  const appliedLocal = new Set(), unknownRemote = [], matchedByVersion = [], matchedByHistoricalMap = [];
  for (const row of remote) {
    if (!validVersion(row?.version) || !validName(row?.name)) {
      errors.push('Malformed remote history record.'); continue;
    }
    if (remoteVersions.has(row.version) || remoteNames.has(row.name)) errors.push(`Duplicate remote history identity: ${row.name}`);
    remoteVersions.add(row.version); remoteNames.add(row.name);
    const direct = localVersions.get(row.version);
    const mapped = mappedVersions.get(row.version);
    if (direct && direct.name === row.name && !mapped) {
      matchedByVersion.push(row.name); appliedLocal.add(direct.filename);
    } else if (mapped && mapped.name === row.name && !direct) {
      matchedByHistoricalMap.push(row.name);
      appliedLocal.add(`${mapped.localVersion}_${mapped.name}.sql`);
    } else {
      unknownRemote.push({ version: row.version, name: row.name });
    }
  }
  for (const row of map.renamed) {
    if (!remoteVersions.has(row.remoteVersion)) errors.push(`Historical source mapping not observed remotely: ${row.name}`);
  }
  const pendingHistorical = [], pendingCandidates = [];
  for (const localRow of localVersions.values()) {
    if (appliedLocal.has(localRow.filename)) continue;
    if (localHistorical.has(localRow.filename)) pendingHistorical.push(localRow.filename);
    else pendingCandidates.push(localRow.filename);
  }
  if (unknownRemote.length) errors.push('Some production migration history entries cannot be matched to reviewed source.');
  // This is an intentionally *permanently non-authorizing* diagnostic.
  return {
    evidence: 'offline-inventory-only',
    releaseAuthorized: false,
    status: 'BLOCKED',
    observedRemoteCount: remote.length,
    localSourceCount: localVersions.size,
    matchedDirectCount: matchedByVersion.length,
    matchedHistoricalCount: matchedByHistoricalMap.length,
    pendingHistorical,
    pendingCandidates,
    unknownRemote,
    errors,
    historyIdentityMatched: errors.length === 0,
    liveDatabaseRechecked: false,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshotFile = process.argv[2];
  if (!snapshotFile || process.argv.length !== 3) {
    console.error('Usage: node scripts/production-migration-preflight.mjs <read-only-supabase-migration-snapshot.json>');
    process.exitCode = 2;
  } else {
    try {
      const root = process.cwd();
      const [snapshot, map, files] = await Promise.all([
        readFile(resolve(snapshotFile), 'utf8').then(JSON.parse),
        readFile(resolve(root, 'supabase/migration-source-map.json'), 'utf8').then(JSON.parse),
        readdir(resolve(root, 'supabase/migrations')),
      ]);
      if (!snapshot || snapshot.projectRef !== map.projectRef || !Array.isArray(snapshot.migrations))
        throw Error('Remote snapshot missing or mismatched project identity.');
      const historical = await verifyMigrationSourceMap(map, root);
      const report = evaluateProductionMigrationInventory({
        local: files.filter(name => name.endsWith('.sql')),
        remote: snapshot.migrations,
        map,
      });
      if (historical.issues.length) report.errors.push('Historical source digest verification failed.');
      report.historyIdentityMatched = report.errors.length === 0;
      report.historicalSourcesVerified = historical.historicalSourcesVerified;
      console.log(JSON.stringify(report, null, 2));
      // Fail closed if *anything* remains unreviewed. A clean exit only means
      // this offline inventory comparison has no pending/unknown identities.
      // It does NOT authorize migration, deployment, or production promotion.
      process.exitCode = report.historyIdentityMatched
        && report.pendingHistorical.length === 0 && report.pendingCandidates.length === 0 ? 0 : 1;
    } catch (error) {
      console.error('Read-only preflight refused:', error.message);
      process.exitCode = 1;
    }
  }
}
