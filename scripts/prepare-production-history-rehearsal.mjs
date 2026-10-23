import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluateProductionMigrationInventory } from './production-migration-preflight.mjs';
import { evaluateProductionRolloutScope } from './production-rollout-scope-guard.mjs';
import { verifyMigrationSourceMap } from './verify-migration-source-map.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fileName = (version, name) => version + '_' + name + '.sql';

/**
 * Prepare *sources* for a future ISOLATED rehearsal, never a runnable
 * Production candidate. Does not connect to PostgreSQL or apply SQL.
 * Fixed inventory counts are intentional: new migrations require human review.
 */
export async function prepareHistoricalRehearsalSources(root = process.cwd(), options = {}) {
  const directory = resolve(root);
  const [map, snapshot, scopeManifest, existing] = await Promise.all([
    readFile(join(directory, 'supabase/migration-source-map.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'supabase/production-migration-identity-snapshot-20261023.json'), 'utf8').then(JSON.parse),
    readFile(join(directory, 'supabase/production-rollout-scope-20261022.json'), 'utf8').then(JSON.parse),
    readdir(join(directory, 'supabase/migrations')),
  ]);
  if (snapshot.schemaVersion !== 1 || snapshot.productionProjectRef !== map.projectRef
    || scopeManifest.productionProjectRef !== map.projectRef
    || snapshot.evidenceType !== 'read-only-supabase-list-migrations-no-sql-or-user-data') {
    throw new Error('Production source snapshot identities are not reviewed.');
  }
  const local = existing.filter(name => name.endsWith('.sql'));
  const inventory = evaluateProductionMigrationInventory({ local, remote: snapshot.migrations, map });
  const scope = evaluateProductionRolloutScope(inventory, scopeManifest);
  const sourceHashes = await verifyMigrationSourceMap(map, directory);
  if (!inventory.historyIdentityMatched || inventory.matchedDirectCount !== 74
    || inventory.matchedHistoricalCount !== 45 || snapshot.migrations.length !== 119
    || local.length !== 149 || scope.pendingCount !== 30
    || !scope.scopeExact || sourceHashes.issues.length) {
    throw new Error('Historical sources, quarantined SQL, or manifest differ from reviewed snapshot.');
  }
  const aliases = new Map(map.renamed.map(row => [row.remoteVersion, row]));
  const reserved = new Set([...inventory.pendingHistorical, ...inventory.pendingCandidates]);
  const plan = [];
  const targets = new Set(), sources = new Set();
  for (const row of snapshot.migrations) {
    const alias = aliases.get(row.version);
    if (alias && alias.name !== row.name) throw new Error('Alias name mismatch.');
    const source = alias ? fileName(alias.localVersion, row.name) : fileName(row.version, row.name);
    const target = fileName(row.version, row.name);
    if (!existing.includes(source) || reserved.has(source) || targets.has(target) || sources.has(source)) {
      throw new Error('A migration source is missing, duplicated, or quarantined.');
    }
    targets.add(target); sources.add(source);
    plan.push({ source, target, alias: !!alias });
  }
  if (plan.length !== 119 || plan.filter(item => item.alias).length !== 45 || reserved.size !== 30) {
    throw new Error('Unexpected historical replay source count.');
  }
  // No user-supplied output path. Never write files under this repository or
  // under supabase/migrations. The caller must clean up this isolated temp dir.
  const temporary = await mkdtemp(join(tmpdir(), 'tayar-historical-sources-'));
  try {
    const target = join(temporary, 'migrations');
    await mkdir(target);
    const copied = [];
    for (const item of plan) {
      const bytes = await readFile(join(directory, 'supabase/migrations', item.source));
      await writeFile(join(target, item.target), bytes, { flag: 'wx', mode: 0o600 });
      copied.push({ ...item, sha256: sha256(bytes), size: bytes.byteLength });
    }
    const names = await readdir(target);
    if (names.length !== 119 || names.some(name => !targets.has(name))) {
      throw new Error('Isolated source tree differs from reviewed plan.');
    }
    const result = {
      status: 'REHEARSAL_SOURCES_ONLY',
      releaseAuthorized: false,
      migrationExecutionAuthorized: false,
      liveDatabaseRechecked: false,
      sourceRoot: temporary,
      migrationDirectory: target,
      sources: copied,
      quarantinedCount: reserved.size,
    };
    if (options.onPrepared) await options.onPrepared(result);
    return result;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

/** Safest API: no temporary tree remains after callback success or failure. */
export async function withHistoricalRehearsalSources(root, callback) {
  const result = await prepareHistoricalRehearsalSources(root);
  try { return await callback(result); }
  finally { await rm(result.sourceRoot, { recursive: true, force: true }); }
}
