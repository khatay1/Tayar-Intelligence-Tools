import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrationSqlDigest, verifyMigrationSourceMap } from './verify-migration-source-map.mjs';

const root = await mkdtemp(join(tmpdir(), 'tayar-migration-map-'));
try {
  await mkdir(join(root, 'supabase/migrations'), { recursive: true });
  const sql = 'select 1;\n-- preserve internal whitespace and comments\n';
  const path = 'supabase/migrations/20261001000000_example.sql';
  await writeFile(join(root, path), sql);
  const map = { version: 1, observedAt: '2026-10-16', projectRef: 'a'.repeat(20), baselineCommit: 'a'.repeat(40),
    normalization: 'Remove trailing CR/LF only; preserve every other SQL byte. Remote statements joined by LF.',
    renamed: [{ name: 'example', localVersion: '20261001000000', remoteVersion: '20261002000000', path, sqlSha256: migrationSqlDigest(sql) }],
    localWithoutRemoteName: [],
  };
  const valid = await verifyMigrationSourceMap(map, root);
  assert.deepEqual(valid.issues, []); assert.equal(valid.historicalSourcesVerified, 1);
  assert.equal(valid.historyAligned, false); assert.equal(valid.liveDatabaseRechecked, false);
  assert.notEqual(migrationSqlDigest(Buffer.from([255])), migrationSqlDigest(Buffer.from([254])), 'Digest preserves even non-UTF8 byte differences');
  await writeFile(join(root, path), sql + '\r\n');
  assert.deepEqual((await verifyMigrationSourceMap(map, root)).issues, [], 'Only trailing CR/LF normalization is accepted');
  await writeFile(join(root, path), sql.replace('select 1', 'select 2'));
  assert.match((await verifyMigrationSourceMap(map, root)).issues.join(' '), /source changed/);
  await writeFile(join(root, path), sql.replace('internal whitespace', 'internal  whitespace'));
  assert.match((await verifyMigrationSourceMap(map, root)).issues.join(' '), /source changed/, 'No SQL/comment canonicalization can hide changed bytes');
  await writeFile(join(root, path), sql);
  for (const mutate of [
    map => { map.renamed[0].path = '../outside.sql'; },
    map => { map.renamed[0].sqlSha256 = '0'.repeat(64); },
    map => { map.renamed[0].localVersion = 'invalid'; },
    map => { map.renamed[0].name = 'missing'; map.renamed[0].path = 'supabase/migrations/20261001000000_missing.sql'; },
    map => { map.renamed.push({ ...map.renamed[0] }); },
    map => { map.localWithoutRemoteName.push({ name: 'example', version: '20261001000000', path, sqlSha256: migrationSqlDigest(sql) }); },
    map => { map.unknown = true; },
  ]) {
    const broken = structuredClone(map); mutate(broken);
    assert.ok((await verifyMigrationSourceMap(broken, root)).issues.length, 'Invalid, ambiguous, changed or missing mappings fail closed');
  }
  await writeFile(join(root, 'supabase/migrations/20261002000000_unmapped.sql'), 'select 2;');
  assert.match((await verifyMigrationSourceMap(map, root)).issues.join(' '), /collides/, 'Aliases cannot collide with an unmapped existing migration');
  console.log('PASS offline migration source map: exact SHA-256, newline-only normalization, tamper/missing/ambiguous/path refusal and no live readiness claim');
} finally { await rm(root, { recursive: true, force: true }); }
