import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
const dir = await mkdtemp(join(tmpdir(), 'tayar-transaction-')), require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const itemA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', itemB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const request = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const originalFetch = globalThis.fetch;
try {
  const entry = join(dir, 'entry.ts');
  await writeFile(entry, ['application-model', 'application-validation', 'application-schema-sql', 'application-transaction', 'application-transaction-sql', 'application-form-runtime', 'application-data-runtime', 'application-data-view-controller', 'application-payment-runtime', 'application-payment-status']
    .map(name => `export * from ${JSON.stringify(resolve(`src/modules/website-builder/core/${name}`))};`).join('\n')
    + ['website-owned-transaction-catalog','website-owned-payment-access','website-owned-payment-access-schema','website-owned-stripe-order-schema','website-owned-payment-rpc','website-owned-payment-route','website-owned-payment-package']
      .map(name=>`\nexport * from ${JSON.stringify(resolve(`server/${name}`))};`).join(''));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: join(dir, 'transaction.cjs') });
  const { compileInitialApplicationSchema: compile, compileAdditiveApplicationMigration: migrate, readApplicationDefinition: validate,
    parseApplicationTransactionLines: parseLines, createOwnedApplicationDataRuntime: runtimeFor,
    createApplicationDataViewController: controllerFor, verifyOwnedTransactionCatalog: verify,
    parseApplicationPaymentStatus:parsePaymentStatus,createApplicationPaymentRuntime:browserPayments,createOwnedPaymentAccess:paymentAccess,compileOwnedPaymentAccessSchema:accessSchema,
    compileOwnedStripeOrderSchema:stripeSchema,createOwnedPaymentRpcClient:paymentRpc,
    serveOwnedPaymentRoute:paymentRoute,compileOwnedPaymentPackage:paymentPackage } = require(join(dir, 'transaction.cjs'));
  const products = { id: 'products', key: 'products', name: 'Products', fields: [
    { id: 'product_name', key: 'name', name: 'Name', type: 'text', required: true },
    { id: 'product_price', key: 'price_minor', name: 'Price', type: 'number', required: true, defaultValue: 100 },
    { id: 'product_stock', key: 'quantity', name: 'Stock', type: 'number', required: true, defaultValue: 0 },
  ], permissions: [{ operation: 'read', access: 'authenticated' }, { operation: 'update', access: 'authenticated' }], counter: { fieldId: 'product_stock', minimum: 0, maximum: 100, integer: true } };
  const orders = { id: 'orders', key: 'orders', name: 'Orders', fields: [
    { id: 'order_note', key: 'note', name: 'Note', type: 'text', required: true },
    { id: 'order_price', key: 'price', name: 'Price', type: 'number', required: true, defaultValue: 2 },
    { id: 'order_units', key: 'units', name: 'Units', type: 'number', required: true, defaultValue: 5 },
    { id: 'order_total', key: 'total', name: 'Total', type: 'number', required: true, formula: { operation: 'multiply', fieldIds: ['order_price', 'order_units'] } },
  ],
    permissions: [{ operation: 'read', access: 'owner' }, { operation: 'create', access: 'owner' }],
    transaction: { itemTableId: 'products', lineTableId: 'order_lines', lineTransactionFieldId: 'line_order', lineItemFieldId: 'line_item', lineQuantityFieldId: 'line_quantity', counterDirection: 'decrement' } };
  const lines = { id: 'order_lines', key: 'order_lines', name: 'Order lines', fields: [
    { id: 'line_order', key: 'order_id', name: 'Order', type: 'reference', required: true, referenceTableId: 'orders' },
    { id: 'line_item', key: 'product_id', name: 'Product', type: 'reference', required: true, referenceTableId: 'products' },
    { id: 'line_quantity', key: 'quantity', name: 'Quantity', type: 'number', required: true },
  ], permissions: [{ operation: 'read', access: 'owner' }] };
  const app = { version: 1, roles: [], pageAccess: [], auth: { enabled: true, signUpEnabled: true, emailVerificationRequired: true }, tables: [products, orders, lines] };
  const sql = compile(app).join('\n'); validate(app);
  const parentInsert = sql.match(/insert into public\."app_orders"\([^;]+;/)?.[0];
  assert.ok(parentInsert); assert.doesNotMatch(parentInsert, /"total"/);
  const withoutTotal = { ...app, tables: [products, { ...orders, fields: orders.fields.filter(field => !field.formula) }, lines] };
  assert.match(migrate(withoutTotal, app).join('\n'), /create or replace function private.app_create_transaction_1/);
  const derivedQuantity = { ...lines, fields: [...lines.fields.map(field => field.id === 'line_quantity'
    ? { ...field, formula: { operation: 'multiply', fieldIds: ['factor_a', 'factor_b'] } } : field),
    { id: 'factor_a', key: 'factor_a', name: 'Factor A', type: 'number', required: true, defaultValue: 1 },
    { id: 'factor_b', key: 'factor_b', name: 'Factor B', type: 'number', required: true, defaultValue: 1 }] };
  assert.throws(() => validate({ ...app, tables: [products, orders, derivedQuantity] }), /transaction/);
  assert.match(sql, /app_create_transaction_1/); assert.match(sql, /order by "itemId"/); assert.match(sql, /app_transaction_requests_pkey/);
  assert.match(sql, /Application transaction exceeds allowed bounds/); assert.match(sql, /security invoker/);
  assert.deepEqual(parseLines(orders, products, [{ itemId: itemA, quantity: '2' }]), [{ itemId: itemA, quantity: 2 }]);
  for (const invalid of [[], [{ itemId: itemA, quantity: 0 }], [{ itemId: itemA, quantity: 1 }, { itemId: itemA, quantity: 2 }], [{ itemId: 'bad', quantity: 1 }]]) assert.throws(() => parseLines(orders, products, invalid));
  for (const transaction of [{ ...orders.transaction, lineTableId: 'orders' }, { ...orders.transaction, counterDirection: 'sideways' }, { ...orders.transaction, lineQuantityFieldId: 'line_item' }, { ...orders.transaction, secret: 'no' }]) {
    assert.throws(() => validate({ ...app, tables: [products, { ...orders, transaction }, lines] }));
  }
  const payable={...orders,payment:{provider:'stripe',currency:'sek',itemUnitAmountFieldId:'product_price',refundRoleId:'refund_admin'}};
  const paymentApp={...app,roles:[{id:'refund_admin',name:'Refund administrators'}],tables:[products,payable,lines]};
  validate(paymentApp);
  assert.throws(()=>compile(paymentApp),/payment provisioning/i);
  const originalLocation=globalThis.location;
  globalThis.location={origin:'https://orders.example.com'};
  let browserCalls=0, currentPaymentOwner=owner, paymentReply={url:'https://checkout.stripe.com/c/pay/fixture'};
  const browser=browserPayments(globalThis.location.origin,async actor=>{assert.equal(actor,owner);return 'verified-token';},
    async actor=>{if(actor!==currentPaymentOwner)throw Error('identity changed');},async(resource,init)=>{
      browserCalls++;const path=new URL(resource).pathname;const body=JSON.parse(init.body);
      assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer verified-token');
      assert.equal(body.operationId,request);assert.equal(body.orderId,itemA);
      if(path.endsWith('/checkout')){assert.equal(body.checkoutId,'orders');assert.equal(body.amount,undefined);}
      else assert.equal(body.amount,100);
      return Response.json(paymentReply,{status:path.endsWith('/checkout')?200:202});
    });
  try{
    assert.equal(await browser.checkout('orders',itemA,request,owner),'https://checkout.stripe.com/c/pay/fixture');
    paymentReply={url:'https://checkout.stripe.com/c/pay/fixture#stripe-fragment'};assert.equal(await browser.checkout('orders',itemA,request,owner),paymentReply.url);
    paymentReply={url:'https://malicious.example/'};await assert.rejects(browser.checkout('orders',itemA,request,owner),/destination/);
    paymentReply={status:'pending'};assert.equal(await browser.refund('orders',itemA,request,100,owner),'pending');
    const beforeInvalid=browserCalls;await assert.rejects(browser.refund('orders',itemA,request,1.5,owner),/amount/);assert.equal(browserCalls,beforeInvalid);
    currentPaymentOwner=other;await assert.rejects(browser.refund('orders',itemA,request,100,owner),/identity changed/);
    globalThis.location={origin:'https://foreign.example'};const beforeForeign=browserCalls;
    await assert.rejects(browser.checkout('orders',itemA,request,owner),/unavailable/);assert.equal(browserCalls,beforeForeign);
  }finally{if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;}
  let paymentRoles=[], paymentOwner=owner, loseRefund=true;const operationIds=[],paymentStorage=new Map();
  const paymentScope={keyPrefix:'tayar-app-form:payment-fixture',crypto:webcrypto,storage:{getItem:key=>paymentStorage.get(key)??null,setItem:(key,value)=>paymentStorage.set(key,value),removeItem:key=>paymentStorage.delete(key)}};
  const paymentRuntime={auth:{currentUser:async()=>({id:paymentOwner}),currentRoles:async()=>paymentRoles},payments:{available:true,
    checkout:async(_table,_order,operation)=>{operationIds.push(operation);return 'https://checkout.stripe.com/c/pay/fixture';},
    refund:async(_table,_order,operation)=>{operationIds.push(operation);if(loseRefund)throw Error('lost response');return 'pending';}}};
  const paymentBinding={tableId:'orders',columns:['order_note'],actions:['pay','refund'],pageSize:10};
  const paymentController=controllerFor(paymentApp,paymentBinding,paymentRuntime,()=>request,paymentScope);
  assert.deepEqual(await paymentController.permissions(),['pay']);await assert.rejects(paymentController.refund(itemA,100),/not permitted/);
  await paymentController.pay(itemA);await paymentController.pay(itemA);assert.deepEqual(operationIds,[itemA,itemA]);
  paymentRoles=['refund_admin'];assert.deepEqual(await paymentController.permissions(),['pay','refund']);
  await assert.rejects(paymentController.refund(itemA,100),/uncertain/);paymentController.dispose();loseRefund=false;
  const retriedPaymentController=controllerFor(paymentApp,paymentBinding,paymentRuntime,()=>request,paymentScope);
  await retriedPaymentController.refund(itemA,100);assert.equal(operationIds.at(-1),operationIds.at(-2));
  paymentOwner=other;await assert.rejects(retriedPaymentController.pay(itemA),/identity changed/);
  console.log('PASS order payment browser boundary: frozen server prices, same-origin calls, destination validation, role gating, durable retries and stale-user refusal');
  const paymentSql=compile(paymentApp,{stripeOrderPaymentsProvisioned:true}).join('\n');
  assert.match(paymentSql,/unit_amount<>trunc\(unit_amount\)/);
  assert.match(paymentSql,/insert into private.app_order_quotes/);
  assert.match(paymentSql,/from public,anon,authenticated,service_role/);
  for(const payment of [{...payable.payment,currency:'SEK'},{...payable.payment,itemUnitAmountFieldId:'product_name'},
    {...payable.payment,itemUnitAmountFieldId:'product_stock'},
    {...payable.payment,refundRoleId:'missing'},{...payable.payment,provider:'browser'}])
    assert.throws(()=>validate({...paymentApp,tables:[products,{...payable,payment},lines]}),/payment/i);
  assert.throws(()=>migrate(app,paymentApp),/payment migration/i);
  const accessSql=accessSchema(paymentApp).join('\n');
  assert.match(accessSql,/Price administration role required/);
  const paymentClient={async rpc(name,args){
    assert.equal(args.p_user_id,owner);assert.equal(args.p_order_id,itemA);
    if(name==='app_order_quote_1')return{data:{amount:250,currency:'sek'},error:null};
    assert.equal(name,'app_order_refund_authorize_1');return{data:{paymentIntentId:'pi_fixture12345678',amount:100},error:null};
  }};
  const payment=paymentAccess({definition:paymentApp,tableId:'orders',returnPath:'/orders.html',client:paymentClient});
  assert.deepEqual(await payment.loadOrder({orderId:itemA,userId:owner,checkoutId:'orders'}),{amount:250,currency:'sek',returnPath:'/orders.html'});
  assert.equal(await payment.loadOrder({orderId:itemA,userId:owner,checkoutId:'wrong'}),null);
  assert.deepEqual(await payment.authorizeRefund({orderId:itemA,userId:owner,amount:100}),{paymentIntentId:'pi_fixture12345678',amount:100});
  const before = { ...app, tables: [products, { ...orders, transaction: undefined }, lines] };
  assert.match(migrate(before, app).join('\n'), /app_create_transaction_1/);
  assert.throws(() => migrate(app, before), /reviewed/);
  const changedProducts = { ...products, permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }] };
  assert.match(migrate(app, { ...app, tables: [changedProducts, orders, lines] }).join('\n'), /create or replace function private.app_create_transaction_1/);

  const backend = { url: 'https://sgewokeojtzsqjaeluan.supabase.co', projectRef: 'sgewokeojtzsqjaeluan', publishableKey: 'sb_publishable_transaction_fixture' };
  const privateKey=['sb','secret','fixture12345678901234567890'].join('_');let paymentCalls=0;
  const privateClient=paymentRpc({backend,expectedProjectRef:backend.projectRef,definition:paymentApp,secretKey:privateKey,
    fetcher:async(resource,init)=>{paymentCalls++;const url=new URL(String(resource));assert.equal(url.origin,backend.url);
      if(url.pathname==='/auth/v1/user'){assert.equal(init.headers.apikey,backend.publishableKey);
        return Response.json({id:owner,is_anonymous:false,email_confirmed_at:'2026-10-10T00:00:00Z'});}
      assert.equal(url.pathname,'/rest/v1/rpc/app_order_quote_1');assert.equal(init.headers.apikey,privateKey);
      assert.equal(init.headers.Authorization,undefined);return Response.json({amount:250,currency:'sek'});}});
  assert.deepEqual(await privateClient.authenticate('fixture.session.token123456789'),{userId:owner});
  assert.equal((await privateClient.rpc('app_order_quote_1',{p_order_id:itemA,p_user_id:owner})).error,null);
  assert.equal((await privateClient.rpc('arbitrary_secret_rpc',{})).error,true);assert.equal(paymentCalls,2);
  assert.throws(()=>paymentRpc({backend,expectedProjectRef:backend.projectRef,definition:paymentApp,secretKey:backend.publishableKey}));
  const compiledPayment=paymentPackage(paymentApp,'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  assert.equal(compiledPayment.rewrites.length,4);assert.ok(!/^\s*begin;|commit;\s*$/m.test(compiledPayment.statements[0]));
  const paymentOrigin='https://orders.example.com',paymentManifest={projectId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    applicationOrigin:paymentOrigin,expectedProjectRef:backend.projectRef,backend,definition:paymentApp,
    pages:[{path:'/orders.html',pageId:'orders',language:'en',sections:[{id:'order-view',type:'features',
      applicationDataView:{tableId:'orders',columns:['order_note'],actions:['transact'],pageSize:10}}]}]};
  const oldPaymentEnvironment=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
  try{
    const result=await paymentRoute(new Request(`${paymentOrigin}/api/application?tayarRoute=stripe-order-checkout:orders`,{
      method:'POST',headers:{origin:paymentOrigin,'content-type':'application/json',authorization:'Bearer fixture.session.token123456789'},
      body:JSON.stringify({orderId:itemA,checkoutId:'orders',operationId:request})}),{
      manifest:paymentManifest,route:'stripe-order-checkout:orders',environment:{SUPABASE_SECRET_KEY:privateKey,
        STRIPE_SECRET_KEY:['sk','test','fixture123456789'].join('_')},fetcher:async(resource,init)=>{
        const url=new URL(String(resource));
        if(url.origin===backend.url){
          if(url.pathname==='/auth/v1/user')return Response.json({id:owner,is_anonymous:false,email_confirmed_at:'2026-10-10T00:00:00Z'});
          if(url.pathname.endsWith('app_order_quote_1'))return Response.json({amount:250,currency:'sek'});
          if(url.pathname.endsWith('app_stripe_order_reserve'))return Response.json({orderId:itemA,status:'pending',sessionId:null});
          if(url.pathname.endsWith('app_stripe_order_bind_session'))return Response.json(true);
        }
        assert.equal(url.href,'https://api.stripe.com/v1/checkout/sessions');const form=new URLSearchParams(init.body);
        assert.equal(form.get('line_items[0][price_data][unit_amount]'),'250');
        assert.equal(form.get('success_url'),`${paymentOrigin}/orders.html?checkout=success`);
        return Response.json({id:'cs_test_fixture12345678',object:'checkout.session',url:'https://checkout.stripe.com/c/pay/fixture'});
      }});
    assert.equal(result.status,200);assert.deepEqual(await result.json(),{url:'https://checkout.stripe.com/c/pay/fixture'});
    const paymentState={status:'partially-refunded',currency:'sek',amountDue:250,amountPaid:250,amountRefunded:100};
    assert.deepEqual(parsePaymentStatus(paymentState),paymentState);
    assert.throws(()=>parsePaymentStatus({...paymentState,amountRefunded:251}));
    assert.throws(()=>parsePaymentStatus({...paymentState,providerId:'pi_must_not_leak'}));
    let requestedStatusOwner=owner,statusCalls=0;
    const statusDependencies={manifest:paymentManifest,route:'stripe-order-status:orders',environment:{SUPABASE_SECRET_KEY:privateKey},fetcher:async(resource,init)=>{
      const url=new URL(String(resource));assert.equal(url.origin,backend.url);statusCalls++;
      if(url.pathname==='/auth/v1/user')return Response.json({id:requestedStatusOwner,is_anonymous:false,email_confirmed_at:'2026-10-10T00:00:00Z'});
      assert.equal(url.pathname,'/rest/v1/rpc/app_order_payment_status_1');assert.equal(JSON.parse(init.body).p_user_id,requestedStatusOwner);
      return Response.json(requestedStatusOwner===owner?paymentState:null);
    }};
    const statusRequest=(payload={orderId:itemA})=>new Request(`${paymentOrigin}/api/application?tayarRoute=stripe-order-status:orders`,{
      method:'POST',headers:{origin:paymentOrigin,'content-type':'application/json',authorization:'Bearer fixture.session.token123456789'},body:JSON.stringify(payload)});
    const statusResponse=await paymentRoute(statusRequest(),statusDependencies);assert.equal(statusResponse.status,200);assert.deepEqual(await statusResponse.json(),paymentState);
    requestedStatusOwner=other;assert.equal((await paymentRoute(statusRequest(),statusDependencies)).status,403);
    assert.equal((await paymentRoute(statusRequest({orderId:itemA,status:'paid'}),statusDependencies)).status,400);assert.equal(statusCalls,5);

  }finally{if(oldPaymentEnvironment===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldPaymentEnvironment;}
  const token = `a.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
  let identity = owner, lost = false, calls = 0, balances = new Map([[itemA, 10], [itemB, 8]]); const receipts = new Map();
  globalThis.fetch = async (resourceUrl, init) => {
    const url = new URL(String(resourceUrl)); assert.equal(url.origin, backend.url);
    if (url.pathname === '/auth/v1/token') return Response.json({ access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user: { id: identity, is_anonymous: false } });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: identity, is_anonymous: false });
    assert.equal(url.pathname, '/rest/v1/rpc/app_create_transaction_1'); calls++;
    const args = JSON.parse(init.body); assert.equal(new Headers(init.headers).get('authorization'), `Bearer ${token}`);
    if (receipts.has(args.request_id)) return Response.json(receipts.get(args.request_id));
    if (args.lines.some(line => balances.get(line.itemId) < line.quantity)) return Response.json({ code: 'P0001', message: 'Application transaction exceeds allowed bounds' }, { status: 400 });
    for (const line of args.lines) balances.set(line.itemId, balances.get(line.itemId) - line.quantity);
    const result = { status: 'created', id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }; receipts.set(args.request_id, { ...result, status: 'already-created' });
    if (lost) throw new TypeError('Lost response after commit'); return Response.json(result);
  };
  const runtime = runtimeFor(app, backend, backend.projectRef), storage = new Map();
  const scope = { keyPrefix: 'tayar-app-form:transaction:project:page:data:orders', crypto: webcrypto,
    storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } };
  try {
    await runtime.auth.signIn('test@example.com', 'test-password');
    const binding = { tableId: 'orders', columns: ['order_note'], actions: ['transact'], pageSize: 10 };
    const controller = controllerFor(app, binding, runtime, () => request, scope);
    await controller.transact({ note: 'First' }, [{ itemId: itemA, quantity: 2 }, { itemId: itemB, quantity: 3 }]); assert.deepEqual([...balances.values()], [8, 5]);
    await assert.rejects(controller.transact({ note: 'Too much' }, [{ itemId: itemA, quantity: 9 }]), /allowed bounds/); assert.equal(storage.size, 0);
    lost = true; await assert.rejects(controller.transact({ note: 'Retry' }, [{ itemId: itemA, quantity: 1 }]), /uncertain/); assert.equal(balances.get(itemA), 7);
    assert.doesNotMatch([...storage.values()][0], /First|Retry|itemId|quantity|orders/); controller.dispose(); lost = false;
    const replay = controllerFor(app, binding, runtime, () => request, scope); await replay.transact({ note: 'Retry' }, [{ itemId: itemA, quantity: 1 }]);
    assert.equal(balances.get(itemA), 7); assert.equal(storage.size, 0); identity = other; const beforeWrong = calls;
    await assert.rejects(runtime.createTransaction('orders', { note: 'Wrong user' }, [{ itemId: itemA, quantity: 1 }], request, owner), /identity changed/); assert.equal(calls, beforeWrong); replay.dispose();
  } finally { runtime.dispose(); }
  console.log('PASS generic transactions: strict definitions, permission-safe migrations, isolated SDK, atomic bounds and durable replay');

  if (process.argv.includes('--postgres')) {
    const databaseUrl = process.env.TAYAR_BOOKING_TEST_DATABASE_URL, url = new URL(databaseUrl ?? 'http://invalid');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/tayar_booking_test') throw Error('Isolated local fixture database required.');
    const query = text => new Promise((resolveQuery, reject) => { const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'], { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', error = '';
      child.stdout.on('data', data => output += data); child.stderr.on('data', data => error += data); child.on('error', reject); child.on('close', code => code ? reject(Error(error)) : resolveQuery(output.trim())); child.stdin.end(text); });
    await query('drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;'); await query(sql);
    const asUser = user => `set role authenticated; set request.jwt.claim.sub to '${user}';`;
    await query(`insert into public.app_products(id,owner_id,name) values ('${itemA}','${owner}','A'),('${itemB}','${owner}','B');`);
    await query(`${asUser(owner)} select public.app_adjust_counter_0('${itemA}',10,gen_random_uuid()); select public.app_adjust_counter_0('${itemB}',10,gen_random_uuid());`);
    const created = JSON.parse(await query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"First"}'::jsonb,'[{"itemId":"${itemA}","quantity":2},{"itemId":"${itemB}","quantity":3}]'::jsonb,'${request}');`));
    assert.equal(created.status, 'created'); assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`), '8');
    assert.equal(await query(`select total from public.app_orders where id='${created.id}';`), '10');
    await assert.rejects(query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Forged","total":999}'::jsonb,'[{"itemId":"${itemA}","quantity":1}]'::jsonb,gen_random_uuid());`), /Application transaction unavailable/);
    const replay = JSON.parse(await query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"First"}'::jsonb,'[{"quantity":3,"itemId":"${itemB}"},{"quantity":2,"itemId":"${itemA}"}]'::jsonb,'${request}');`));
    assert.equal(replay.status, 'already-created'); assert.equal(replay.id, created.id); assert.equal(await query('select count(*) from public.app_orders;'), '1'); assert.equal(await query('select count(*) from public.app_order_lines;'), '2');
    const beforeA = await query(`select quantity from public.app_products where id='${itemA}';`), beforeB = await query(`select quantity from public.app_products where id='${itemB}';`);
    await assert.rejects(query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Fail all"}'::jsonb,'[{"itemId":"${itemA}","quantity":1},{"itemId":"${itemB}","quantity":99}]'::jsonb,gen_random_uuid());`), /exceeds allowed bounds/);
    assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`), beforeA); assert.equal(await query(`select quantity from public.app_products where id='${itemB}';`), beforeB);
    const competing = await Promise.allSettled([1, 2].map(n => query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Race ${n}"}'::jsonb,'[{"itemId":"${itemA}","quantity":5}]'::jsonb,gen_random_uuid());`)));
    assert.equal(competing.filter(result => result.status === 'fulfilled').length, 1); assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`), '3');
    await assert.rejects(query(`${asUser(owner)} insert into public.app_order_lines(order_id,product_id,quantity) values ('${created.id}','${itemA}',1);`), /permission denied/);
    const catalogRows = []; const valid = await verify(app, async text => { const rows = JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${text}) x;`)); catalogRows.push(rows); return rows; });
    if (!valid) console.error('Transaction fixture catalog diagnostics:', JSON.stringify(catalogRows)); assert.equal(valid, true, 'Actual transaction functions, ledger and constraints match strict catalog');
    await query('alter table public.app_order_lines drop constraint app_transaction_quantity_1;');
    assert.equal(await verify(app, async text => JSON.parse(await query(`select coalesce(json_agg(x),'[]') from (${text}) x;`))), false);
    console.log('PASS actual PostgreSQL generic transactions: multi-row rollback, deterministic locks, concurrency, replay, line denial and catalog drift');
    await query('drop schema private cascade; drop schema public cascade; create schema public; grant usage on schema public to anon,authenticated,service_role;');
    await query(paymentSql);
    await query(`insert into public.app_products(id,owner_id,name,price_minor) values('${itemA}','${owner}','A',125);`);
    await query(`${asUser(owner)} select public.app_adjust_counter_0('${itemA}',10,gen_random_uuid());`);
    const priced=JSON.parse(await query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Priced"}'::jsonb,'[{"itemId":"${itemA}","quantity":2}]'::jsonb,'${request}');`));
    assert.equal(await query(`select amount from private.app_order_quotes where order_id='${priced.id}';`),'250');
    await query(`update public.app_products set price_minor=999 where id='${itemA}';`);
    assert.equal(await query(`select amount from private.app_order_quotes where order_id='${priced.id}';`),'250','later catalog price changes preserve the order quote');
    for(const role of ['anon','authenticated','service_role'])await assert.rejects(query(`set role ${role}; select * from private.app_order_quotes;`),/permission denied/);
    await query(`update public.app_products set price_minor=1.5 where id='${itemA}';`);
    await assert.rejects(query(`${asUser(owner)} select public.app_create_transaction_1('{"note":"Invalid price"}'::jsonb,'[{"itemId":"${itemA}","quantity":1}]'::jsonb,gen_random_uuid());`),/Invalid order price/);
    assert.equal(await query(`select quantity from public.app_products where id='${itemA}';`),'8','invalid price must roll back inventory');
    await query(stripeSchema('dddddddd-dddd-4ddd-8ddd-dddddddddddd'));await query(accessSql);
    assert.equal(await query(`set role service_role;select public.app_order_quote_1('${priced.id}','${owner}')->>'amount';`),'250');
    assert.equal(await query(`set role service_role;select public.app_order_quote_1('${priced.id}','${other}') is null;`),'t');
    assert.equal(await query(`set role service_role;select public.app_order_payment_status_1('${priced.id}','${owner}')->>'status';`),'unpaid');
    assert.equal(await query(`set role service_role;select public.app_order_payment_status_1('${priced.id}','${other}') is null;`),'t');
    await assert.rejects(query(`set role authenticated;select public.app_order_payment_status_1('${priced.id}','${owner}');`),/permission denied/);

    await assert.rejects(query(`${asUser(owner)} update public.app_products set price_minor=500 where id='${itemA}';`),/Price administration role required/);
    await query(`update public.app_products set price_minor=125 where id='${itemA}';`);
    await query(`${asUser(owner)} select public.app_adjust_counter_0('${itemA}',1,gen_random_uuid());`);
    assert.equal(await query(`set role service_role;select public.app_order_refund_authorize_1('${priced.id}','${owner}',100) is null;`),'t');
    console.log('PASS PostgreSQL payment quotes: atomic price capture, immutable totals, private grants and invalid-price rollback');
  }
} finally { globalThis.fetch = originalFetch; await rm(dir, { recursive: true, force: true }); }
