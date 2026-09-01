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
const assistant = read('src/modules/code-assistant/CodeAssistantTool.tsx');
const upstream = read('src/modules/code-assistant/upstream-registry.ts');
const vercel = JSON.parse(read('vercel.json'));

if (!moduleIndex.includes("import './code-assistant';")) fail('Code Assistant module is not registered.');
if (futureIndex.includes("id: 'code-assistant'")) fail('Old Coming Soon Code Assistant placeholder still exists.');
if (!sourceCatalog.includes("id: 'react-bits'") || !sourceCatalog.includes('redistributionAllowed: false')) fail('Restricted source guard is missing.');
if (seed.includes("sourceId: 'react-bits'")) fail('Restricted React Bits content was bundled.');
if (!assistant.includes("matches.find((item) => item.id === selectedId) || matches[0]")) fail('Filtered selection must stay inside visible registry results.');
if (!upstream.includes("sourceId: 'shadcn'") || !upstream.includes("sourceId: 'kokonut-ui'") || !upstream.includes("sourceId: 'magic-ui'") || !upstream.includes("sourceId: 'cult-ui'") || !upstream.includes("sourceId: '8bitcn'") || !upstream.includes("sourceId: 'eldora-ui'")) fail('Approved upstream registries are not configured.');
if (upstream.includes("sourceId: 'react-bits'")) fail('Restricted React Bits source must never be configured for upstream loading.');
const manifestUrls = upstream
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith("manifestUrl: '"))
  .map((line) => line.split("'")[1])
  .filter(Boolean);
if (manifestUrls.length < 6) fail('Expected approved registry manifests are missing.');
if (manifestUrls.some((url) => !url.startsWith('https://raw.githubusercontent.com/'))) fail('Registry manifests must use raw GitHub URLs.');
if (vercel?.git?.deploymentEnabled?.['internal-*'] !== false) fail('Internal branch Vercel deployment guard is missing.');

if (!process.exitCode) {
  console.log('[code-assistant-smoke] PASS');
}
