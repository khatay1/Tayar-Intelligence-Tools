import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:https';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

const findChrome = () => {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync('which', [name], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Chrome is required for the generated application page browser regression. Set CHROME_BIN.');
};
const dir = await mkdtemp(join(tmpdir(), 'tayar-reference-page-browser-'));
let server;
try {
  let html = '', mockFetch = '', harness = '', complete;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const keyPath = join(dir, 'localhost.key'), certPath = join(dir, 'localhost.crt');
  const certificate = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=*.apps.tayar.se', '-addext', 'subjectAltName=DNS:*.apps.tayar.se'], { stdio: 'ignore' });
  if (certificate.status !== 0) throw new Error('OpenSSL is required to create the isolated application browser certificate.');
  const completion = new Promise(resolveResult => { complete = resolveResult; });
  server = createServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, (req, res) => {
    if (req.url === '/result' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => { res.end(); complete(body); });
      return;
    }
    if (req.url === '/mock.js' || req.url === '/harness.js') {
      res.setHeader('content-type', 'text/javascript; charset=utf-8');
      res.end(req.url === '/mock.js' ? mockFetch : harness); return;
    }
    if (req.url?.startsWith('/api/application-session')) {
      res.setHeader('content-type', 'application/json'); res.end('{"status":"signed-out"}'); return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(443, '127.0.0.1', () => { server.off('error', rejectListen); resolveListen(); });
  });
  const url = 'https://' + projectId + '.apps.tayar.se';
  const chrome = findChrome();
  const entry = join(dir, 'page-runtime.ts'), outfile = join(dir, 'page-runtime.cjs');
  await writeFile(entry, [
    'export { renderWebsiteApplicationSnapshot } from ' + JSON.stringify(resolve('src/modules/website-builder/services/websiteApplicationRenderService')) + ';',
    'export { preparePublishedApplicationDataViews } from ' + JSON.stringify(resolve('src/modules/website-builder/core/application-published-data-views')) + ';',
    'export { addApplicationPageBootstrap } from ' + JSON.stringify(resolve('src/modules/website-builder/services/websiteApplicationPageBootstrapService')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile, alias: { '@': resolve('src') } });
  const { renderWebsiteApplicationSnapshot, preparePublishedApplicationDataViews, addApplicationPageBootstrap } =
    (await import(pathToFileURL(outfile))).default;
  const definition = {
    version: 1, roles: [], pageAccess: [],
    auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    tables: [{
      id: 'records', key: 'records', name: 'Records',
      fields: [{ id: 'record-name', key: 'name', name: 'Name', type: 'text', required: true }],
      permissions: [{ operation: 'read', access: 'public' }],
    }],
  };
  const page = {
    id: 'home', name: 'Home', slug: 'home',
    sections: [{
      id: 'records-section', type: 'features', title: 'Records',
      applicationDataView: { tableId: 'records', columns: ['record-name'], actions: [], pageSize: 10 },
    }],
  };
  const files = await renderWebsiteApplicationSnapshot({
    application: definition, homePageId: 'home', pages: [page], siteName: 'Reference runtime',
    siteUrl: 'https://reference.invalid',
  });
  assert.equal(files.length, 1);
  const views = preparePublishedApplicationDataViews(definition, 'home', page.sections);
  const backend = {
    url: 'https://sgewokeojtzsqjaeluan.supabase.co',
    projectRef: 'sgewokeojtzsqjaeluan',
    publishableKey: 'sb_publishable_fixture',
  };
  const response = await addApplicationPageBootstrap(new Response(files[0].content, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  }), {
    language: 'en', returnPath: '/index.html', applicationOrigin: url,
    platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co',
    projectId,
    ownerId: '11111111-1111-4111-8111-111111111111',
    platformOrigin: 'https://tayar.se', signUpEnabled: false,
    definition, paths: ['/index.html'], pageId: 'home', applicationForms: [],
    applicationDataViews: views, backend,
  });
  html = await response.text();
  assert.match(html, /data-tayar-application-runtime/);
  mockFetch = '(function(){var original=window.fetch.bind(window);window.__requests=[];window.__mockLoaded=true;window.fetch=async function(input,init){var url=new URL(input instanceof Request?input.url:String(input),location.href);window.__requests.push(url.href);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_records")return Response.json([{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",name:"Generated page row"}]);if(url.pathname==="/api/application-session")return Response.json({status:"signed-out"});return original(input,init)}})();';
  harness = '(async function(){var result="FAIL generated page browser timeout";try{var host=document.querySelector("[data-tayar-data-view-id=records-section]");var root=host&&host.shadowRoot;var deadline=Date.now()+10000;while(Date.now()<deadline){var view=root&&root.querySelector(".view");if(view&&view.getAttribute("aria-busy")==="false")break;await new Promise(function(resolve){setTimeout(resolve,20)})}var view=root&&root.querySelector(".view");if(!view||view.getAttribute("aria-busy")!=="false")throw Error("Generated application data view did not become ready; host="+!!host+" root="+!!root+" view="+!!view+" busy="+(view&&view.getAttribute("aria-busy"))+" mock="+!!window.__mockLoaded+" requests="+JSON.stringify(window.__requests)+" status="+(root&&root.querySelector("[role=status]")?.textContent)+" account="+(document.querySelector("aside")?.shadowRoot?.textContent||"missing")+" page="+document.body.innerHTML.slice(0,500));var row=root.querySelector("tbody tr");if(!row||row.textContent!=="Generated page row")throw Error("Rendered application page did not show the backend record");if(!document.querySelector("aside")?.shadowRoot?.querySelector("nav"))throw Error("Application account navigation did not mount");result="PASS generated HTML page boots the real private application runtime and renders its data view"}catch(error){result="FAIL "+(error&&error.stack||String(error))}try{await fetch("/result",{method:"POST",body:result})}catch(error){document.body.dataset.failure=String(error)}})();';
  html = html.replace('</head>', '<script src="/mock.js"></script></head>');
  html = html.replace('</body>', '<script src="/harness.js"></script></body>');
  const detached = process.platform !== 'win32';
  const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--ignore-certificate-errors', '--host-resolver-rules=MAP *.apps.tayar.se 127.0.0.1,EXCLUDE localhost', '--user-data-dir=' + dir, url + '/index.html'], { detached, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', timer;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  let marker;
  try {
    marker = await Promise.race([completion, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Generated application page browser timed out: ' + stderr)), 30_000);
      child.once('error', reject);
      child.once('exit', code => reject(new Error('Browser exited before completing checks (' + code + '): ' + stderr)));
    })]);
  } finally {
    clearTimeout(timer);
    if (child.pid) {
      const exited = child.exitCode === null && child.signalCode === null
        ? new Promise(resolveExit => child.once('exit', resolveExit)) : Promise.resolve();
      if (detached) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      } else spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      await exited;
    }
  }
  if (!marker?.startsWith('PASS')) throw new Error(marker || 'Browser did not return a result');
  console.log(marker);
} finally {
  server?.closeAllConnections();
  await new Promise(resolveClose => server ? server.close(resolveClose) : resolveClose());
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
