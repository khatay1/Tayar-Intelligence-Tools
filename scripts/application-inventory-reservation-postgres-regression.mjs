import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-stock-holds-'));
const require = createRequire(import.meta.url);
const owner = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
const item = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherItem = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const location = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const reservation = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const repeat = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const concurrent1 = '11111111-2222-4333-8444-555555555555';
const concurrent2 = '11111111-3333-4333-8444-555555555555';

try {
  const entry = join(dir, 'entry.ts'), outfile = join(dir, 'runtime.cjs');
  await writeFile(entry, [
    "export { compileApplicationInventoryReservationSchema } from " + JSON.stringify(resolve('src/modules/website-builder/core/application-inventory-reservation-sql')) + ';',
    "export { verifyOwnedStockReservationCatalog } from " + JSON.stringify(resolve('server/website-owned-stock-reservation-catalog')) + ';',
    "export { verifyOwnedStockReservationInstallation } from " + JSON.stringify(resolve('server/website-owned-stock-reservation-installation')) + ';',
    "export { createApplicationStockReservationRpc, ApplicationStockRpcRejected } from " + JSON.stringify(resolve('src/modules/website-builder/core/application-stock-reservation-rpc')) + ';',
    "export { createOwnedApplicationDataRuntime } from " + JSON.stringify(resolve('src/modules/website-builder/core/application-data-runtime')) + ';',
    "export { compileInitialApplicationSchema } from " + JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql')) + ';',
    "export { verifyOwnedStockReservationInstallationFromCustody } from " + JSON.stringify(resolve('server/website-owned-stock-reservation-installation')) + ';',
    "export { createWebsiteByoPublishRuntimePolicy } from " + JSON.stringify(resolve('server/website-byo-publish-runtime-policy')) + ';',
    "export { verifyOwnedSupabaseCatalogSecurity } from " + JSON.stringify(resolve('server/website-owned-supabase-catalog')) + ';',
  ].join('\n'));
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile });
  const { compileApplicationInventoryReservationSchema: reservations, verifyOwnedStockReservationCatalog: verifyCatalog, verifyOwnedStockReservationInstallation: verifyInstallation, createApplicationStockReservationRpc: stockRpc,
    ApplicationStockRpcRejected: StockRpcRejected, createOwnedApplicationDataRuntime: ownedRuntime,
    compileInitialApplicationSchema: initialSchema, verifyOwnedStockReservationInstallationFromCustody: verifyCustody,
    createWebsiteByoPublishRuntimePolicy: publishPolicy, verifyOwnedSupabaseCatalogSecurity: verifyFullCatalog } = require(outfile);
  const app = {
    version: 1, auth: { enabled: true, signUpEnabled: false, emailVerificationRequired: true },
    pageAccess: [], roles: [], tables: [{
      id: 'products', key: 'products', name: 'Products',
      fields: [{ id: 'quantity', key: 'quantity', name: 'Stock', type: 'number', required: true, defaultValue: 0 }],
      permissions: [{ operation: 'read', access: 'owner' }, { operation: 'update', access: 'owner' }],
      counter: { fieldId: 'quantity', minimum: 0, integer: true },
    }],
  };
  const sql = reservations(app, 'products').join('\n');
  const savedStockApp = structuredClone(app); savedStockApp.tables[0].stockReservations = true;
  assert.match(sql, /for update/);
  assert.match(sql, /app_stock_reservation_floor_0/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /app_adjust_counter_0/);
  assert.match(sql, /app_stock_available_0/);
  assert.match(sql, /returns numeric language plpgsql security definer/);
  assert.throws(() => reservations({ ...app, auth: { ...app.auth, enabled: false } }, 'products'));
  assert.throws(() => reservations(app, 'missing'));
  assert.throws(() => reservations({ ...app, tables: app.tables.map(table => ({ ...table, counter: undefined })) }, 'products'));
  if (!process.argv.includes('--postgres')) {
    console.log('PASS static inventory reservation SQL contract (no database claims)');
    process.exit(0);
  }

  const databaseUrl = process.env.TAYAR_INVENTORY_RESERVATION_TEST_DATABASE_URL;
  const url = new URL(databaseUrl ?? 'https://invalid.invalid');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1'].includes(url.hostname)
    || url.pathname !== '/tayar_inventory_reservation_test') throw Error('Dedicated local PostgreSQL fixture required.');
  const query = statement => new Promise((resolveQuery, reject) => {
    const child = spawn('psql', [databaseUrl, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t'],
      { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject);
    child.on('close', status => status === 0 ? resolveQuery(stdout.trim()) : reject(Error(stderr)));
    child.stdin.end(statement);
  });
  const auth = `create schema auth;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    insert into auth.users(id) values ('${owner}'),('${foreign}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    grant usage on schema auth to authenticated;`;
  await query([auth, ...initialSchema(savedStockApp)].join('\n'));
  await query(`insert into public.app_products(id,owner_id) values ('${item}','${owner}'),('${otherItem}','${owner}');`);
  const login = who => `set role authenticated;
    select set_config('request.jwt.claim.sub','${who}',false),
      set_config('request.jwt.claims','{"is_anonymous":false}',false);`;
  const reserve = (thing, id, n, who=owner) => query(`${login(who)}
    select public.app_stock_reserve_0('${thing}','${location}','${id}',${n});`);
  const available = (thing, who = owner) => query(`${login(who)}
    select public.app_stock_available_0('${thing}');`).then(text =>
      text.split('\n').at(-1));
  const finalize = (id, action, who=owner) => query(`${login(who)}
    select public.app_stock_finalize_0('${id}','${action}');`);
  await query(`${login(owner)} select public.app_adjust_counter_0('${item}',10,gen_random_uuid());
    select public.app_adjust_counter_0('${otherItem}',10,gen_random_uuid());`);
  assert.equal(await available(item), '10', 'Owner can read initial available stock');
  await assert.rejects(available(item,foreign), /availability unavailable/,
    'Foreign owners cannot read merchant inventory');
  await assert.rejects(available(otherItem,foreign), /availability unavailable/);
  assert.match(await reserve(item,reservation,7),/reserved$/);
  assert.equal(await available(item), '3', 'Available stock subtracts active reservations');
  assert.match(await reserve(item,reservation,7),/already-reserved$/);
  await assert.rejects(reserve(item,reservation,8),/identity mismatch/);
  await assert.rejects(reserve(item,repeat,4),/exceeds availability/);
  await assert.rejects(reserve(item,repeat,1,foreign),/unavailable/);
  await assert.rejects(query(`${login(owner)}
    select public.app_adjust_counter_0('${item}',-4,gen_random_uuid());`),/cross reservations/);
  const results = await Promise.allSettled([concurrent1,concurrent2].map(id => reserve(otherItem,id,7)));
  assert.equal(results.filter(value => value.status === 'fulfilled').length,1,'competing reservations cannot oversell');
  assert.match(await finalize(reservation,'fulfill'),/fulfilled$/);
  assert.match(await finalize(reservation,'fulfill'),/already-fulfilled$/);
  await assert.rejects(finalize(reservation,'release'),/already settled/);
  assert.equal(await query(`select quantity from public.app_products where id='${item}';`),'3');
  assert.match(await reserve(item,repeat,2),/reserved$/);
  await assert.rejects(query(`${login(owner)}
    select public.app_adjust_counter_0('${item}',-2,gen_random_uuid());`),/cross reservations/);
  assert.match(await finalize(repeat,'release'),/released$/);
  assert.equal(await query(`select quantity from public.app_products where id='${item}';`),'3');
  await assert.rejects(query(`${login(owner)}
    update private.app_stock_reservations_0 set status='fulfilled';`),/permission denied/);
  await assert.rejects(query(`set role anon;
    select public.app_stock_reserve_0('${item}','${location}',gen_random_uuid(),1);`),/permission denied/);
  assert.equal(await query(`select count(*) from private.app_stock_reservations_0
    where actor_id='${owner}' and item_id='${item}';`),'2');
  // An expired hold must never be fulfilled, must not be renewed by
  // idempotent replay, and must release availability without any cron worker.
  const expiredId = 'aaaa0000-1111-4111-8111-111111111111';
  const newId = 'aaaa0000-2222-4222-8222-222222222222';
  const floorExpiryId = 'aaaa0000-3333-4333-8333-333333333333';
  assert.match(await reserve(item,expiredId,3),/reserved$/);
  assert.equal(await query(`select (expires_at > statement_timestamp())::text from private.app_stock_reservations_0
    where reservation_id='${expiredId}';`),'true','New reservation receives a server-side future expiry');
  await query(`update private.app_stock_reservations_0
    set expires_at = statement_timestamp() - interval '1 second'
    where reservation_id = '${expiredId}';`);
  assert.equal(await available(item), '3',
    'Read-only availability excludes expired stock receipts before lazy state cleanup');
  assert.match(await finalize(expiredId,'fulfill'),/already-expired$/,
    'The server cannot fulfill a reservation after its deadline');
  assert.match(await reserve(item,expiredId,3),/already-expired$/,
    'An expired idempotency key is terminal and cannot reset TTL');
  assert.equal(await query(`select quantity from public.app_products where id='${item}';`),'3',
    'Expired fulfillment never removes stock');
  assert.match(await reserve(item,newId,3),/reserved$/,
    'Expired holds free the same-item quantity atomically');
  assert.match(await finalize(newId,'release'),/released$/);
  assert.match(await reserve(item,floorExpiryId,3),/reserved$/);
  await query(`update private.app_stock_reservations_0
    set expires_at = statement_timestamp() - interval '1 second'
    where reservation_id = '${floorExpiryId}';`);
  await query(`${login(owner)} select public.app_adjust_counter_0('${item}',-2,gen_random_uuid());`);
  assert.equal(await query(`select quantity from public.app_products where id='${item}';`),'1',
    'Legacy stock adjustments ignore expired holds even before lazy cleanup');
  assert.match(await reserve(item,'aaaa0000-4444-4444-8444-444444444444',1),/reserved$/,
    'Next reservation safely cleans up the expired receipt');
  await assert.rejects(query(`set role anon;
    select public.app_stock_available_0('${item}');`), /permission denied/,
    'Anonymous callers cannot inspect merchant stock');
  let proofRows = [];
  const verify = () => verifyCatalog(app, 'products', async statement => {
    const rows = JSON.parse(await query(`select coalesce(json_agg(row),'[]') from (${statement}) row;`));
    proofRows.push(rows);
    return rows;
  });
  const verified = await verify();
  if (!verified) {
    const manifest = [...sql.matchAll(/create function (private|public)\.(app_stock_[a-z0-9_]+)\(([^)]*)\) returns (text|trigger) language (plpgsql|sql) security (definer|invoker) set search_path = '' as \$(stock_[a-z]+)\$([\s\S]*?)\$\7\$;/g)]
      .map(x => ({ key: x[1] + '.' + x[2], args: x[3], source: x[8], result: x[4], lang: x[5], definer: x[6] === 'definer' }));
    console.error('Stock proof diagnostics:', JSON.stringify({ manifest: manifest.map(x => x.key), queries: proofRows.map((rows,index) => ({
      index, rows: rows.map(row => index === 0 ? {
        key: row.schema_name + '.' + row.function_name, args:row.arguments, result:row.result, lang:row.language,
        definer:row.security_definer, volatile:row.volatility, owner:row.owner_name, config:row.configuration,
        anon:row.anon_execute, authenticated:row.authenticated_execute,
        matchSource:manifest.find(x => x.key === row.schema_name + '.' + row.function_name)?.source === row.source,
        sourceLength:row.source?.length, expectedLength:manifest.find(x => x.key === row.schema_name + '.' + row.function_name)?.source?.length,
        sourceStart:row.source?.slice(0,90), expectedStart:manifest.find(x => x.key === row.schema_name + '.' + row.function_name)?.source?.slice(0,90),
      } : row),
    })) }));
  }
  assert.equal(verified, true, 'Exact stock functions, private receipt schema and trigger must be verified');
  // Exercise the real read-only Supabase Management API binding against this
  // isolated PostgreSQL catalog. No customer token, account or host is used.
  const connectionId = '99999999-9999-4999-8999-999999999999';
  const projectId = '88888888-8888-4888-8888-888888888888';
  const projectRef = 'abcdefghijklmnopqrst';
  const connection = {
    id: connectionId, ownerId: owner, projectId, provider: 'supabase', environment: 'preview',
    accountId: 'account-owner', targetId: projectRef, permissions: ['database:read'],
    status: 'ready', version: 4, operationId: null,
    verifiedAt: '2026-10-16T12:00:00.000Z', updatedAt: '2026-10-16T12:00:00.000Z',
  };
  let currentConnection = structuredClone(connection);
  let allowed = true, networkCalls = 0, connectionReads = 0;
  const attestation = {
    ownerId: owner, projectId, environment: 'preview', connectionId, connectionVersion: 4,
    definition: app, itemTableId: 'products', accessToken: 'fixture-only-no-customer-credentials',
    async isCurrent() { return allowed; },
    async readConnection() { connectionReads++; return structuredClone(currentConnection); },
    async fetcher(url, init) {
      networkCalls++;
      assert.equal(url, 'https://api.supabase.com/v1/projects/' + projectRef + '/database/query/read-only');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.equal(init.cache, 'no-store');
      assert.equal(init.headers.Authorization, 'Bearer fixture-only-no-customer-credentials');
      const statement = JSON.parse(init.body).query;
      assert.match(statement, /^select /i);
      const rows = JSON.parse(await query(`select coalesce(json_agg(row),'[]') from (${statement}) row;`));
      return Response.json(rows, { status: 201 });
    },
  };
  assert.equal(await verifyInstallation(attestation), true,
    'The live catalog must be attested only via exact owner-owned read-only Supabase project');
  assert.equal(networkCalls, 4, 'Catalog evidence is read-only and bounded to four queries');
  const noNetwork = async (overrides, reason) => {
    const before = networkCalls;
    assert.equal(await verifyInstallation({ ...attestation, ...overrides }), false, reason);
    assert.equal(networkCalls, before, 'Invalid scope must fail before network traffic');
  };
  await noNetwork({ ownerId: foreign }, 'An unrelated owner cannot reuse a connection');
  await noNetwork({ projectId: foreign }, 'A different project cannot reuse connection');
  await noNetwork({ connectionId: foreign }, 'A different connection ID is unavailable');
  await noNetwork({ connectionVersion: 3 }, 'Old connection version is unavailable');
  await noNetwork({ environment: 'production' }, 'Preview proof cannot cross into Production');
  await noNetwork({ itemTableId: 'missing' }, 'Unknown item table blocks evidence');
  await noNetwork({ accessToken: 'token\nmalformed' }, 'Invalid custody token must not be used');
  allowed = false;
  await noNetwork({}, 'Stale source scope cannot reuse catalog evidence');
  allowed = true;
  for (const change of [
    { ownerId: foreign }, { projectId: foreign }, { provider: 'github' },
    { environment: 'production' }, { version: 5 }, { status: 'setup-incomplete' },
    { permissions: [] }, { targetId: null }, { targetId: 'wrong-host' },
  ]) {
    currentConnection = { ...connection, ...change };
    await noNetwork({}, 'Only exact owner-bound ready Supabase connections may supply evidence');
  }
  currentConnection = structuredClone(connection);
  let reads = 0;
  assert.equal(await verifyInstallation({ ...attestation, async readConnection() {
    reads++;
    return reads === 1 ? structuredClone(connection) : { ...connection, version: 5 };
  } }), false, 'Connection rotation during catalog read invalidates attestation');
  currentConnection = structuredClone(connection);
  assert.equal(await verifyInstallation(attestation), true, 'Current connection restores attestation');

  const catalogQuery = async statement => JSON.parse(await query(`select coalesce(json_agg(row),'[]') from (${statement}) row;`));
  assert.equal(await verifyFullCatalog(savedStockApp,catalogQuery),true,'The standard runtime setup catalog gate verifies the opted-in stock installation');
  const custody = {version:1,accountId:'account-owner',organizationId:'customer-org',organizationSlug:'customer-org',projectRef,environment:'preview',
    accessExpiresAt:new Date(Date.now()+3600_000).toISOString(),custodyExpiresAt:new Date(Date.now()+3600_000).toISOString(),
    grant:{accessToken:attestation.accessToken,refreshToken:'fixture-refresh-token-not-a-customer-secret'}};
  let custodyReads=0;
  const custodyClient={async rpc(name,args){
    custodyReads++;assert.equal(name,'website_read_supabase_oauth_custody');
    assert.deepEqual(args,{p_connection_id:connectionId,p_project_id:projectId,p_owner_id:owner,p_expected_connection_version:4});
    return{data:structuredClone(custody),error:null};
  }};
  const custodyFetch=async(url,init)=>{
    assert.equal(init.headers.Authorization,`Bearer ${attestation.accessToken}`);
    if(String(url).endsWith('/database/query/read-only'))return attestation.fetcher(url,init);
    if(url==='https://api.supabase.com/v1/profile')return Response.json({gotrue_id:'account-owner'});
    if(url===`https://api.supabase.com/v1/projects/${projectRef}`)return Response.json({ref:projectRef,organization_id:'customer-org',organization_slug:'customer-org',status:'ACTIVE_HEALTHY'});
    if(url==='https://api.supabase.com/v1/organizations/customer-org/members')return Response.json([{user_id:'account-owner',role_name:'Owner'}]);
    throw Error('Unexpected owned stock provider path');
  };
  const vercelId='33333333-3333-4333-8333-333333333333';
  const vercelConnection={...connection,id:vercelId,provider:'vercel',accountId:'customer-vercel',targetId:'prj_stockcustomer1',permissions:['read']};
  const binding={ownerId:owner,projectId,environment:'preview',bindingVersion:1,supabaseConnectionId:connectionId,supabaseConnectionVersion:4,
    vercelConnectionId:vercelId,vercelConnectionVersion:4,applicationOrigin:'https://customer-stock.example',
    backend:{url:`https://${projectRef}.supabase.co`,projectRef,publishableKey:'sb_publishable_stock_fixture'}};
  const stockReader={readConnection:async id=>structuredClone(id===connectionId?currentConnection:vercelConnection),readOwnedRuntimeBinding:async()=>structuredClone(binding)};
  const custodyInput={client:custodyClient,reader:stockReader,ownerId:owner,projectId,environment:'preview',connectionId,connectionVersion:4,
    definition:savedStockApp,itemTableId:'products',platformOrganizationId:'platform-org',isCurrent:async()=>allowed,fetcher:custodyFetch};
  assert.equal(await verifyCustody(custodyInput),true,'Exact leased custody and real catalog can attest a saved stock requirement');
  const readsBeforeForeign=custodyReads;
  assert.equal(await verifyCustody({...custodyInput,ownerId:foreign}),false);
  assert.equal(custodyReads,readsBeforeForeign,'Foreign scope is rejected before reading any credential');
  const stockCapabilities={definition:savedStockApp,pageIds:['home'],needs:{auth:true,database:true,privatePages:true,forms:false,integrations:false,cms:false},integrationProviders:[],stripeCheckouts:[],blockers:[]};
  assert.equal(await publishPolicy(stockReader).verifyRuntime(binding,connection,vercelConnection,stockCapabilities),false,
    'A stock flag and persisted binding without a live installation verifier cannot permit publishing');
  const stockPolicy=publishPolicy(stockReader,{client:custodyClient,platformOrganizationId:'platform-org',fetcher:custodyFetch});
  const canPublishStock=()=>stockPolicy.verifyRuntime(binding,connection,vercelConnection,stockCapabilities);
  assert.equal(await canPublishStock(),true,'The deployed host policy requires fresh real stock SQL evidence');

  // Exercise the owner-facing client contract against the ACTUAL isolated
  // PostgreSQL RPCs. Only this fixture translates psql rows to Supabase-style
  // typed RPC results; no generated runtime, token or live service is touched.
  const client = stockRpc(app, 'products', { async rpc(name, args) {
    const values = {
      app_stock_available_0: () => [args.item_id],
      app_stock_reserve_0: () => [args.item_id, args.location_id, args.reservation_id, args.amount],
      app_stock_finalize_0: () => [args.reservation_id, args.decision],
    };
    if (!Object.hasOwn(values, name)) return { data: null, error: { message: 'unsupported fixture RPC' } };
    const params = values[name]().map(value => typeof value === 'number' ? String(value) : "'" + value + "'").join(',');
    try {
      const output = await query(`${login(owner)} select public.${name}(${params});`);
      const actual = output.split('\n').at(-1);
      return { data: name === 'app_stock_available_0' ? Number(actual) : actual, error: null };
    } catch { return { data: null, error: { message: 'database-internal-detail-must-not-escape' } }; }
  }});
  assert.equal(await client.available(item), 0, 'Exposed availability reflects a real held unit');
  const lastHold = 'aaaa0000-4444-4444-8444-444444444444';
  assert.equal(await client.settle(lastHold, 'release'), 'released');
  assert.equal(await client.settle(lastHold, 'release'), 'already-released');
  assert.equal(await client.available(item), 1);
  const receiptFromClient = 'aaaa0000-5555-4555-8555-555555555555';
  assert.equal(await client.reserve(item,location,receiptFromClient,1), 'reserved');
  assert.equal(await client.reserve(item,location,receiptFromClient,1), 'already-reserved');
  assert.equal(await client.available(item), 0);
  assert.equal(await client.settle(receiptFromClient,'fulfill'), 'fulfilled');
  assert.equal(await client.settle(receiptFromClient,'fulfill'), 'already-fulfilled');
  assert.equal(await client.available(item), 0);
  await assert.rejects(client.settle(receiptFromClient,'release'), StockRpcRejected);
  await assert.rejects(client.available(foreign + 'not-a-uuid'), StockRpcRejected);
  await assert.rejects(client.reserve(item,location,'bad-receipt',1), StockRpcRejected);
  await assert.rejects(client.reserve(item,location,receiptFromClient,'1'), StockRpcRejected);
  await assert.rejects(client.reserve(item,location,receiptFromClient,0), StockRpcRejected);
  await assert.rejects(client.reserve(item,location,receiptFromClient,1.5), StockRpcRejected);
  await assert.rejects(client.reserve(item,location,receiptFromClient,Infinity), StockRpcRejected);
  await assert.rejects(client.settle(receiptFromClient,'erase'), StockRpcRejected);
  assert.throws(() => stockRpc(app,'missing',{ rpc:async () => ({data:0,error:null}) }), StockRpcRejected);
  const broken = stockRpc(app,'products',{ rpc:async () =>
    ({ data:null,error: { message:'provider-secret-not-visible' } }) });
  await assert.rejects(broken.available(item), error =>
    error instanceof StockRpcRejected && !String(error).includes('provider-secret-not-visible'));

  // Real owned runtime -> actual Supabase SDK -> simulated HTTP transport ->
  // real isolated PostgreSQL. Only HTTP/Auth are fixtures; stock operations,
  // row locks, expiry and receipts are executed by the database, not emulated.
  const sdkItem = 'aaaa0000-6666-4666-8666-666666666666';
  const sdkReceipt = 'aaaa0000-7777-4777-8777-777777777777';
  await query(`insert into public.app_products(id,owner_id) values ('${sdkItem}','${owner}');
    ${login(owner)} select public.app_adjust_counter_0('${sdkItem}',2,gen_random_uuid());`);
  const backend = { url: 'https://abcdefghijklmnopqrst.supabase.co', projectRef: 'abcdefghijklmnopqrst', publishableKey: 'sb_publishable_stock_test' };
  const tokens = new Map([owner, foreign].map(id => [id,
    `a.${Buffer.from(JSON.stringify({ sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.signature`]));
  const oldFetch = globalThis.fetch;
  let dropAfterCommit = false, switchAfterCommit = false, runtime;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, backend.url, 'The SDK may only address the dedicated test customer host');
    if (url.pathname === '/auth/v1/token') {
      const actor = JSON.parse(init.body).email === 'foreign@example.invalid' ? foreign : owner;
      return Response.json({ access_token:tokens.get(actor),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:{id:actor,is_anonymous:false} });
    }
    const authorization = new Headers(init.headers).get('Authorization');
    const actor = [...tokens].find(([,token]) => authorization === `Bearer ${token}`)?.[0];
    assert.ok(actor, 'Every RPC and identity check must carry a pinned authenticated actor');
    if (url.pathname === '/auth/v1/user') return Response.json({ id:actor,is_anonymous:false });
    assert.equal(new Headers(init.headers).get('apikey'), backend.publishableKey);
    if (url.pathname === '/rest/v1/app_products') {
      assert.equal(init.method,'GET');
      const rows=JSON.parse((await query(`${login(actor)} select coalesce(json_agg(r),'[]') from (select id,quantity from public.app_products where id='${sdkItem}') r;`)).split('\n').at(-1));
      return Response.json(rows);
    }
    assert.equal(init.method, 'POST');
    const args = JSON.parse(init.body), name = url.pathname.split('/').at(-1);
    const argumentKeys = { app_stock_available_0:['item_id'], app_stock_reserve_0:['item_id','location_id','reservation_id','amount'], app_stock_finalize_0:['reservation_id','decision'] };
    assert.ok(Object.hasOwn(argumentKeys,name));
    assert.deepEqual(Object.keys(args).sort(), [...argumentKeys[name]].sort());
    const parameters = argumentKeys[name].map(key => typeof args[key] === 'number' ? String(args[key]) : "'"+String(args[key]).replace(/'/g,"''")+"'").join(',');
    let result;
    try { result = (await query(`${login(actor)} select public.${name}(${parameters});`)).split('\n').at(-1); }
    catch { return Response.json({ code:'P0001',message:'private-database-detail' },{status:400}); }
    if (switchAfterCommit) { switchAfterCommit = false; await runtime.auth.signIn('foreign@example.invalid','fixture-password'); }
    if (dropAfterCommit) { dropAfterCommit = false; return Response.json({message:'response-lost-after-commit'},{status:503}); }
    return Response.json(name === 'app_stock_available_0' ? Number(result) : result);
  };
  try {
    runtime = ownedRuntime(savedStockApp,backend,backend.projectRef);
    await runtime.auth.signIn('owner@example.invalid','fixture-password');
    const stock = runtime.stockReservations('products',owner);
    assert.equal(await stock.available(sdkItem),2);
    dropAfterCommit = true;
    await assert.rejects(stock.reserve(sdkItem,location,sdkReceipt,1),StockRpcRejected);
    assert.equal(await stock.reserve(sdkItem,location,sdkReceipt,1),'already-reserved','Lost response retry must use the original receipt');
    assert.equal(await stock.available(sdkItem),1);
    const competing = ['aaaa0000-8888-4888-8888-888888888888','aaaa0000-9999-4999-8999-999999999999'];
    const outcomes = await Promise.allSettled(competing.map(id => stock.reserve(sdkItem,location,id,1)));
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length,1,'Concurrent real SDK calls cannot oversell the last unit');
    assert.equal(await stock.available(sdkItem),0);
    assert.equal(await stock.settle(competing[outcomes.findIndex(result => result.status === 'fulfilled')],'release'),'released');
    switchAfterCommit = true;
    await assert.rejects(stock.settle(sdkReceipt,'fulfill'),StockRpcRejected,'An in-flight account switch hides the committed result');
    await assert.rejects(runtime.stockReservations('products',foreign).available(sdkItem),StockRpcRejected,'Real database rejects a correctly authenticated foreign owner');
    await runtime.auth.signIn('owner@example.invalid','fixture-password');
    assert.equal(await stock.settle(sdkReceipt,'fulfill'),'already-fulfilled');
    assert.equal(await stock.available(sdkItem),1,'Reconciliation cannot decrement stock twice');
    const expired = 'aaaa0000-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    assert.equal(await stock.reserve(sdkItem,location,expired,1),'reserved');
    await query(`update private.app_stock_reservations_0 set expires_at=statement_timestamp()-interval '1 second' where reservation_id='${expired}';`);
    assert.equal(await stock.settle(expired,'fulfill'),'already-expired');
    assert.equal(await stock.available(sdkItem),1);

    // Run the actual browser component and SDK against that same PostgreSQL
    // database. Only the provider HTTP/Auth transport is simulated locally.
    const fixtureSource=`import {mountApplicationDataView} from './src/modules/website-builder/browser/application-data-view';
      import {createOwnedApplicationDataRuntime} from './src/modules/website-builder/core/application-data-runtime';
      const nativeFetch=globalThis.fetch;
      globalThis.fetch=(input,init={})=>nativeFetch('/provider',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:String(input),method:init.method??'GET',headers:Object.fromEntries(new Headers(init.headers)),body:init.body})});
      const wait=async predicate=>{for(let i=0;i<400;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('Stock UI timed out');};
      const runtime=createOwnedApplicationDataRuntime(${JSON.stringify(savedStockApp)},${JSON.stringify(backend)},${JSON.stringify(projectRef)});
      let stop;try{await runtime.auth.signIn('owner@example.invalid','fixture-password');
        const host=document.getElementById('stock');
        stop=mountApplicationDataView(host,${JSON.stringify(savedStockApp)},{tableId:'products',columns:['quantity'],actions:['stock-availability'],pageSize:10},runtime,'en',{projectId:${JSON.stringify(projectId)},projectRef:${JSON.stringify(projectRef)},pageId:'stock',sectionId:'availability'});
        const button=()=>[...host.shadowRoot.querySelectorAll('button')].find(b=>b.textContent==='Available stock'&&!b.disabled);
        await wait(button);button().click();
        await wait(()=>host.shadowRoot.querySelector('[role=status]').textContent.includes('Available: 1.'));
        await nativeFetch('/result',{method:'POST',body:'PASS browser UI -> saved opt-in -> SDK -> PostgreSQL availability'});
      }catch(error){await nativeFetch('/result',{method:'POST',body:'FAIL '+error.stack});}finally{stop?.();runtime.dispose();}`;
    const built=await build({stdin:{contents:fixtureSource,resolveDir:process.cwd(),sourcefile:'stock-database-browser.ts'},bundle:true,write:false,platform:'browser',format:'iife',target:'es2020',minify:true});
    const providerFetch=globalThis.fetch;
    let report, timer, browser, browserLog='';
    const outcome=new Promise((resolveResult,reject)=>{report=resolveResult;timer=setTimeout(()=>reject(Error('Stock browser/database proof timed out: '+browserLog.slice(-1000))),15000);});
    const server=createServer(async(request,response)=>{
      try{
        if(request.url==='/'){response.setHeader('content-type','text/html');response.end('<!doctype html><html><body><div id="stock"></div><script src="/fixture.js"></script></body></html>');return;}
        if(request.url==='/fixture.js'){response.setHeader('content-type','application/javascript');response.end(built.outputFiles[0].text);return;}
        let body='';for await(const chunk of request)body+=chunk;
        if(request.url==='/result'){report(body);response.end('ok');return;}
        if(request.url==='/provider'){
          const call=JSON.parse(body),result=await providerFetch(call.url,{method:call.method,headers:call.headers,body:call.body});
          response.writeHead(result.status,{'content-type':result.headers.get('content-type')??'application/json'});response.end(await result.text());return;
        }
        response.writeHead(404);response.end();
      }catch(error){response.writeHead(500);response.end(String(error));}
    });
    try{
      await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
      const chrome=process.env.CHROME_BIN??['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(name=>spawnSync('which',[name],{encoding:'utf8'})).find(result=>result.status===0)?.stdout.trim();
      assert.ok(chrome,'Chromium is required for actual stock UI/database evidence');
      browser=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--no-proxy-server',`--user-data-dir=${join(dir,'stock-chrome')}`,`http://127.0.0.1:${server.address().port}/`],{stdio:['ignore','ignore','pipe'],detached:process.platform!=='win32'});
      browser.stderr.on('data',chunk=>browserLog+=chunk);
      browser.once('error',error=>report('FAIL '+String(error)));
      browser.once('exit',code=>report('FAIL browser exited before stock result '+code));
      const result=await outcome;assert.match(result,/^PASS browser UI/);console.log(result);
    }finally{
      clearTimeout(timer);
      if(browser?.pid){
        const exited=browser.exitCode===null&&browser.signalCode===null?new Promise(resolveExit=>browser.once('exit',resolveExit)):Promise.resolve();
        if(process.platform!=='win32'){try{process.kill(-browser.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}}
        else spawnSync('taskkill',['/pid',String(browser.pid),'/t','/f'],{stdio:'ignore'});
        await exited;
      }
      server.closeAllConnections();await new Promise(resolveClose=>server.close(resolveClose));
    }
  } finally { runtime?.dispose(); globalThis.fetch = oldFetch; }

  await query('revoke execute on function public.app_stock_reserve_0(uuid,uuid,uuid,numeric) from authenticated;');
  assert.equal(await verify(), false, 'Permission drift must block publication');
  assert.equal(await verifyInstallation(attestation), false, 'Read-only installation check refuses grant drift');
  assert.equal(await canPublishStock(),false,'The actual publish policy refuses stock grant drift despite an unchanged saved binding');
  assert.equal(await verifyFullCatalog(savedStockApp,catalogQuery),false,'Normal runtime setup also refuses stock grant drift');
  await query('grant execute on function public.app_stock_reserve_0(uuid,uuid,uuid,numeric) to authenticated;');
  assert.equal(await verify(), true, 'Restored exact grants allow proof');
  await query('revoke execute on function public.app_stock_available_0(uuid) from authenticated;');
  assert.equal(await verify(), false, 'Stock availability permission drift blocks catalog attestation');
  await query('grant execute on function public.app_stock_available_0(uuid) to authenticated;');
  assert.equal(await verify(), true, 'Availability grants restored to exact verified catalog');
  await query('alter table public.app_products disable trigger app_stock_reservation_floor_0;');
  assert.equal(await verify(), false, 'Disabled reservation floor prevents proof');
  assert.equal(await verifyInstallation(attestation), false, 'Read-only installation check refuses disabled floor trigger');
    console.log('PASS actual PostgreSQL stock reservation: auth, rollback, concurrent holds, immutable receipts, floor trigger and idempotent fulfillment');
} finally {
  await rm(dir, { recursive: true, force: true, maxRetries:5, retryDelay:100 });
}
