import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-app-nav-'));
try {
  const outfile = join(dir, 'navigation.cjs');
  await build({ entryPoints: ['src/modules/website-builder/core/application-navigation.ts'], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { applicationNavigationTarget: target, createApplicationNavigator: create } = (await import(pathToFileURL(outfile))).default;
  const current = 'https://app.example/site/owner/project/index.html';
  const paths = ['/site/owner/project/index.html', '/site/owner/project/dashboard.html', '/site/owner/project/%D8%AD%D8%B3%D8%A7%D8%A8.html'];
  assert.equal(target('dashboard.html?filter=active#row', current, paths), 'https://app.example/site/owner/project/dashboard.html?filter=active#row');
  assert.equal(target('حساب.html', current, paths), 'https://app.example' + paths[2]);
  for (const href of ['#section', 'https://evil.example/site/owner/project/dashboard.html', '//evil.example/', 'javascript:alert(1)', 'data:text/html,test', '../other/index.html', '/api/private', 'file.pdf', 'https://user:pass@app.example/site/owner/project/dashboard.html']) {
    assert.equal(target(href, current, paths), null, href);
  }
  let release, rejectSync = false, syncs = 0;
  const visited = [];
  let pending = new Promise(resolve => { release = resolve; });
  const nav = create({ currentUrl: () => current, paths, synchronize: async () => { syncs++; await pending; if (rejectSync) throw new Error('unavailable'); }, navigate: url => visited.push(url) });
  const first = nav.go('dashboard.html');
  assert.deepEqual(visited, []);
  assert.equal(await nav.go('dashboard.html'), false, 'Duplicate navigation does not race cookie synchronization');
  release(); assert.equal(await first, true); assert.equal(visited.length, 1);
  rejectSync = true;
  await assert.rejects(nav.go('dashboard.html'));
  assert.equal(visited.length, 1, 'Failed synchronization cannot navigate');
  assert.equal(await nav.go('https://other.example'), false);
  assert.equal(syncs, 2);
  rejectSync = false; pending = new Promise(resolve => { release = resolve; });
  const last = nav.go('dashboard.html'); nav.dispose(); release();
  assert.equal(await last, false);
  assert.equal(visited.length, 1, 'Disposed pages cannot navigate after awaiting an old response');
  assert.equal(nav.target('dashboard.html'), null);
  console.log('PASS application navigation: exact manifest routes, Unicode, native external/anchor links, synchronization ordering, failures, duplicate clicks and disposal');
} finally { await rm(dir, { recursive: true, force: true }); }
