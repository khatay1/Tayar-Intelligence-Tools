import { readFile } from 'node:fs/promises';
import { inspectWebsiteInfrastructureDeploymentInventory } from './lib/website-infrastructure-deployment-inventory.mjs';

const [path, projectRef] = process.argv.slice(2);
if (!path || !projectRef) {
  console.error('Usage: node scripts/website-infrastructure-deployment-inventory.mjs <names-only-inventory.json> <expected-project-ref>');
  process.exitCode = 1;
} else {
  const report = inspectWebsiteInfrastructureDeploymentInventory(JSON.parse(await readFile(path, 'utf8')), projectRef);
  console.log(JSON.stringify(report, null, 2));
  if (!report.inventoryReady) process.exitCode = 1;
}
