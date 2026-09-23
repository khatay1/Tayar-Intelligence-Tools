import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const smokePath = resolve(root, 'scripts/website-builder-smoke.mjs');

// The smoke suite now explicitly composes the extracted Website Builder handlers,
// panels, core modules, and V2 bridge sources it needs. Running it directly keeps
// exact-count and negative assertions scoped to their intended files instead of
// duplicating every module through a generated all-source bundle.
const result = spawnSync(process.execPath, [smokePath], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
