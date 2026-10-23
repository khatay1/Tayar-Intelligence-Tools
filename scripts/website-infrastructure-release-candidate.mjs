import { readFile } from 'node:fs/promises';
import { inspectWebsiteInfrastructureReleaseCandidate } from './lib/website-infrastructure-release-candidate.mjs';

const [path, candidateRef, productionRef] = process.argv.slice(2);
if (!path || !candidateRef || !productionRef) {
  console.error('Usage: node scripts/website-infrastructure-release-candidate.mjs <sanitized-evidence.json> <candidate-project-ref> <production-project-ref>');
  process.exitCode = 1;
} else {
  const report = inspectWebsiteInfrastructureReleaseCandidate(JSON.parse(await readFile(path, 'utf8')), candidateRef, productionRef);
  console.log(JSON.stringify(report, null, 2));
  if (!report.releaseCandidateReady) process.exitCode = 1;
}

