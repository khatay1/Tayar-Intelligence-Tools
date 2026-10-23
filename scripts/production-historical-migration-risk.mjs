import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILENAME = /^\d{14}_[a-z][a-z0-9_]*\.sql$/;

// Static screening only. This is not SQL parsing or a live schema/migration rehearsal.
export function classifyHistoricalMigration(filename, sql) {
  if (!FILENAME.test(filename) || typeof sql !== 'string') throw Error('Invalid historical migration source.');
  const noComments = sql.replace(/--[^\r\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const flags = {
    replacesFunction: /\bcreate\s+or\s+replace\s+function\b/i.test(noComments),
    createsFunction: /\bcreate\s+(?:or\s+replace\s+)?function\b/i.test(noComments),
    createsTable: /\bcreate\s+table\b/i.test(noComments),
    deletesRows: /\bdelete\s+from\b/i.test(noComments),
    modifiesRows: /\b(?:insert\s+into|update\s+\w+)/i.test(noComments),
    changesPermissions: /\b(?:grant|revoke)\s+/i.test(noComments),
    altersSchema: /\b(?:alter\s+table|drop\s+(?:table|function|policy|trigger|constraint))\b/i.test(noComments),
    protectedSchedulerReplacement: /\bcreate\s+or\s+replace\s+function\s+public\.website_publish_scheduler_ready\s*\(/i.test(noComments),
  };
  const riskReasons = Object.entries(flags).filter(([, enabled]) => enabled).map(([name]) => name);
  return { filename, flags, riskReasons, releaseAuthorized: false, replayAuthorized: false };
}

export function inspectHistoricalMigrationSources({ manifest, sourceByName }) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.groups?.['historical-needs-provenance'])
    || !sourceByName || typeof sourceByName !== 'object' || Array.isArray(sourceByName)) {
    throw Error('Invalid reviewed historical migration manifest.');
  }
  const historical = manifest.groups['historical-needs-provenance'];
  if (new Set(historical).size !== historical.length) throw Error('Duplicate historical migration source.');
  const files = historical.map(filename => {
    if (!Object.hasOwn(sourceByName, filename)) throw Error('Historical migration not provided: ' + filename);
    return classifyHistoricalMigration(filename, sourceByName[filename]);
  });
  const scheduler = files.find(f => f.flags.protectedSchedulerReplacement);
  const rowDeleting = files.filter(f => f.flags.deletesRows);
  return {
    status: 'BLOCKED',
    releaseAuthorized: false,
    replayAuthorized: false,
    scannedCount: files.length,
    protectedSchedulerReplacement: scheduler?.filename ?? null,
    rowDeletingSources: rowDeleting.map(f => f.filename),
    files,
    limitation: 'Static source screening only; not a proof of database drift, SQL execution safety or live rollback.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) {
    console.error('Usage: node scripts/production-historical-migration-risk.mjs');
    process.exitCode = 2;
  } else {
    try {
      const root = process.cwd();
      const manifest = JSON.parse(await readFile(resolve(root,'supabase/production-rollout-scope-20261022.json'),'utf8'));
      const sourceByName = Object.fromEntries(await Promise.all(
        manifest.groups['historical-needs-provenance'].map(async filename => [filename,
          await readFile(resolve(root,'supabase/migrations',filename),'utf8')])));
      const result = inspectHistoricalMigrationSources({ manifest, sourceByName });
      console.log(JSON.stringify(result,null,2));
      // Historical SQL must never be replayed as an automated release step.
      process.exitCode = 1;
    } catch (error) {
      console.error('Historical migration preflight refused:',error.message);
      process.exitCode = 1;
    }
  }
}
