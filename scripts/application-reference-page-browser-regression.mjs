import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { createApplicationReferenceProjects } from './fixtures/application-reference-projects.mjs';

const findChrome = () => {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync('which', [name], { encoding: 'utf8' });
    if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Chrome is required for the generated application page browser regression. Set CHROME_BIN.');
};
const dir = await mkdtemp(join(tmpdir(), 'tayar-reference-page-browser-'));
const referenceProjects = createApplicationReferenceProjects();
let server, proxy, marker;
const serverRequests = [];
const sockets = new Set();
const referencePages = new Map();
try {
  let html = '', mockFetch = '', harness = '', complete;
  const projectId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const completion = new Promise(resolveResult => { complete = resolveResult; });
  const keyPath = join(dir, 'localhost.key'), certPath = join(dir, 'localhost.crt');
  const certificate = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=*.apps.tayar.se', '-addext', 'subjectAltName=DNS:*.apps.tayar.se'], { stdio: 'ignore' });
  if (certificate.status !== 0) throw new Error('OpenSSL is required to create the isolated application browser certificate.');
  server = createServer({ key: await readFile(keyPath), cert: await readFile(certPath) }, (req, res) => {
    serverRequests.push(req.method + ' ' + req.url);
    const requestPath = new URL(req.url, 'https://fixture.local').pathname;
    if (referencePages.has(requestPath)) {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(referencePages.get(requestPath)); return;
    }
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
    version: 1, roles: [{ id: 'reviewer', name: 'Reviewer' }], pageAccess: [],
    auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    tables: [{
      id: 'records', key: 'records', name: 'Records',
      fields: [
        { id: 'record-name', key: 'name', name: 'Name', type: 'text', required: true },
        { id: 'record-state', key: 'state', name: 'State', type: 'enum', required: true, defaultValue: 'queued', options: ['queued', 'cooking', 'ready'] },
      ],
      permissions: [{ operation: 'read', access: 'public' }, { operation: 'update', access: 'owner' }],
      workflow: { fieldId: 'record-state', transitions: [
        { id: 'start-cooking', label: 'Start cooking', from: ['queued'], to: 'cooking', access: 'owner' },
        { id: 'mark-ready', label: 'Mark ready', from: ['cooking'], to: 'ready', access: 'owner' },
      ] },
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
    }, {
      id: 'bookings', key: 'bookings', name: 'Bookings',
      fields: [
        { id: 'booking-resource', key: 'resource_id', name: 'Room', type: 'reference', required: true, referenceTableId: 'resources' },
        { id: 'booking-start', key: 'starts_at', name: 'Start', type: 'datetime', required: true },
        { id: 'booking-end', key: 'ends_at', name: 'End', type: 'datetime', required: true },
        { id: 'booking-status', key: 'status', name: 'Status', type: 'enum', required: true, defaultValue: 'confirmed', options: ['confirmed', 'waiting'] },
      ],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
      booking: { resourceFieldId: 'booking-resource', startFieldId: 'booking-start', endFieldId: 'booking-end', statusFieldId: 'booking-status', blockingStatuses: ['confirmed'] },
    }, {
      id: 'resources', key: 'resources', name: 'Resources',
      fields: [{ id: 'resource-name', key: 'name', name: 'Name', type: 'text', required: true }],
      permissions: [{ operation: 'read', access: 'owner' }],
    }, {
      id: 'totals', key: 'totals', name: 'Totals',
      fields: [
        { id: 'total-price', key: 'price', name: 'Price', type: 'number', required: true, defaultValue: 0 },
        { id: 'total-quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true, defaultValue: 0 },
        { id: 'total-value', key: 'total', name: 'Total', type: 'number', required: true, formula: { operation: 'multiply', fieldIds: ['total-price', 'total-quantity'] } },
      ],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
    }, {
      id: 'permit-cases', key: 'permit_cases', name: 'Permit cases',
      fields: [
        { id: 'case-reference', key: 'case_reference', name: 'Case reference', type: 'text', required: true, unique: true },
        { id: 'applicant-label', key: 'applicant_label', name: 'Applicant', type: 'text', required: true },
        { id: 'permit-state', key: 'state', name: 'State', type: 'enum', required: true, defaultValue: 'submitted', options: ['submitted', 'approved', 'rejected'] },
      ],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      workflow: { fieldId: 'permit-state', transitions: [
        { id: 'approve', label: 'Approve', from: ['submitted'], to: 'approved', access: 'role', roleId: 'reviewer' },
        { id: 'reject', label: 'Reject', from: ['submitted'], to: 'rejected', access: 'role', roleId: 'reviewer' },
      ] },
    }, {
      id: 'research-samples', key: 'research_samples', name: 'Research samples',
      fields: [
        { id: 'sample-code', key: 'sample_code', name: 'Sample code', type: 'text', required: true, unique: true },
        { id: 'sample-metadata', key: 'metadata', name: 'Metadata', type: 'json', required: false },
        { id: 'sample-condition', key: 'condition', name: 'Condition', type: 'enum', required: true, defaultValue: 'received', options: ['received', 'analysed', 'archived'] },
      ],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      workflow: { fieldId: 'sample-condition', transitions: [
        { id: 'analyse', label: 'Analyse', from: ['received'], to: 'analysed', access: 'owner' },
        { id: 'archive', label: 'Archive', from: ['analysed'], to: 'archived', access: 'role', roleId: 'reviewer' },
      ] },
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
    }, {
      id: 'bookings-section', type: 'features', title: 'Bookings',
      applicationDataView: { tableId: 'bookings', columns: ['booking-status'], actions: ['create'], pageSize: 10 },
    }, {
      id: 'totals-section', type: 'features', title: 'Totals',
      applicationDataView: { tableId: 'totals', columns: ['total-price', 'total-quantity', 'total-value'], actions: ['create'], pageSize: 10 },
    }, {
      id: 'permit-cases-section', type: 'features', title: 'Permit cases',
      applicationDataView: { tableId: 'permit-cases', columns: ['case-reference', 'applicant-label', 'permit-state'], actions: ['transition'], pageSize: 10 },
    }, {
      id: 'research-samples-section', type: 'features', title: 'Research samples',
      applicationDataView: { tableId: 'research-samples', columns: ['sample-code', 'sample-condition'], actions: ['transition'], pageSize: 10 },
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
  const referenceRows = {};
  let fixtureNumber = 1;
  for (const reference of referenceProjects) {
    const featureTable = reference.definition.tables.find(table => table.id === reference.feature.tableId);
    assert.ok(featureTable, reference.domain + ' feature table should exist');
    for (const table of reference.definition.tables) {
      const firstTextField = table.fields.find(field => field.type === 'text');
      const row = {
        id: '00000000-0000-4000-8000-' + String(fixtureNumber++).padStart(12, '0'),
        owner_id: '11111111-1111-4111-8111-111111111111',
      };
      for (const field of table.fields) {
        if (field.type === 'text') row[field.key] = field === firstTextField ? 'Fixture ' + reference.domain : reference.domain + ' ' + field.name;
        else if (field.type === 'enum') row[field.key] = field.defaultValue ?? field.options?.[0] ?? '';
        else if (field.type === 'number') row[field.key] = field.defaultValue ?? 1;
        else if (field.type === 'boolean') row[field.key] = true;
        else if (field.type === 'json') row[field.key] = { fixture: true };
        else if (field.type === 'date') row[field.key] = '2026-10-12';
        else if (field.type === 'datetime') row[field.key] = '2026-10-12T10:00:00.000Z';
        else if (field.type === 'reference') row[field.key] = '00000000-0000-4000-8000-000000000001';
      }
      referenceRows[reference.domain] ||= {};
      referenceRows[reference.domain][table.key] = [row];
    }
    const featureLabelField = featureTable.fields[0];
    if (featureLabelField) referenceRows[reference.domain][featureTable.key][0][featureLabelField.key] = 'Fixture ' + reference.domain;
    const pagePath = '/fixtures/' + reference.domain + '.html';
    const sectionId = 'reference-' + reference.domain;
    const actions = reference.feature.capability === 'transaction' ? ['transact']
      : reference.feature.capability === 'workflow' ? ['transition']
      : ['create'];
    const referencePage = {
      id: 'home', name: reference.domain, slug: 'home',
      sections: [{
        id: sectionId, type: 'features', title: reference.domain,
        applicationDataView: { tableId: featureTable.id, columns: featureTable.fields.map(field => field.id), actions, pageSize: 10 },
      }],
    };
    const referenceFiles = await renderWebsiteApplicationSnapshot({
      application: reference.definition, homePageId: 'home', pages: [referencePage],
      siteName: 'Reference ' + reference.domain, siteUrl: 'https://reference.invalid',
    });
    assert.equal(referenceFiles.length, 1);
    const referenceViews = preparePublishedApplicationDataViews(reference.definition, 'home', referencePage.sections);
    const referenceResponse = await addApplicationPageBootstrap(new Response(referenceFiles[0].content, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }), {
      language: 'en', returnPath: pagePath, applicationOrigin: url,
      platformUrl: 'https://pnbllxdlskljcakyaylt.supabase.co',
      projectId, ownerId: '11111111-1111-4111-8111-111111111111',
      platformOrigin: 'https://tayar.se', signUpEnabled: false,
      definition: reference.definition, paths: [pagePath], pageId: 'home',
      applicationForms: [], applicationDataViews: referenceViews, backend,
    });
    referencePages.set(pagePath, await referenceResponse.text());
  }
  mockFetch = '(function(){var original=window.fetch.bind(window);window.__requests=[];window.__requestMethods=[];window.__mockLoaded=true;var user={id:"11111111-1111-4111-8111-111111111111",aud:"authenticated",role:"authenticated",email:"fixture@example.test",app_metadata:{provider:"email",providers:["email"]},user_metadata:{},created_at:"2026-01-01T00:00:00.000Z"};window.__orderRecord=null;window.__bookingRecord=null;window.__bookingChecks=0;window.__totalRows=[{id:"99999999-9999-4999-8999-999999999999",owner_id:user.id,price:2.5,quantity:4,total:10}];window.__record={id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",owner_id:user.id,name:"Generated page row",state:"queued"};window.__permitRecords=[{id:"12121212-1212-4121-8121-121212121212",owner_id:user.id,case_reference:"PERMIT-1",applicant_label:"Fixture applicant",state:"submitted"},{id:"14141414-1414-4141-8141-141414141414",owner_id:user.id,case_reference:"PERMIT-2",applicant_label:"Second fixture applicant",state:"submitted"}];window.__permitTransitionCount=0;window.__permitRecord=window.__permitRecords[0];window.__sampleRecord={id:"13131313-1313-4131-8131-131313131313",owner_id:user.id,sample_code:"SAMPLE-1",metadata:{fixture:true},condition:"received"};var payload=btoa(JSON.stringify({aud:"authenticated",exp:Math.floor(Date.now()/1000)+3600,sub:user.id,role:"authenticated",email:user.email})).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");var token="eyJhbGciOiJub25lIn0."+payload+".fixture";localStorage.setItem("tayar-app-'+ backend.projectRef + '-auth",JSON.stringify({access_token:token,token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:"fixture-refresh-token",user:user}));window.fetch=async function(input,init){var url=new URL(input instanceof Request?input.url:String(input),location.href);window.__requests.push(url.href);window.__requestMethods.push((init&&init.method)||(input instanceof Request?input.method:"GET"));if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/auth/v1/user")return Response.json(user);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/rpc/app_transition_workflow_0"){window.__record.state=window.__record.state==="queued"?"cooking":"ready";return Response.json("transitioned")}if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/rpc/app_create_transaction_2"){window.__orderRecord={id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",owner_id:user.id,reference:"ORDER-1",note:"Web transaction"};return Response.json({id:window.__orderRecord.id,status:"created"})}if(url.pathname==="/rest/v1/rpc/app_booking_available_4"){window.__bookingChecks++;return Response.json(window.__bookingChecks===1)}if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_products")return Response.json([{id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",owner_id:user.id,sku:"Widget",quantity:5}]);if(url.pathname==="/rest/v1/app_resources")return Response.json([{id:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",owner_id:user.id,name:"Room A"}]);if(url.pathname==="/rest/v1/app_totals"){var method=(init&&init.method)||(input instanceof Request?input.method:"GET");if(method==="POST"){var body=init&&init.body||(input instanceof Request?await input.clone().text():"{}");var values=JSON.parse(body);window.__totalRows.push({id:"88888888-8888-4888-8888-888888888888",owner_id:user.id,price:Number(values.price),quantity:Number(values.quantity),total:Number(values.price)*Number(values.quantity)});return new Response(null,{status:201})}return Response.json(window.__totalRows)}if(url.pathname==="/rest/v1/app_bookings"){var method=(init&&init.method)||(input instanceof Request?input.method:"GET");if(method==="POST"){var body=init&&init.body||(input instanceof Request?await input.clone().text():"{}");window.__bookingRecord=Object.assign(JSON.parse(body),{id:"ffffffff-ffff-4fff-8fff-ffffffffffff",owner_id:user.id});return new Response(null,{status:201})}return Response.json(window.__bookingRecord?[window.__bookingRecord]:[])}if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_orders")return Response.json(window.__orderRecord?[window.__orderRecord]:[]);if(url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_records")return Response.json([window.__record]);if(url.pathname==="/rest/v1/rpc/app_my_roles")return Response.json(["reviewer"]);if(url.pathname==="/rest/v1/rpc/app_transition_workflow_7"){window.__permitTransitionCount++;window.__permitRecords[window.__permitTransitionCount-1].state=window.__permitTransitionCount===1?"approved":"rejected";return Response.json("transitioned")}if(url.pathname==="/rest/v1/rpc/app_transition_workflow_8"){window.__sampleRecord.condition=window.__sampleRecord.condition==="received"?"analysed":"archived";return Response.json("transitioned")}if(url.pathname==="/rest/v1/app_permit_cases")return Response.json(window.__permitRecords);if(url.pathname==="/rest/v1/app_research_samples")return Response.json([window.__sampleRecord]);if(url.pathname==="/api/application-session")return Response.json({status:"signed-out"});return original(input,init)}})();';
  mockFetch = mockFetch.replace('window.__mockLoaded=true;', 'window.__mockLoaded=true;window.__referenceRows=' + JSON.stringify(referenceRows) + ';');
  mockFetch = mockFetch.replace(
    'var url=new URL(input instanceof Request?input.url:String(input),location.href);',
    'var url=new URL(input instanceof Request?input.url:String(input),location.href);if((location.pathname.startsWith("/fixtures/")||window.__referenceFixture)&&url.pathname.startsWith("/rest/v1/app_")&&((init&&init.method)||(input instanceof Request?input.method:"GET"))==="GET"){var fixtureTable=url.pathname.slice("/rest/v1/app_".length);var fixtureDomain=window.__referenceFixture||location.pathname.split("/")[2].replace(".html","");if(window.__referenceRows[fixtureDomain]?.[fixtureTable])return Response.json(window.__referenceRows[fixtureDomain][fixtureTable])}'
  );
  const factoryFetchPrefix = 'window.fetch=async function(input,init){var url=new URL(input instanceof Request?input.url:String(input),location.href);';
  const factoryFetchReplacement = factoryFetchPrefix + 'if(location.pathname==="/fixtures/school.html"&&url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/app_assessments"&&((init&&init.method)||(input instanceof Request?input.method:"GET"))==="POST"){window.__requests.push(url.href);window.__requestMethods.push("POST");var body=init&&init.body||(input instanceof Request?await input.clone().text():"{}");window.__schoolAssessmentInput=JSON.parse(body);var assessment={id:"abababab-abab-4bab-8bab-abababababac",owner_id:user.id,student:window.__schoolAssessmentInput.student,coursework_score:Number(window.__schoolAssessmentInput.coursework_score),exam_score:Number(window.__schoolAssessmentInput.exam_score)};assessment.total_score=assessment.coursework_score+assessment.exam_score;window.__referenceRows.school.assessments.unshift(assessment);return new Response(null,{status:201})}if(location.pathname==="/fixtures/factory.html"&&url.origin==='
    + JSON.stringify(backend.url) + '&&url.pathname==="/rest/v1/rpc/app_create_transaction_1"){window.__requests.push(url.href);window.__requestMethods.push("POST");var body=init&&init.body||(input instanceof Request?await input.clone().text():"{}");window.__factoryTransaction=JSON.parse(body);var created={id:"abababab-abab-4bab-8bab-abababababab",owner_id:user.id,batch_reference:window.__factoryTransaction.attrs.batch_reference,quantity:window.__factoryTransaction.attrs.quantity};window.__referenceRows.factory.work_orders.unshift(created);return Response.json({id:created.id,status:"created"})}';
  if (!mockFetch.includes(factoryFetchPrefix)) throw new Error('Factory transaction mock insertion point missing.');
  mockFetch = mockFetch.replace(factoryFetchPrefix, factoryFetchReplacement);
  harness = '(async function(){var result="FAIL generated page browser timeout";try{var host=document.querySelector("[data-tayar-data-view-id=records-section]");var root=host&&host.shadowRoot;var deadline=Date.now()+10000;while(Date.now()<deadline){var view=root&&root.querySelector(".view");if(view&&view.getAttribute("aria-busy")==="false")break;await new Promise(function(resolve){setTimeout(resolve,20)})}var view=root&&root.querySelector(".view");if(!view||view.getAttribute("aria-busy")!=="false")throw Error("Generated application data view did not become ready; host="+!!host+" root="+!!root+" view="+!!view+" busy="+(view&&view.getAttribute("aria-busy"))+" mock="+!!window.__mockLoaded+" requests="+JSON.stringify(window.__requests)+" status="+(root&&root.querySelector("[role=status]")?.textContent)+" account="+(document.querySelector("aside")?.shadowRoot?.textContent||"missing")+" page="+document.body.innerHTML.slice(0,500));var row=root.querySelector("tbody tr");if(!row||!row.textContent.includes("Generated page row"))throw Error("Rendered application page did not show the backend record; row="+(row&&row.textContent)+" requests="+JSON.stringify(window.__requests)+" status="+(root.querySelector("[role=status]")?.textContent)+" view="+view.innerHTML.slice(0,1500));if(!document.querySelector("aside")?.shadowRoot?.querySelector("nav"))throw Error("Application account navigation did not mount");var transition=[...root.querySelectorAll("button")].find(button=>button.textContent==="Start cooking"&&!button.disabled);if(!transition)throw Error("Generated workflow action was not rendered");transition.click();var transitionDeadline=Date.now()+5000;while(Date.now()<transitionDeadline){row=root.querySelector("tbody tr");if(window.__record.state==="cooking"&&row&&row.textContent.includes("cooking"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__record.state!=="cooking"||!row||!row.textContent.includes("cooking")||!window.__requests.some(function(url){return url.includes("/rest/v1/rpc/app_transition_workflow_0")}))throw Error("Generated workflow action did not update the application page");var markReadyDeadline=Date.now()+5000,markReady;while(Date.now()<markReadyDeadline){markReady=[...root.querySelectorAll("button")].find(button=>button.textContent==="Mark ready"&&!button.disabled);if(markReady)break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(!markReady)throw Error("Next generated workflow transition was not rendered");markReady.click();var readyDeadline=Date.now()+5000;while(Date.now()<readyDeadline){row=root.querySelector("tbody tr");if(window.__record.state==="ready"&&row&&row.textContent.includes("ready"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__record.state!=="ready"||!row||!row.textContent.includes("ready")||window.__requests.filter(function(url){return url.includes("/rest/v1/rpc/app_transition_workflow_0")}).length<2)throw Error("Generated workflow path did not complete its second transition");var permitHost=document.querySelector("[data-tayar-data-view-id=permit-cases-section]"),permitRoot=permitHost&&permitHost.shadowRoot,permitView=permitRoot&&permitRoot.querySelector(".view");if(!permitView||permitView.getAttribute("aria-busy")!=="false"||!permitRoot.querySelector("tbody tr")?.textContent.includes("submitted"))throw Error("Government permit data view did not become ready");var approve=[...permitRoot.querySelectorAll("button")].find(button=>button.textContent==="Approve"&&!button.disabled);if(!approve)throw Error("Government approval workflow action was not rendered");approve.click();var approveDeadline=Date.now()+5000;while(Date.now()<approveDeadline){var approvedPermitRow=[...permitRoot.querySelectorAll("tbody tr")].find(row=>row.textContent.includes("PERMIT-1"));if(window.__permitRecords[0].state==="approved"&&approvedPermitRow&&approvedPermitRow.textContent.includes("approved"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__permitRecords[0].state!=="approved"||![...permitRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("PERMIT-1")&&row.textContent.includes("approved"))||!window.__requests.some(function(url){return url.includes("/rest/v1/rpc/app_transition_workflow_7")}))throw Error("Government permit approval did not update the generated page");var rejectedPermitRow=[...permitRoot.querySelectorAll("tbody tr")].find(row=>row.textContent.includes("PERMIT-2"));var reject=[...rejectedPermitRow?.querySelectorAll("button")||[]].find(button=>button.textContent==="Reject"&&!button.disabled);if(!reject)throw Error("Government rejection workflow action was not rendered");reject.click();var rejectDeadline=Date.now()+5000;while(Date.now()<rejectDeadline){rejectedPermitRow=[...permitRoot.querySelectorAll("tbody tr")].find(row=>row.textContent.includes("PERMIT-2"));if(window.__permitRecords[1].state==="rejected"&&rejectedPermitRow?.textContent.includes("rejected"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__permitRecords[1].state!=="rejected"||!rejectedPermitRow?.textContent.includes("rejected")||window.__requests.filter(function(url){return url.includes("/rest/v1/rpc/app_transition_workflow_7")}).length!==2)throw Error("Government permit rejection did not update its generated page row");var sampleHost=document.querySelector("[data-tayar-data-view-id=research-samples-section]"),sampleRoot=sampleHost&&sampleHost.shadowRoot,sampleView=sampleRoot&&sampleRoot.querySelector(".view");if(!sampleView||sampleView.getAttribute("aria-busy")!=="false"||!sampleRoot.querySelector("tbody tr")?.textContent.includes("received"))throw Error("Research sample data view did not become ready");var analyse=[...sampleRoot.querySelectorAll("button")].find(button=>button.textContent==="Analyse"&&!button.disabled);if(!analyse)throw Error("Research analysis workflow action was not rendered");analyse.click();var analyseDeadline=Date.now()+5000,archive;while(Date.now()<analyseDeadline){var sampleRow=sampleRoot.querySelector("tbody tr");archive=[...sampleRoot.querySelectorAll("button")].find(button=>button.textContent==="Archive"&&!button.disabled);if(window.__sampleRecord.condition==="analysed"&&sampleRow&&sampleRow.textContent.includes("analysed")&&archive)break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__sampleRecord.condition!=="analysed"||!archive)throw Error("Research analysis workflow did not render its next action");archive.click();var archiveDeadline=Date.now()+5000;while(Date.now()<archiveDeadline){sampleRow=sampleRoot.querySelector("tbody tr");if(window.__sampleRecord.condition==="archived"&&sampleRow&&sampleRow.textContent.includes("archived"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__sampleRecord.condition!=="archived"||!sampleRoot.querySelector("tbody tr")?.textContent.includes("archived")||window.__requests.filter(function(url){return url.includes("/rest/v1/rpc/app_transition_workflow_8")}).length<2)throw Error("Research sample archive workflow did not complete its second transition");var orderHost=document.querySelector("[data-tayar-data-view-id=orders-section]"),orderRoot=orderHost&&orderHost.shadowRoot;var orderView=orderRoot&&orderRoot.querySelector(".view");if(!orderView||orderView.getAttribute("aria-busy")!=="false")throw Error("Generated transaction data view did not become ready");var startTransaction=[...orderRoot.querySelectorAll("button")].find(button=>button.textContent==="Create transaction"&&!button.hidden&&!button.disabled);if(!startTransaction)throw Error("Generated transaction action was not rendered");startTransaction.click();var orderForm=orderRoot.querySelector(".editor form");var transactionDeadline=Date.now()+5000;while(Date.now()<transactionDeadline&&(!orderForm||orderForm.querySelector("fieldset select")?.options.length<1)){await new Promise(function(resolve){setTimeout(resolve,20)});orderForm=orderRoot.querySelector(".editor form")}if(!orderForm||orderForm.querySelector("fieldset select")?.options.length<1)throw Error("Transaction item picker did not load");orderForm.elements.reference.value="ORDER-1";orderForm.elements.note.value="Web transaction";orderForm.querySelector("fieldset select").value="cccccccc-cccc-4ccc-8ccc-cccccccccccc";orderForm.querySelector("fieldset input[type=number]").value="2";var addLine=[...orderForm.querySelectorAll("button")].find(button=>button.textContent==="Add item");if(!addLine)throw Error("Transaction line action was not rendered");addLine.click();orderForm.requestSubmit();var orderDeadline=Date.now()+5000;while(Date.now()<orderDeadline){orderView=orderRoot.querySelector(".view");if(window.__orderRecord&&orderView?.getAttribute("aria-busy")==="false"&&orderRoot.querySelector("tbody tr")?.textContent.includes("Web transaction"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(!window.__orderRecord||!orderRoot.querySelector("tbody tr")?.textContent.includes("Web transaction")||!window.__requests.some(function(url){return url.includes("/rest/v1/rpc/app_create_transaction_2")}))throw Error("Generated transaction did not create and render the order");var bookingHost=document.querySelector("[data-tayar-data-view-id=bookings-section]"),bookingRoot=bookingHost&&bookingHost.shadowRoot,bookingView=bookingRoot&&bookingRoot.querySelector(".view");if(!bookingView||bookingView.getAttribute("aria-busy")!=="false")throw Error("Generated booking data view did not become ready");var addBooking=[...bookingRoot.querySelectorAll("button")].find(button=>button.textContent==="Add record"&&!button.disabled);if(!addBooking)throw Error("Generated booking action was not rendered");addBooking.click();var bookingForm=bookingRoot.querySelector(".editor form"),bookingDeadline=Date.now()+5000;while(Date.now()<bookingDeadline&&(!bookingForm||bookingForm.elements.resource_id?.options.length<2)){await new Promise(function(resolve){setTimeout(resolve,20)});bookingForm=bookingRoot.querySelector(".editor form")}if(!bookingForm||bookingForm.elements.resource_id.options.length<2)throw Error("Generated booking resource picker did not load");bookingForm.elements.resource_id.value="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";bookingForm.elements.starts_at.value="2026-11-02T10:00";bookingForm.elements.ends_at.value="2026-11-02T11:00";bookingForm.elements.status.value="confirmed";var checkAvailability=[...bookingForm.querySelectorAll("button")].find(button=>button.textContent==="Check availability");if(!checkAvailability)throw Error("Generated booking availability action was not rendered");checkAvailability.click();var availabilityDeadline=Date.now()+5000;while(Date.now()<availabilityDeadline&&(window.__bookingChecks<1||!bookingForm.textContent.includes("Available now"))){await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__bookingChecks!==1||!bookingForm.textContent.includes("Available now")||!window.__requests.some(function(url){return url.includes("/rest/v1/rpc/app_booking_available_4")}))throw Error("Generated booking availability check did not pass through the runtime");bookingForm.requestSubmit();var bookingSaveDeadline=Date.now()+5000;while(Date.now()<bookingSaveDeadline){bookingView=bookingRoot.querySelector(".view");if(window.__bookingRecord&&bookingView?.getAttribute("aria-busy")==="false"&&bookingRoot.querySelector("tbody tr")?.textContent.includes("confirmed"))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(!window.__bookingRecord||!bookingRoot.querySelector("tbody tr")?.textContent.includes("confirmed")||!window.__requests.some(function(url,index){return url.includes("/rest/v1/app_bookings")&&window.__requestMethods[index]==="POST"}))throw Error("Generated booking did not create and render the reservation");var conflictAddBooking=[...bookingRoot.querySelectorAll(\"button\")].find(button=>button.textContent===\"Add record\"&&!button.disabled);if(!conflictAddBooking)throw Error(\"Generated booking action was not available for the conflict check\");conflictAddBooking.click();var conflictForm=bookingRoot.querySelector(\".editor form\"),conflictDeadline=Date.now()+5000;while(Date.now()<conflictDeadline&&(!conflictForm||conflictForm.elements.resource_id?.options.length<2)){await new Promise(function(resolve){setTimeout(resolve,20)});conflictForm=bookingRoot.querySelector(\".editor form\")}if(!conflictForm||conflictForm.elements.resource_id.options.length<2)throw Error(\"Generated booking conflict form did not load\");conflictForm.elements.resource_id.value=\"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee\";conflictForm.elements.starts_at.value=\"2026-11-02T10:00\";conflictForm.elements.ends_at.value=\"2026-11-02T11:00\";conflictForm.elements.status.value=\"confirmed\";var checkConflict=[...conflictForm.querySelectorAll(\"button\")].find(button=>button.textContent===\"Check availability\");if(!checkConflict)throw Error(\"Generated booking conflict check was not rendered\");checkConflict.click();var conflictStatus=Date.now()+5000;while(Date.now()<conflictStatus&&(window.__bookingChecks<2||!conflictForm.textContent.includes(\"This interval is unavailable.\"))){await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__bookingChecks!==2||!conflictForm.textContent.includes(\"This interval is unavailable.\"))throw Error(\"Generated clinic page did not show the unavailable interval\");var bookingPostCount=window.__requestMethods.filter(function(method,index){return method===\"POST\"&&window.__requests[index].includes(\"/rest/v1/app_bookings\")}).length;if(bookingPostCount!==1||window.__bookingRecord.id!==\"ffffffff-ffff-4fff-8fff-ffffffffffff\")throw Error(\"Unavailable interval created an unexpected reservation\");var totalsHost=document.querySelector("[data-tayar-data-view-id=totals-section]"),totalsRoot=totalsHost&&totalsHost.shadowRoot,totalsView=totalsRoot&&totalsRoot.querySelector(".view");if(!totalsView||totalsView.getAttribute("aria-busy")!=="false"||!totalsRoot.querySelector("tbody tr")?.textContent.includes("10"))throw Error("Generated formula total did not render");var addTotal=[...totalsRoot.querySelectorAll("button")].find(button=>button.textContent==="Add record"&&!button.disabled);if(!addTotal)throw Error("Generated formula-backed create action was not rendered");addTotal.click();var totalForm=totalsRoot.querySelector(".editor form");if(!totalForm||totalForm.elements.total)throw Error("Formula output was exposed as an editable form field");totalForm.elements.price.value="3.5";totalForm.elements.quantity.value="6";totalForm.requestSubmit();var totalDeadline=Date.now()+5000;while(Date.now()<totalDeadline){totalsView=totalsRoot.querySelector(".view");if(window.__totalRows.length===2&&totalsView?.getAttribute("aria-busy")==="false"&&[...totalsRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("21")))break;await new Promise(function(resolve){setTimeout(resolve,20)})}if(window.__totalRows.length!==2||window.__totalRows[1].total!==21||![...totalsRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("21")))throw Error("Generated formula-backed create did not render the database-computed total");var referencePageChecks=[{"path":"/fixtures/retail.html","section":"reference-retail","label":"Fixture retail"},{"path":"/fixtures/restaurant.html","section":"reference-restaurant","label":"Fixture restaurant"},{"path":"/fixtures/school.html","section":"reference-school","label":"Fixture school"},{"path":"/fixtures/clinic.html","section":"reference-clinic","label":"Fixture clinic"},{"path":"/fixtures/government.html","section":"reference-government","label":"Fixture government"},{"path":"/fixtures/factory.html","section":"reference-factory","label":"Fixture factory"},{"path":"/fixtures/custom-research.html","section":"reference-custom-research","label":"Fixture custom-research"}];for(var fixtureIndex=0;fixtureIndex<referencePageChecks.length;fixtureIndex++){var fixtureCheck=referencePageChecks[fixtureIndex],fixtureFrame=document.createElement("iframe");fixtureFrame.style.cssText="position:fixed;left:-10000px;top:0;width:1000px;height:800px";document.body.append(fixtureFrame);await new Promise(function(resolve,reject){var fixtureTimer=setTimeout(function(){reject(Error("Generated reference page did not load: "+fixtureCheck.path))},10000);fixtureFrame.onload=function(){clearTimeout(fixtureTimer);resolve()};fixtureFrame.onerror=function(){clearTimeout(fixtureTimer);reject(Error("Generated reference page failed to load: "+fixtureCheck.path))};fixtureFrame.src=fixtureCheck.path});var fixtureDocument=fixtureFrame.contentDocument,fixtureHost=fixtureDocument&&fixtureDocument.querySelector("[data-tayar-data-view-id="+fixtureCheck.section+"]"),fixtureRoot=fixtureHost&&fixtureHost.shadowRoot,fixtureDeadline=Date.now()+10000,fixtureView;while(Date.now()<fixtureDeadline){fixtureView=fixtureRoot&&fixtureRoot.querySelector(".view");var fixtureRow=fixtureRoot&&fixtureRoot.querySelector("tbody tr");if(fixtureView&&fixtureView.getAttribute("aria-busy")==="false"&&fixtureRow&&fixtureRow.textContent.includes(fixtureCheck.label))break;await new Promise(function(resolve){setTimeout(resolve,20)})}fixtureView=fixtureRoot&&fixtureRoot.querySelector(".view");var fixtureRow=fixtureRoot&&fixtureRoot.querySelector("tbody tr");if(!fixtureView||fixtureView.getAttribute("aria-busy")!=="false"||!fixtureRow||!fixtureRow.textContent.includes(fixtureCheck.label))throw Error("Generated "+fixtureCheck.path+" did not render its fixture row; fixture="+fixtureFrame.contentWindow.__referenceFixture+" mock="+fixtureFrame.contentWindow.__mockLoaded+" rows="+JSON.stringify(Object.keys(fixtureFrame.contentWindow.__referenceRows?.[fixtureFrame.contentWindow.__referenceFixture]||{}))+" requests="+JSON.stringify(fixtureFrame.contentWindow.__requests)+" host="+!!fixtureHost+" root="+!!fixtureRoot+" view="+!!fixtureView+" busy="+(fixtureView&&fixtureView.getAttribute("aria-busy"))+" row="+(fixtureRow&&fixtureRow.textContent)+" url="+fixtureFrame.contentWindow.location.href);if(fixtureCheck.path==="/fixtures/school.html"){var schoolAction=[...fixtureRoot.querySelectorAll("button")].find(button=>button.textContent==="Add record"&&!button.disabled);if(!schoolAction)throw Error("Generated school assessment create action was not rendered");schoolAction.click();var schoolForm=fixtureRoot.querySelector(".editor form"),schoolDeadline=Date.now()+5000;while(Date.now()<schoolDeadline&&(!schoolForm||schoolForm.elements.student?.options.length<1)){await new Promise(function(resolve){setTimeout(resolve,20)});schoolForm=fixtureRoot.querySelector(".editor form")}if(!schoolForm||schoolForm.elements.student?.options.length<1)throw Error("Generated school student picker did not load");if(schoolForm.elements.total_score)throw Error("Formula output was exposed as an editable school assessment field");var schoolStudent=fixtureFrame.contentWindow.__referenceRows.school.students[0];schoolForm.elements.student.value=schoolStudent.id;schoolForm.elements.coursework_score.value="4";schoolForm.elements.exam_score.value="7";schoolForm.requestSubmit();var schoolSaveDeadline=Date.now()+5000;while(Date.now()<schoolSaveDeadline){fixtureView=fixtureRoot.querySelector(".view");if(fixtureFrame.contentWindow.__referenceRows.school.assessments.length===2&&fixtureView?.getAttribute("aria-busy")==="false"&&[...fixtureRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("11")))break;await new Promise(function(resolve){setTimeout(resolve,20)})}var schoolInput=fixtureFrame.contentWindow.__schoolAssessmentInput,schoolAssessment=fixtureFrame.contentWindow.__referenceRows.school.assessments[0];if(!schoolInput||schoolInput.student!==schoolStudent.id||Number(schoolInput.coursework_score)!==4||Number(schoolInput.exam_score)!==7||Object.hasOwn(schoolInput,"total_score")||schoolAssessment.total_score!==11||![...fixtureRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("11"))||!fixtureFrame.contentWindow.__requests.some(function(url,index){return url.includes("/rest/v1/app_assessments")&&fixtureFrame.contentWindow.__requestMethods[index]==="POST"}))throw Error("Generated school assessment did not save and render its database-computed total; input="+JSON.stringify(schoolInput)+" rows="+JSON.stringify(fixtureFrame.contentWindow.__referenceRows.school.assessments)+" rendered="+JSON.stringify([...fixtureRoot.querySelectorAll("tbody tr")].map(row=>row.textContent))+" requests="+JSON.stringify(fixtureFrame.contentWindow.__requests)+" busy="+fixtureView?.getAttribute("aria-busy"))} if(fixtureCheck.path==="/fixtures/factory.html"){var factoryAction=[...fixtureRoot.querySelectorAll("button")].find(button=>button.textContent==="Create transaction"&&!button.disabled);if(!factoryAction)throw Error("Generated factory transaction action was not rendered");factoryAction.click();var factoryForm=fixtureRoot.querySelector(".editor form"),factoryDeadline=Date.now()+5000;while(Date.now()<factoryDeadline&&(!factoryForm||factoryForm.querySelector("fieldset select")?.options.length<1)){await new Promise(function(resolve){setTimeout(resolve,20)});factoryForm=fixtureRoot.querySelector(".editor form")}if(!factoryForm||factoryForm.querySelector("fieldset select")?.options.length<1)throw Error("Generated factory material picker did not load");factoryForm.elements.batch_reference.value="BATCH-42";factoryForm.elements.quantity.value="3";var factoryMaterial=fixtureFrame.contentWindow.__referenceRows.factory.materials[0],factorySelect=factoryForm.querySelector("fieldset select"),factoryLineQuantity=factoryForm.querySelector("fieldset input[type=number]");factorySelect.value=factoryMaterial.id;factoryLineQuantity.value="2";var factoryAddLine=[...factoryForm.querySelectorAll("button")].find(button=>button.textContent==="Add item");if(!factoryAddLine)throw Error("Generated factory line action was not rendered");factoryAddLine.click();factoryForm.requestSubmit();var factorySaveDeadline=Date.now()+5000;while(Date.now()<factorySaveDeadline){fixtureView=fixtureRoot.querySelector(".view");if(fixtureFrame.contentWindow.__factoryTransaction&&fixtureView?.getAttribute("aria-busy")==="false"&&[...fixtureRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("BATCH-42")))break;await new Promise(function(resolve){setTimeout(resolve,20)})}var factoryTransaction=fixtureFrame.contentWindow.__factoryTransaction;if(!factoryTransaction||factoryTransaction.attrs.batch_reference!=="BATCH-42"||Number(factoryTransaction.attrs.quantity)!==3||factoryTransaction.lines.length!==1||factoryTransaction.lines[0].itemId!==factoryMaterial.id||Number(factoryTransaction.lines[0].quantity)!==2||![...fixtureRoot.querySelectorAll("tbody tr")].some(row=>row.textContent.includes("BATCH-42"))||!fixtureFrame.contentWindow.__requests.some(url=>url.includes("/rest/v1/rpc/app_create_transaction_1")))throw Error("Generated factory page did not create and render its material issue transaction")}fixtureFrame.remove()}result="PASS generated kitchen, government permit, and research workflows, factory and retail transactions, booking, and formula-backed create run through the private application runtime"}catch(error){result="FAIL "+(error&&error.stack||String(error))}try{await fetch("/result",{method:"POST",body:result})}catch(error){document.body.dataset.failure=String(error)}})();';
  for (const [referencePath, referenceHtml] of referencePages) {
    referencePages.set(referencePath, referenceHtml.replace('</head>', '<script src="/mock.js"></script></head>'));
  }
  html = html.replace('</head>', '<script src="/mock.js"></script></head>');
  html = html.replace('</body>', '<script src="/harness.js"></script></body>');
  const detached = process.platform !== 'win32';
  const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-proxy-server',
    '--disable-background-networking', '--ignore-certificate-errors', '--host-resolver-rules=MAP ' + projectId + '.apps.tayar.se 127.0.0.1,EXCLUDE localhost', '--user-data-dir=' + dir, url + '/index.html'], { detached, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', timer;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  try {
    marker = await Promise.race([completion, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Generated application page browser timed out: ' + stderr + '\\nRequests: ' + serverRequests.join(', '))), 30_000);
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
