import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function migrationSqlDigest(input) {
  const bytes = Buffer.from(input);
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 10 || bytes[end - 1] === 13)) end--;
  return createHash('sha256').update(bytes.subarray(0, end)).digest('hex');
}

/** Offline evidence of historical source identity only. Never connects to a
 * database, renames migrations, repairs history or authorizes deployment. */
export async function verifyMigrationSourceMap(map, root = process.cwd()) {
  const issues = [];
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const version = value => typeof value === 'string' && /^\d{14}$/.test(value);
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const name = value => typeof value === 'string' && /^[a-z][a-z0-9_]{0,120}$/.test(value);
  const allowed = ['version', 'observedAt', 'projectRef', 'baselineCommit', 'normalization', 'renamed', 'localWithoutRemoteName'];
  if (!object(map) || Object.keys(map).some(key => !allowed.includes(key)) || map.version !== 1
    || typeof map.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(map.observedAt)
    || typeof map.projectRef !== 'string' || !/^[a-z]{20}$/.test(map.projectRef)
    || typeof map.baselineCommit !== 'string' || !/^[a-f0-9]{40}$/.test(map.baselineCommit)
    || map.normalization !== 'Remove trailing CR/LF only; preserve every other SQL byte. Remote statements joined by LF.'
    || !Array.isArray(map.renamed) || !Array.isArray(map.localWithoutRemoteName)
    || map.renamed.length > 500 || map.localWithoutRemoteName.length > 500) {
    return { issues: ['Invalid migration source map.'], historicalSourcesVerified: 0, localSourcesWithoutRemoteName: 0, historyAligned: false, liveDatabaseRechecked: false };
  }
  const paths = new Set(), localVersions = new Set(), remoteVersions = new Set(), names = new Set();
  let verified = 0, unmatched = 0;
  for (const [kind, rows] of [['renamed', map.renamed], ['localWithoutRemoteName', map.localWithoutRemoteName]]) {
    for (const row of rows) {
      const renamed = kind === 'renamed';
      const localVersion = renamed ? row?.localVersion : row?.version;
      const keys = renamed ? ['name', 'localVersion', 'remoteVersion', 'path', 'sqlSha256'] : ['path', 'version', 'name', 'sqlSha256'];
      if (!object(row) || Object.keys(row).some(key => !keys.includes(key)) || !version(localVersion) || !name(row.name)
        || !hash(row.sqlSha256) || row.path !== `supabase/migrations/${localVersion}_${row.name}.sql`
        || (renamed && (!version(row.remoteVersion) || row.remoteVersion === localVersion))) {
        issues.push('Invalid migration mapping entry.');
        continue;
      }
      if (paths.has(row.path) || localVersions.has(localVersion) || names.has(row.name)
        || (renamed && remoteVersions.has(row.remoteVersion))) {
        issues.push(`Duplicate or ambiguous migration mapping: ${row.name}.`);
        continue;
      }
      paths.add(row.path); localVersions.add(localVersion); names.add(row.name);
      if (renamed) remoteVersions.add(row.remoteVersion);
      try {
        if (migrationSqlDigest(await readFile(resolve(root, row.path))) !== row.sqlSha256) issues.push(`Migration source changed: ${row.path}.`);
        else if (renamed) verified++;
        else unmatched++;
      } catch { issues.push(`Migration source is unavailable: ${row.path}.`); }
    }
  }
  // Check every source filename, including unchanged/unmapped historical files.
  try {
    const versions = new Set((await readdir(resolve(root, 'supabase/migrations'))).filter(file => /^\d{14}_.+\.sql$/.test(file)).map(file => file.slice(0, 14)));
    for (const remoteVersion of remoteVersions) if (versions.has(remoteVersion)) issues.push('Remote timestamp collides with an existing local migration.');
  } catch { issues.push('Migration source directory is unavailable.'); }
  return { issues, historicalSourcesVerified: verified, localSourcesWithoutRemoteName: unmatched, historyAligned: false, liveDatabaseRechecked: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const map = JSON.parse(await readFile('supabase/migration-source-map.json', 'utf8'));
    const result = await verifyMigrationSourceMap(map);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.issues.length ? 1 : 0;
  } catch {
    console.error('Migration source map unavailable; no database action was performed.');
    process.exitCode = 1;
  }
}
