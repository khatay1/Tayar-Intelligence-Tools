import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const smokePath = resolve(root, 'scripts/website-builder-smoke.mjs');
const generatedSmokePath = resolve(tmpdir(), `tayar-website-builder-smoke-${process.pid}.mjs`);

// Keep the canonical smoke assertions unchanged while teaching the split runner how
// to compose implementation files that were intentionally separated after those
// assertions were written. This preserves exact-count and negative assertions.
let smokeSource = readFileSync(smokePath, 'utf8');
smokeSource = smokeSource.replace(
  "const websiteBuilderV2BridgePath = resolve(root, 'src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx');",
  "const websiteBuilderV2BridgePath = resolve(root, 'src/modules/website-builder/v2-ui/WebsiteBuilderV2Bridge.tsx');\nconst websiteBuilderV2BridgeBasePath = resolve(root, 'src/modules/website-builder/v2-ui/WebsiteBuilderV2BridgeBase.tsx');",
);
smokeSource = smokeSource.replace(
  "const websiteBuilderV2Bridge = existsSync(websiteBuilderV2BridgePath) ? readFileSync(websiteBuilderV2BridgePath, 'utf8') : '';",
  "const websiteBuilderV2Bridge = [websiteBuilderV2BridgePath, websiteBuilderV2BridgeBasePath].filter(existsSync).map((file) => readFileSync(file, 'utf8')).join('\\n');",
);

writeFileSync(generatedSmokePath, smokeSource, 'utf8');
try {
  const result = spawnSync(process.execPath, [generatedSmokePath], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  try { unlinkSync(generatedSmokePath); } catch { /* best-effort cleanup */ }
}
