import { readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const smokePath = resolve(root, 'scripts/website-builder-smoke.mjs');
const tempPath = resolve(root, 'scripts/.website-builder-smoke-split.generated.mjs');
const sourcesPath = resolve(root, 'scripts/.website-builder-smoke-split.sources.generated.mjs');

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
const moduleSources = collectSourceFiles(moduleRoot).map((path) => readFileSync(path, 'utf8')).join('\n');
const v2Sources = collectSourceFiles(v2Root).map((path) => readFileSync(path, 'utf8')).join('\n');

let smoke = readFileSync(smokePath, 'utf8');
const builderDeclaration = "const builderSource = existsSync(builderPath) ? readFileSync(builderPath, 'utf8') : '';";
const bridgeDeclaration = "const websiteBuilderV2Bridge = existsSync(websiteBuilderV2BridgePath) ? readFileSync(websiteBuilderV2BridgePath, 'utf8') : '';";
const fsImport = "import { readFileSync, existsSync } from 'node:fs';";

if (!smoke.includes(builderDeclaration) || !smoke.includes(bridgeDeclaration) || !smoke.includes(fsImport)) {
  console.error('Website Builder smoke compatibility runner could not locate the expected source declarations.');
  process.exit(1);
}

writeFileSync(
  sourcesPath,
  `export const builderSource = ${JSON.stringify(moduleSources)};\nexport const websiteBuilderV2Bridge = ${JSON.stringify(v2Sources)};\n`,
  'utf8',
);

smoke = smoke
  .replace(
    fsImport,
    `${fsImport}\nimport { builderSource, websiteBuilderV2Bridge } from './.website-builder-smoke-split.sources.generated.mjs';`,
  )
  .replace(builderDeclaration, '')
  .replace(bridgeDeclaration, '');

try {
  writeFileSync(tempPath, smoke, 'utf8');
  const result = spawnSync(process.execPath, [tempPath], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(tempPath, { force: true });
  rmSync(sourcesPath, { force: true });
}
