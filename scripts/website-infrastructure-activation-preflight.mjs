import { inspectWebsiteInfrastructureActivation } from './lib/website-infrastructure-activation-preflight.mjs';

const report = await inspectWebsiteInfrastructureActivation();
console.log(JSON.stringify(report, null, 2));
if (!report.ready) process.exitCode = 1;
