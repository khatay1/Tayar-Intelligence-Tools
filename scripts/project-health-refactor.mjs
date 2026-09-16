import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const sourcePath = path.join(root, 'scripts/project-health.mjs');
const tempPath = path.join(root, 'scripts/.project-health-refactor-runtime.mjs');

const contractFiles = [
  'src/modules/website-builder/core/editor-ai-editable-snapshot.ts',
  'src/modules/website-builder/core/editor-ai-native-bridge.ts',
  'src/modules/website-builder/core/editor-ai-working-project.ts',
  'src/modules/website-builder/core/editor-operation-policy.ts',
  'src/modules/website-builder/core/editor-value-safety.ts',
  'src/modules/website-builder/core/website-builder-rendering.ts',
  'src/modules/website-builder/components/ElementPreview.tsx',
  'src/modules/website-builder/components/SectionPreview.tsx',
  'src/modules/website-builder/v2-ui/BuilderCanvasFrame.tsx',
  'src/modules/website-builder/v2-ui/BuilderCanvasOverlay.tsx',
  'src/modules/website-builder/v2-ui/BuilderV2NativeBridge.tsx',
  'src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx',
];

const declaration = "const websiteBuilder = read('src/modules/website-builder/WebsiteBuilderTool.tsx');";
const replacement = `${declaration}\nconst websiteBuilderContractSources = [websiteBuilder, ${contractFiles
  .map((file) => `read(${JSON.stringify(file)})`)
  .join(', ')}].join('\\n');`;

let source = fs.readFileSync(sourcePath, 'utf8');
if (!source.includes(declaration)) {
  throw new Error('project-health Website Builder declaration changed; update refactor compatibility runner.');
}
source = source.replace(declaration, replacement);

// Only the feature-contract checks below this marker should follow code that was
// intentionally extracted from WebsiteBuilderTool.tsx. Earlier architecture checks
// must continue to inspect the monolith itself (for example persistence isolation).
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
