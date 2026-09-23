import { readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const smokePath = resolve(root, 'scripts/website-builder-smoke.mjs');
const tempPath = resolve(root, 'scripts/.website-builder-smoke-split.generated.mjs');

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...collectSourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

const moduleRoot = resolve(root, 'src/modules/website-builder');
const v2Root = resolve(moduleRoot, 'v2-ui');
const moduleSources = collectSourceFiles(moduleRoot)
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const v2Sources = collectSourceFiles(v2Root)
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');

let smoke = readFileSync(smokePath, 'utf8');
const builderDeclaration = "const builderSource = existsSync(builderPath) ? readFileSync(builderPath, 'utf8') : '';";
const bridgeDeclaration = "const websiteBuilderV2Bridge = existsSync(websiteBuilderV2BridgePath) ? readFileSync(websiteBuilderV2BridgePath, 'utf8') : '';";

if (!smoke.includes(builderDeclaration) || !smoke.includes(bridgeDeclaration)) {
  console.error('Website Builder smoke compatibility runner could not locate the expected source declarations.');
  process.exit(1);
}

// The smoke suite predates the monolith split. Keep every assertion intact, but
// evaluate source-presence contracts against the complete Website Builder module
// and V2 UI module so moved code is still verified after extraction.
smoke = smoke
  .replace(builderDeclaration, `const builderSource = ${JSON.stringify(moduleSources)};`)
  .replace(bridgeDeclaration, `const websiteBuilderV2Bridge = ${JSON.stringify(v2Sources)};`);

try {
  writeFileSync(tempPath, smoke, 'utf8');
  const result = spawnSync(process.execPath, [tempPath], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(tempPath, { force: true });
}
