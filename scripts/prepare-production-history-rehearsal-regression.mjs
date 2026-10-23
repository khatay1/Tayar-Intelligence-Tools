import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, readdir, symlink, copyFile, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { withHistoricalRehearsalSources, prepareHistoricalRehearsalSources } from './prepare-production-history-rehearsal.mjs';

const root = process.cwd();
let preparedRoot;
const report = await withHistoricalRehearsalSources(root, async result => {
  preparedRoot = result.sourceRoot;
  assert.equal(result.status, 'REHEARSAL_SOURCES_ONLY');
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.migrationExecutionAuthorized, false);
  assert.equal(result.liveDatabaseRechecked, false);
  assert.equal(result.sources.length, 119);
  assert.equal(result.sources.filter(x => x.alias).length, 45);
  assert.equal(result.quarantinedCount, 30);
  const names = await readdir(result.migrationDirectory);
  assert.equal(names.length, 119);
  const unique = new Set(names);
  assert.equal(unique.size, 119);
  for (const entry of result.sources) {
    assert.ok(unique.has(entry.target));
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.size > 0);
    const sourceBytes = await readFile(join(root, 'supabase/migrations', entry.source));
    const rewrittenBytes = await readFile(join(result.migrationDirectory, entry.target));
    assert.deepEqual(rewrittenBytes, sourceBytes, 'Migration SQL bytes must never change.');
  }
  const renamed = result.sources.find(item => item.source === '20260925094500_disable_unsafe_website_publish_scheduler.sql');
  assert.equal(renamed?.target, '20260925072841_disable_unsafe_website_publish_scheduler.sql');
  assert.ok(unique.has('20260805165801_create_user_onboarding_table.sql.sql'));
  for (const name of ['20260925092000_website_publish_scheduler_readiness.sql',
    '20261016100000_website_production_source_candidates.sql',
    '20261018113420_social_hub_storage.sql',
    '20261020133000_website_stripe_webhook_secret_handoff.sql']) assert.ok(!unique.has(name));
  return { direct: result.sources.filter(x => !x.alias).length, aliases: result.sources.filter(x => x.alias).length };
});
assert.deepEqual(report, { direct: 74, aliases: 45 });
await assert.rejects(stat(preparedRoot), { code: 'ENOENT' }, 'No test migration tree should remain after success.');

const fake = await mkdtemp(join(tmpdir(), 'tayar-history-tamper-'));
try {
  await mkdir(join(fake, 'supabase'));
  await symlink(resolve(root, 'supabase/migrations'), join(fake, 'supabase/migrations'), 'dir');
  for (const name of ['migration-source-map.json', 'production-migration-identity-snapshot-20261023.json',
    'production-rollout-scope-20261022.json']) await copyFile(join(root, 'supabase', name), join(fake, 'supabase', name));
  const snapshot = join(fake, 'supabase/production-migration-identity-snapshot-20261023.json');
  const original = JSON.parse(await readFile(snapshot, 'utf8'));
  const corrupt = structuredClone(original);
  corrupt.migrations[0].version = '20261023999999';
  await writeFile(snapshot, JSON.stringify(corrupt));
  await assert.rejects(prepareHistoricalRehearsalSources(fake), /reviewed snapshot/);
  await writeFile(snapshot, JSON.stringify(original));
  const manifestPath = join(fake, 'supabase/production-rollout-scope-20261022.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.groups['social-hub-deferred'].push('20261023190000_unknown.sql');
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(prepareHistoricalRehearsalSources(fake), /reviewed snapshot/);
  const pristineManifest = JSON.parse(await readFile(join(root, 'supabase/production-rollout-scope-20261022.json'), 'utf8'));
  await writeFile(manifestPath, JSON.stringify(pristineManifest));
  const aliasPath = join(fake, 'supabase/migration-source-map.json');
  const alias = JSON.parse(await readFile(aliasPath, 'utf8'));
  alias.renamed[0].sqlSha256 = '0'.repeat(64);
  await writeFile(aliasPath, JSON.stringify(alias));
  await assert.rejects(prepareHistoricalRehearsalSources(fake), /reviewed snapshot/);
} finally { await rm(fake, { recursive: true, force: true }); }
console.log('PASS historical rehearsal staging: 119 byte-identical reviewed SQL sources, 45 aliases, 30 withheld, no DB use, cleanup and tamper refusal.');
