import assert from 'node:assert/strict';
import { classifyHistoricalMigration, inspectHistoricalMigrationSources } from './production-historical-migration-risk.mjs';

const schedulerFile = '20260925092000_website_publish_scheduler_readiness.sql';
const redirectsFile = '20261003224500_website_publish_redirects_validation_fix.sql';
const sourceByName = {
  [schedulerFile]: '-- Disabled by default elsewhere\nCREATE OR REPLACE FUNCTION public.website_publish_scheduler_ready() RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN return exists(select 1 from cron.job); END $$;',
  [redirectsFile]: '-- Rewrites constraints\nALTER TABLE public.website_publish_redirects DROP CONSTRAINT old; DELETE FROM public.website_publish_redirects WHERE invalid;',
};
const manifest = { version: 1, groups: { 'historical-needs-provenance': Object.keys(sourceByName) } };
const report = inspectHistoricalMigrationSources({ manifest, sourceByName });
assert.equal(report.status, 'BLOCKED');
assert.equal(report.releaseAuthorized, false);
assert.equal(report.replayAuthorized, false);
assert.equal(report.scannedCount, 2);
assert.equal(report.protectedSchedulerReplacement, schedulerFile);
assert.deepEqual(report.rowDeletingSources, [redirectsFile]);
assert.equal(report.files[0].flags.replacesFunction, true);
assert.equal(report.files[1].flags.altersSchema, true);
assert.equal(report.files[1].flags.deletesRows, true);
assert.equal(classifyHistoricalMigration('20261001000000_safe.sql', '-- DELETE FROM dangerous;\nselect 1;').flags.deletesRows, false);
assert.throws(() => inspectHistoricalMigrationSources({
  manifest, sourceByName: { [schedulerFile]: sourceByName[schedulerFile] },
}), /not provided/);
assert.throws(() => inspectHistoricalMigrationSources({
  manifest: { version: 1, groups: { 'historical-needs-provenance': [schedulerFile, schedulerFile] } },
  sourceByName,
}), /Duplicate/);
assert.throws(() => classifyHistoricalMigration('../danger.sql', 'select 1;'), /Invalid/);
console.log('PASS historical migration risk: protected scheduler overwrite, deleting SQL, comment filtering, missing/duplicate refusal, never auto-replay');
