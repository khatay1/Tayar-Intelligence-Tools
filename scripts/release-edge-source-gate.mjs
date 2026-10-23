import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[a-f\d]{40}$/i;
const EXPECTED_REPO = 'khatay1/Tayar-Intelligence-Tools';
const IMPORT = /^\s*import\s+["']https:\/\/raw\.githubusercontent\.com\/khatay1\/Tayar-Intelligence-Tools\/([a-f\d]{40})\/supabase\/functions\/website-byo-publish\/index\.ts["']\s*;?\s*$/gm;

/**
 * Diagnostic-only comparison of supplied, source-only evidence. This is not
 * a deployed binary attestation and NEVER approves a Production release.
 */
export function evaluateEdgeSourceBoundary(input) {
  if (!input || typeof input !== 'object' || input.repository !== EXPECTED_REPO
    || !SHA.test(input.mainSha ?? '')
    || !['deployedEdgeSource', 'pinnedEndpointSource', 'pinnedRunnerSource',
      'mainEndpointSource', 'mainRunnerSource'].every(k => typeof input[k] === 'string'
        && input[k].length > 15 && input[k].length < 1_000_000)) {
    throw new Error('Complete reviewed Edge source attestation is required.');
  }
  const imports = [...input.deployedEdgeSource.matchAll(IMPORT)].map(m => m[1].toLowerCase());
  const pinnedSha = imports.length === 1 ? imports[0] : null;
  const oldEndpointCallsProduction = /\bcontext\.runProduction\s*\(/.test(input.pinnedEndpointSource);
  const oldRunnerCallsPublisher = /\brunWebsiteOwnedByoProductionPublish\s*\(/.test(input.pinnedRunnerSource);
  const mainEndpointRefusesProduction = /if\s*\(\s*action\s*===\s*['"]production['"]\s*\)\s*\{\s*const\s+error\s*=\s*new\s+ProductionCandidateRequiredError\s*\(\s*\)\s*;\s*return\s+json\s*\(\s*409/.test(input.mainEndpointSource);
  const mainRunnerRefusesProduction = /async\s+runProduction\s*\([^)]*\)\s*\{\s*throw\s+new\s+ProductionCandidateRequiredError\s*\(\s*\)/.test(input.mainRunnerSource);
  return {
    status: 'BLOCKED', releaseAuthorized: false, productionPublishAuthorized: false,
    evidence: 'operator-supplied-source-only', repository: EXPECTED_REPO,
    mainSha: input.mainSha.toLowerCase(), deployedPinnedSha: pinnedSha,
    deployedPinnedToCurrentMain: pinnedSha !== null && pinnedSha === input.mainSha.toLowerCase(),
    oldEndpointCallsProduction, oldRunnerCallsPublisher,
    mainEndpointRefusesProduction, mainRunnerRefusesProduction,
    olderPublishRouteExists: oldEndpointCallsProduction && oldRunnerCallsPublisher,
    confirmedOutdatedPublishBoundary: pinnedSha !== null && pinnedSha !== input.mainSha.toLowerCase()
      && oldEndpointCallsProduction && oldRunnerCallsPublisher
      && mainEndpointRefusesProduction && mainRunnerRefusesProduction,
    nextStep: 'Verify the actual active Edge source and perform approved isolated refuse-path tests. Never invoke a live Production publisher from this report.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/release-edge-source-gate.mjs <source-evidence.json>');
    process.exitCode = 2;
  } else {
    try {
      const input = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
      console.log(JSON.stringify(evaluateEdgeSourceBoundary(input), null, 2));
      process.exitCode = 1; // A read-only diagnostic NEVER authorizes release.
    } catch (error) {
      console.error('Production Edge preflight blocked:', error.message);
      process.exitCode = 1;
    }
  }
}
