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
let server, proxy, marker;
const sockets = new Set();
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
  server.keepAliveTimeout = 1000;
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const url = 'https://' + projectId + '.apps.tayar.se';
  const proxyScript = "require('net').createServer(socket=>{const upstream=require('net').connect(" + server.address().port + ",'127.0.0.1');socket.pipe(upstream);upstream.pipe(socket)}).listen(443,'127.0.0.1',()=>console.log('ready'))";
  proxy = spawn('sudo', ['-n', process.execPath, '-e', proxyScript], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let proxyOutput = '';
  await Promise.race([
    new Promise((resolveProxy, rejectProxy) => {
      proxy.stdout.on('data', chunk => { proxyOutput += chunk; if (proxyOutput.includes('ready')) resolveProxy(); });
      proxy.stderr.on('data', chunk => { proxyOutput += chunk; });
      proxy.once('error', rejectProxy);
      proxy.once('exit', code => rejectProxy(new Error('HTTPS loopback proxy exited (' + code + '): ' + proxyOutput)));
    }),
    new Promise((_, rejectProxy) => setTimeout(() => rejectProxy(new Error('HTTPS loopback proxy did not start: ' + proxyOutput)), 10_000)),
  ]);
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
      fields: [
        { id: 'record-name', key: 'name', name: 'Name', type: 'text', required: true },
        { id: 'record-state', key: 'state', name: 'State', type: 'enum', required: true, defaultValue: 'queued', options: ['queued', 'cooking'] },
      ],
      permissions: [{ operation: 'read', access: 'public' }, { operation: 'update', access: 'owner' }],
      workflow: { fieldId: 'record-state', transitions: [{ id: 'start-cooking', label: 'Start cooking', from: ['queued'], to: 'cooking', access: 'owner' }] },
    }, {
      id: 'products', key: 'products', name: 'Products',
      fields: [
        { id: 'product-sku', key: 'sku', name: 'SKU', type: 'text', required: true },
        { id: 'product-quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 },
      ],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      counter: { fieldId: 'product-quantity', minimum: 0, integer: true },
    }, {
      id: 'orders', key: 'orders', name: 'Orders',
      fields: [
        { id: 'order-reference', key: 'reference', name: 'Reference', type: 'text', required: true },
        { id: 'order-note', key: 'note', name: 'Note', type: 'text', required: false },
      ],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
      transaction: { itemTableId: 'products', lineTableId: 'order-lines', lineTransactionFieldId: 'line-order', lineItemFieldId: 'line-product', lineQuantityFieldId: 'line-quantity', counterDirection: 'decrement' },
    }, {
      id: 'order-lines', key: 'order_lines', name: 'Order lines',
      fields: [
        { id: 'line-order', key: 'order_id', name: 'Order', type: 'reference', required: true, referenceTableId: 'orders' },
        { id: 'line-product', key: 'product_id', name: 'Product', type: 'reference', required: true, referenceTableId: 'products' },
        { id: 'line-quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true },
      ],
      permissions: [{ operation: 'read', access: 'owner' }],
    }],
  };
  const page = {
    id: 'home', name: 'Home', slug: 'home',
    sections: [{
      id: 'records-section', type: 'features', title: 'Records',
      applicationDataView: { tableId: 'records', columns: ['record-name', 'record-state'], actions: ['transition'], pageSize: 10 },
    }, {
      id: 'orders-section', type: 'features', title: 'Orders',
      applicationDataView: { tableId: 'orders', columns: ['order-reference', 'order-note'], actions: ['transact'], pageSize: 10 },
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
  mockFetch = '(function(){var original=window.fetch.bind(window);window.__requests=[];window.__mockLoaded=true;var user={id:"11111111-1111-4111-8111-111111111111",aud:"authenticated",role:"authenticated",email:"fixture@example.test",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},created_at:"2026-01-01T00:00:00.000Z"};window.__orderRecord=null;window.__record={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",owner_id:user.id,name:"Generated page row",state:"queued"};var payload=btoa(JSON.stringify({aud:"authenticated",exp:Math.floor(Date.now()/1000)+3600,sub:user.id,role:"authenticated",email:user.email})).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");var token="eyJhbGciOiJub25lIn0."+payload+".fixture";localStorage.setItem("tayar-app-'+ backend.projectRef + '-auth",JSON.stringify({access_token:token,token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:"fixture-refresh-token",user:user}));window.fetch=async function(input,init){var url=new URL(input instanceof Request?input.url:String(input),location.href);window.__requests.push(url.href);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/auth/v1/user")return Response.json(user);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/rpc/app_transition_workflow_0"){window.__record.state="cooking";return Response.json("transitioned")}if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/rpc/app_create_transaction_2"){window.__orderRecord={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",owner_id:user.id,reference:"ORDER-1",note:"Web transaction"};return Response.json({id:window.__orderRecord.id,status:"created"})}if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_products")return Response.json([{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",owner_id:user.id,sku:"Widget",quantity:5}]);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_orders")return Response.json(window.__orderRecord?[window.__orderRecord]:[]);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_records")return Response.json([window.__record]);if(url.pathname==="/api/application-session")return Response.json({status:"signed-out"});return original(input,init)}})();';
  harness = '(async function(){var result="FAIL generated page browser timeout";try{var host=document.querySelector("[data-tayar-data-view-id=records-section]");var root=host&&host.shadowRoot;var deadline=Date.now()+10000;while(Date.now()<deadline){var view=root&&root.querySelector(".view");if(view&&view.getAttribute("aria-busy")==="false")break;await new Promise(function(resolve){setTimeout(resolve,20)})}var view=root&&root.querySelector(".view");if(!view||view.getAttribute("aria-busy")!=="false")throw Error("Generated application data view did not become ready; host="+!!host+" root="+!!root+" view="+!!view+" busy="+(view&&view.getAttribute("aria-busy"))+" mock="+!!window.__mockLoaded+" requests="+JSON.stringify(window.__requests)+" status="+(root&&root.querySelector("[role=status]")?.textContent)+" account="+(document.querySelector("aside")?.shadowRoot?.textContent||"missing")+" page="+document.body.innerHTML.slice(0,500));var row=root.querySelector("tbody tr");if(!row||!row.textContent.includes("Generated page row"))throw Error("Rendered application page did not show the backend record; row="+(row&&row.textContent)+" requests="+JSON.stringify(window.__requests)+" status="+(root.querySelector("[role=status]")?.textContent)+" view="+view.innerHTML.slice(0,1500));if(!document.querySelector("aside")?.shadowRoot?.querySelector("nav"))throw Error("Application account navigation did not mount");var transition=[...root.querySelectorAll("button")].find(button=>button.textContent==="Start cooking"&&!button.disabled);if(!transition)throw Error("Generated workflow action was not rendered");transition.click();var transitionDeadline=Date.now()+5000;while(Date.now()<transitionDeadline){row=root.querySelector("tbody tr");if(window.__record.state==="cooking"&&row&&row.textContent.includes("cooking"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__record.state!=="cooking"||!row||!row.textContent.includes("cooking")||!window.__requests.some(function(url){return url.includes("/rest/v1/rpc/app_transition_workflow_0")}))throw Error("Generated workflow action did not update the application page");var orderHost=document.querySelector("[data-tayar-data-view-id=orders-section]"),orderRoot=orderHost&&orderHost.shadowRoot;var orderView=orderRoot&&orderRoot.querySelector(".view");if(!orderView||orderView.getAttribute("aria-busy")!=="false")throw Error("Generated transaction data view did not become ready");var startTransaction=[...orderRoot.querySelectorAll("button")].find(button=>button.textContent==="Create transaction"&&!button.hidden&&!button.disabled);if(!startTransaction)throw Error("Generated transaction action was not rendered");startTransaction.click();var orderForm=orderRoot.querySelector(".editor form");var transactionDeadline=Date.now()+5000;while(Date.now()<transactionDeadline&&(!orderForm||orderForm.querySelector("fieldset select")?.options.length<1)){await new Promise(function(resolve){setTimeout(resolve,20)});orderForm=orderRoot.querySelector(".editor form")}if(!orderForm||orderForm.querySelector("fieldset select")?.options.length<1)throw Error("Transaction item picker did not load");orderForm.elements.reference.value="ORDER-1";orderForm.elements.note.value="Web transaction";orderForm.querySelector("fieldset select").value="cccccccc-cccc-4ccc-8ccc-cccccccccccc";orderForm.querySelector("fieldset input[type=number]").value="2";var addLine=[...orderForm.querySelectorAll("button")].find(button=>button.textContent==="Add item");if(!addLine)throw Error("Transaction line action was not rendered");addLine.click();orderForm.requestSubmit();var orderDeadline=Date.now()+5000;while(Date.now()<orderDeadline){orderView=orderRoot.querySelector(".view");if(window.__orderRecord&&orderView?.getAttribute("aria-busy")==="false"&&orderRoot.querySelector("tbody tr")?.textContent.includes("Web transaction"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(!window.__orderRecord||!orderRoot.querySelector("tbody tr")?.textContent.includes("Web transaction")||!window.__requests.some(function(url){return url.includes("/rest/v1/rpc/app_create_transaction_2")}))throw Error("Generated transaction did not create and render the order");result="PASS generated page workflow transition and inventory transaction run through the private application runtime"}catch(error){result="FAIL "+(error&&error.stack||String(error))}try{await fetch("/result",{method:"POST",body:result})}catch(error){document.body.dataset.failure=String(error)}})();';
  html = html.replace('</head>', '<script src="/mock.js"></script></head>');
  html = html.replace('</body>', '<script src="/harness.js"></script></body>');
  const detached = process.platform !== 'win32';
  const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--ignore-certificate-errors', '--host-resolver-rules=MAP *.apps.tayar.se 127.0.0.1,EXCLUDE localhost', '--user-data-dir=' + dir, url + '/index.html'], { detached, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', timer;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
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
} finally {
  if (proxy?.pid) { try { process.kill(-proxy.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
  server?.closeAllConnections();
  for (const socket of sockets) socket.destroy();
  await new Promise(resolveClose => server ? server.close(resolveClose) : resolveClose());
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
console.log(marker);
process.exit(0);
