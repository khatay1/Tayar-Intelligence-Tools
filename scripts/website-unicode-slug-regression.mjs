import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const temp = await mkdtemp(join(tmpdir(), 'tayar-unicode-slug-'));
try {
  const outfile = join(temp, 'identifiers.mjs');
  await build({ entryPoints: ['src/modules/website-builder/core/project-identifiers.ts'], bundle: true, platform: 'node', format: 'esm', outfile });
  const { normalizeSlug } = await import(`${pathToFileURL(outfile).href}?run=${Date.now()}`);
  assert.equal(normalizeSlug('About Us'), 'about-us');
  assert.equal(normalizeSlug('عنوان عربي'), 'عنوان-عربي');
  assert.equal(normalizeSlug('Våra tjänster'), 'våra-tjänster');
  assert.equal(normalizeSlug('  عربية / Svenska  '), 'عربية-svenska');
  assert.equal(normalizeSlug('***'), 'page');
  console.log('Unicode localized slug regression passed.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
