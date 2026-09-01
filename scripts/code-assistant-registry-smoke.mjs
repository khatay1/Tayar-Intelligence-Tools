import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => {
  console.error(`[code-assistant-smoke] FAIL: ${message}`);
  process.exitCode = 1;
};

const moduleIndex = read('src/modules/index.ts');
const futureIndex = read('src/modules/future-tools/index.ts');
const sourceCatalog = read('src/modules/code-assistant/source-catalog.ts');
const seed = read('src/modules/code-assistant/seed-components.ts');
const vercel = JSON.parse(read('vercel.json'));

if (!moduleIndex.includes("import './code-assistant';")) fail('Code Assistant module is not registered.');
if (futureIndex.includes("id: 'code-assistant'")) fail('Old Coming Soon Code Assistant placeholder still exists.');
if (!sourceCatalog.includes("id: 'react-bits'") || !sourceCatalog.includes('redistributionAllowed: false')) fail('Restricted source guard is missing.');
if (seed.includes("sourceId: 'react-bits'")) fail('Restricted React Bits content was bundled.');
if (vercel?.git?.deploymentEnabled?.['internal-*'] !== false) fail('Internal branch Vercel deployment guard is missing.');

if (!process.exitCode) {
  console.log('[code-assistant-smoke] PASS');
}
