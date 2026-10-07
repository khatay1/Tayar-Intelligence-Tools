import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-provider-handoff-route-'));
try {
  const outfile = join(dir, 'route.mjs');
  await build({ entryPoints: ['src/lib/website-provider-handoff-route.ts'], bundle: true,
    platform: 'node', format: 'esm', outfile });
  const { isWebsiteProviderHandoffHash: matches } = await import(pathToFileURL(outfile));
  const id = '33333333-3333-4333-8333-333333333333';
  for (const provider of ['github', 'supabase', 'vercel']) {
    assert.equal(matches(`#tayar_${provider}_handoff=${id}`), true);
  }
  for (const invalid of ['', '#workspace/website-builder', '#tayar_github_handoff=not-a-uuid',
    `#tayar_github_handoff=${id}&extra=1`, `#tayar_stripe_handoff=${id}`]) {
    assert.equal(matches(invalid), false);
  }
  const app = await readFile('src/App.tsx', 'utf8');
  assert.match(app, /useState\(\(\) => window[.]location[.]hash[.]replace/);
  assert.match(app, /isWebsiteProviderHandoffHash\(window[.]location[.]hash\)/);
  const workspace = await readFile('src/components/workspace/Workspace.tsx', 'utf8');
  assert.match(workspace, /if \(isWebsiteProviderHandoffHash\(hash\)\) return 'website-builder'/);
  console.log('PASS Provider handoff routing: exact callbacks survive app routing and reopen Website Builder');
} finally {
  await rm(dir, { recursive: true, force: true });
}
