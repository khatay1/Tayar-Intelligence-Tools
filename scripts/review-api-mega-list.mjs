// Offline review only. The source is read as data and never fetched or executed.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/review-api-mega-list.mjs <local-readme.md> <review-summary.json>');
const dir = await mkdtemp(join(tmpdir(), 'tayar-directory-review-'));
try {
  const outfile = join(dir, 'review.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/api-directory-review.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { reviewAPIMegaList } = createRequire(import.meta.url)(outfile);
  const source = await readFile(input, 'utf8');
  const { candidates, stats, approval, licensing } = reviewAPIMegaList(source);
  const summary = { source: 'https://github.com/cporter202/API-mega-list', readmeSHA256: createHash('sha256').update(source).digest('hex'),
    reviewedAt: new Date().toISOString(), stats, approval, licensing,
    categories: [...new Set(candidates.flatMap(item => item.categories))].sort(),
    runtimeImports: 0,
    policy: 'Candidates remain quarantined. No service endorsement, code license, account pricing, permission grant or live integration is inferred. Sponsored entries are excluded; tracking is removed before deduplication. Provider terms and official endpoints require individual review.',
  };
  await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Reviewed ${stats.unique} unique quarantined candidates; imported no runtime providers.`);
} finally { await rm(dir, { recursive: true, force: true }); }
