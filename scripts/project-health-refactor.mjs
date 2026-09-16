import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const sourcePath = path.join(root, 'scripts/project-health.mjs');
const tempPath = path.join(root, 'scripts/.project-health-refactor-runtime.mjs');

// Feature contracts used to live almost entirely in WebsiteBuilderTool.tsx.
// After the safe split, follow the extracted Website Builder implementation as a
// whole so health checks validate behavior contracts instead of file location.
const websiteBuilderRoot = path.join(root, 'src/modules/website-builder');
const contractFiles = [];
const collectContractFiles = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectContractFiles(full);
    } else if (/\.(?:ts|tsx)$/i.test(entry.name) && entry.name !== 'WebsiteBuilderTool.tsx') {
      contractFiles.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
};
collectContractFiles(websiteBuilderRoot);
contractFiles.sort();

const declaration = "const websiteBuilder = read('src/modules/website-builder/WebsiteBuilderTool.tsx');";
const replacement = `${declaration}\nconst websiteBuilderContractSources = [websiteBuilder, ${contractFiles
  .map((file) => `read(${JSON.stringify(file)})`)
  .join(', ')}].join('\\n');`;

let source = fs.readFileSync(sourcePath, 'utf8');
if (!source.includes(declaration)) {
  throw new Error('project-health Website Builder declaration changed; update refactor compatibility runner.');
}
source = source.replace(declaration, replacement);

// Only feature-contract checks below this marker follow intentionally extracted
// implementation. Earlier architecture checks continue to inspect the monolith.
const marker = "check('Website Builder AI supports multi-page generation with legacy fallback'";
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error('Website Builder health marker not found.');
const before = source.slice(0, markerIndex);
const after = source.slice(markerIndex).replaceAll('websiteBuilder.includes(', 'websiteBuilderContractSources.includes(');
source = before + after;

fs.writeFileSync(tempPath, source, 'utf8');
try {
  await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
