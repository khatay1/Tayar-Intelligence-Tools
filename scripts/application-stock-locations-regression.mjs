import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-stock-locations-'));
try {
  const entry = join(dir, 'entry.ts'), outfile = join(dir, 'runtime.cjs');
  const exports = {
    'src/modules/website-builder/core/application-validation': ['validateApplicationDefinition'],
    'src/modules/website-builder/core/application-schema-sql': ['compileInitialApplicationSchema','compileAdditiveApplicationMigration'],
    'src/modules/website-builder/core/editor-generated-application': ['prepareGeneratedApplication'],
    'src/modules/website-builder/core/application-data-view': ['compileApplicationDataView'],
    'src/modules/website-builder/core/application-data-view-controller': ['createApplicationDataViewController'],
    'src/modules/website-builder/core/application-stock-reservation-rpc': ['createApplicationStockReservationRpc'],
    'src/modules/website-builder/core/editor-application-repair-safety': ['applicationRepairSafetyIssues'],
    'src/modules/website-builder/core/defaults': ['createSection'],
    'server/website-owned-stock-reservation-catalog': ['verifyOwnedStockReservationCatalog'],
    'server/website-owned-supabase-catalog': ['verifyOwnedSupabaseCatalogSecurity'],
  };
  await writeFile(entry,Object.entries(exports).map(([path,names])=>`export {${names.join(',')}} from ${JSON.stringify(resolve(path))};`).join('\n'));
  await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'cjs'});
  const {validateApplicationDefinition:issues,compileInitialApplicationSchema:compile,
    compileAdditiveApplicationMigration:migrate,prepareGeneratedApplication:generate,compileApplicationDataView:view,
    applicationRepairSafetyIssues:repair,createSection,verifyOwnedStockReservationCatalog:verify,
    verifyOwnedSupabaseCatalogSecurity:verifyFull,createApplicationDataViewController:controller,createApplicationStockReservationRpc:rpc} = createRequire(import.meta.url)(outfile);
  const permissions = ['read','create','update','delete'].map(operation=>({operation,access:'owner'}));
  const app = {version:1,auth:{enabled:true,signUpEnabled:false,emailVerificationRequired:true},roles:[],pageAccess:[],tables:[
    {id:'catalog',key:'catalog',name:'Catalog',permissions,fields:[{id:'catalog_name',key:'name',name:'Name',type:'text',required:true}]},
    {id:'warehouses',key:'warehouses',name:'Warehouses',permissions,fields:[{id:'warehouse_name',key:'name',name:'Name',type:'text',required:true}]},
    {id:'levels',key:'levels',name:'Stock by warehouse',permissions,fields:[
      {id:'stock_product',key:'product_id',name:'Item',type:'reference',required:true,referenceTableId:'catalog'},
      {id:'stock_warehouse',key:'warehouse_id',name:'Warehouse',type:'reference',required:true,referenceTableId:'warehouses'},
      {id:'level_quantity',key:'quantity',name:'Quantity',type:'number',required:true,defaultValue:0},
      {id:'level_unit_cost',key:'unit_cost',name:'Unit cost',type:'number',required:true,defaultValue:0},
      {id:'level_value',key:'stock_value',name:'Stock value',type:'number',required:true,formula:{operation:'multiply',fieldIds:['level_quantity','level_unit_cost']}},
    ],counter:{fieldId:'level_quantity',minimum:0,maximum:100,integer:true},stockReservations:true,
    stockLocations:{itemFieldId:'stock_product',locationFieldId:'stock_warehouse'},
    stockValuation:{unitCostFieldId:'level_unit_cost',valueFieldId:'level_value',currency:'SEK'},
    reports:[{id:'inventory_value',name:'Inventory value (SEK)',operation:'sum',fieldId:'level_value'}]},
  ]};
  assert.deepEqual(issues(app),[]);
  const statements = compile(app), sql=statements.join('\n');
  assert.match(sql,/unique \(owner_id,"product_id","warehouse_id"\)/);
  assert.match(sql,/"stock_value" numeric generated always as \(\("quantity" \* "unit_cost"\)\) stored/);
  assert.match(sql,/sum\("stock_value"\)/);
  assert.deepEqual(migrate(app,app),[]);
  const noLocations=structuredClone(app);delete noLocations.tables[2].stockLocations;delete noLocations.tables[2].stockValuation;
  assert.throws(()=>migrate(noLocations,app),/separately reviewed/);
  for(const change of [
    a=>{a.tables[2].stockLocations.itemFieldId='missing'},
    a=>{a.tables[2].stockLocations.locationFieldId='stock_product'},
    a=>{a.tables[2].fields[0].required=false},
    a=>{a.tables[2].fields[0].type='uuid';delete a.tables[2].fields[0].referenceTableId},
    a=>{a.tables[2].fields[1].referenceTableId='catalog'},
    a=>{delete a.tables[2].stockReservations},
    a=>{a.tables[0].permissions[0].access='authenticated'},
    a=>{a.tables[1].permissions[2].access='authenticated'},
    a=>{a.tables[2].stockLocations.secret='forbidden'},
    a=>{a.tables[2].stockLocations=null},
    a=>{a.tables[2].stockValuation.currency='sek'},
    a=>{a.tables[2].stockValuation.unitCostFieldId='level_quantity'},
    a=>{a.tables[2].fields.find(field=>field.id==='level_value').formula.operation='sum'},
    a=>{a.tables[2].reports=[]},
  ]) {const invalid=structuredClone(app);change(invalid);assert.ok(issues(invalid).length);assert.throws(()=>compile(invalid));}
  const binding={tableId:'levels',columns:['stock_product','stock_warehouse','level_quantity','level_unit_cost','level_value'],actions:['stock-availability','stock-reservation','adjust'],pageSize:10};
  assert.equal(view(app,binding).table.stockLocations.locationFieldId,'stock_warehouse');
  for(const removed of ['stock_product','stock_warehouse','level_quantity'])assert.throws(()=>view(app,{...binding,columns:binding.columns.filter(id=>id!==removed)}),/visible item, location and quantity/);
  const section=createSection('hero');section.applicationDataView=binding;section.buttonUrl='#'+section.id;
  section.elements=section.elements.map(element=>element.type==='button'?{...element,href:'#'+section.id}:element);
  const pages=[{id:'home',slug:'home',name:'Home',sections:[section]}];
  const generated={projectKind:'application',application:app,requirements:[
    {id:'physical_stock',summary:'Available physical stock per warehouse',capability:'records',evidence:['view:levels:stock-availability']},
    {id:'adjust_stock',summary:'Manage quantity',capability:'counter',evidence:['counter:levels']},
  ]};
  for(const prompt of ['Stock per warehouse','Inventory across multiple locations','مخزون متعدد المستودعات','أرصدة المخزون لكل موقع','Lagersaldo per lager']) {
    assert.ok(generate(generated,pages,prompt).tables[2].stockLocations);
    assert.throws(()=>generate({...generated,application:noLocations},pages,prompt),/Physical stock balances by location/);
  }
  const valuationGenerated={...generated,requirements:[...generated.requirements,
    {id:'stock_value_formula',summary:'Calculate current stock value',capability:'formula',evidence:['formula:levels']},
    {id:'stock_value_report',summary:'Sum current stock value',capability:'reports',evidence:['reports:levels']}]};
  const withoutValuation=structuredClone(app);delete withoutValuation.tables[2].stockValuation;
  for(const prompt of ['Inventory valuation','Current stock value','قيمة المخزون','Lagervärde']) {
    assert.ok(generate(valuationGenerated,pages,prompt).tables[2].stockValuation);
    assert.throws(()=>generate({...valuationGenerated,application:withoutValuation},pages,prompt),/Current stock valuation requires/);
    const hidden=structuredClone(pages);hidden[0].sections[0].applicationDataView.columns=hidden[0].sections[0].applicationDataView.columns.filter(id=>id!=='level_unit_cost');
    assert.throws(()=>generate(valuationGenerated,hidden,prompt),/Current stock valuation requires/);
  }
  const transferBinding={...binding,actions:[...binding.actions,'stock-transfer']};
  const transferPages=structuredClone(pages);transferPages[0].sections[0].applicationDataView=transferBinding;
  const transferGenerated={...generated,requirements:[...generated.requirements,{id:'stock_transfer',summary:'Transfer stock atomically',capability:'records',evidence:['view:levels:stock-transfer']}]};
  for(const prompt of ['Transfer stock between warehouses','Warehouse transfers','نقل المخزون بين المستودعات','Lageröverföring'])
    {assert.throws(()=>generate(generated,pages,prompt),/Atomic warehouse transfers require/);assert.ok(generate(transferGenerated,transferPages,prompt));}
  assert.throws(()=>generate(transferGenerated,transferPages,'Atomic batch stock transfers for multiple items'),/multi-item warehouse transfer batches are unsupported/);
  assert.ok(repair(app,pages,pages,noLocations).some(issue=>issue.includes('stockLocations')));
  const uid=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
  const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
  const scope={keyPrefix:'transfer-test',storage,crypto:{}};
  let actor=uid(1),lose=true,transferCalls=[];
  const runtime={auth:{currentUser:async()=>({id:actor,is_anonymous:false}),currentRoles:async()=>[]},list:async(_table,options)=>{
    assert.deepEqual(options.filters,[{field:'product_id',operator:'eq',value:uid(3)},{field:'warehouse_id',operator:'neq',value:uid(4)}]);
    return [{id:uid(7),product_id:uid(3),warehouse_id:uid(5),quantity:4}];
  },stockReservations:(_table,owner)=>({transfer:async(...args)=>{assert.equal(owner,uid(1));transferCalls.push(args);if(lose){lose=false;throw Error('response lost')}return 'already-transferred'}})};
  let controls=controller(app,transferBinding,runtime,()=>uid(20),scope);
  assert.equal((await controls.stockTransferOptions(uid(3),uid(4))).options[0].id,uid(7));
  await assert.rejects(controls.stockTransfer(uid(6),uid(7),2),/response lost/);
  await assert.rejects(controls.stockTransfer(uid(6),uid(7),3),/existing stock transfer/);
  await assert.rejects(controls.stockTransfer(uid(6),uid(8),2),/existing stock transfer/);
  controls.dispose();controls=controller(app,transferBinding,runtime,()=>uid(21),scope);
  assert.equal((await controls.stockTransferState(uid(6))).requestId,uid(20));
  assert.equal(await controls.stockTransfer(uid(6),uid(7),2),'already-transferred');
  assert.deepEqual(transferCalls,[[uid(6),uid(7),uid(20),2],[uid(6),uid(7),uid(20),2]],'Lost responses and reloads reuse the exact transfer identity');
  assert.equal(await controls.stockTransferState(uid(6)),null);
  const blocked=controller(app,transferBinding,runtime,()=>uid(22),{...scope,storage:{...storage,setItem(){throw Error('storage blocked')}}});
  await assert.rejects(blocked.stockTransfer(uid(6),uid(7),1),/storage blocked/);blocked.dispose();assert.equal(transferCalls.length,2);
  memory.set(`${scope.keyPrefix}:stock-transfer:${uid(1)}:levels:${uid(6)}`,JSON.stringify({version:1,sourceId:uid(6),destinationId:uid(7),requestId:'invalid',quantity:2}));
  await assert.rejects(controls.stockTransfer(uid(6),uid(7),2));assert.equal(transferCalls.length,2);memory.clear();
  actor=uid(2);await assert.rejects(controls.stockTransfer(uid(6),uid(7),2),/identity changed/);assert.equal(transferCalls.length,2);controls.dispose();
  let rpcCalls=[];
  const bridge={rpc:async(name,args)=>{rpcCalls.push({name,args});return{data:'transferred',error:null}}};
  assert.equal(await rpc(app,'levels',bridge).transfer(uid(6),uid(7),uid(20),2),'transferred');
  assert.deepEqual(rpcCalls,[{name:'app_stock_transfer_2',args:{source_id:uid(6),destination_id:uid(7),request_id:uid(20),amount:2}}]);
  for(const args of [[uid(6),uid(6),uid(20),2],[uid(6),uid(7),uid(20),0],[uid(6),uid(7),'bad',2]])await assert.rejects(rpc(app,'levels',bridge).transfer(...args));
  await assert.rejects(rpc(noLocations,'levels',bridge).transfer(uid(6),uid(7),uid(20),2));assert.equal(rpcCalls.length,1);
  await assert.rejects(rpc(app,'levels',{rpc:async()=>({data:'already-adjusted',error:null})}).transfer(uid(6),uid(7),uid(20),2));
  console.log('PASS saved stock locations: strict owner references, visible identity, generation, transfer refusal and repair preservation');
  if(!process.argv.includes('--postgres')) process.exit(0);
  const databaseUrl=process.env.TAYAR_STOCK_LOCATIONS_TEST_DATABASE_URL;
  const url=new URL(databaseUrl??'https://invalid.invalid');
  if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/tayar_stock_locations_test')throw Error('Dedicated local PostgreSQL fixture required');
  const query=statement=>new Promise((res,rej)=>{
    const child=spawn('psql',[databaseUrl,'-X','-q','-v','ON_ERROR_STOP=1','-A','-t'],{stdio:['pipe','pipe','pipe']});let out='',err='';
    child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',rej);child.on('close',code=>code===0?res(out.trim()):rej(Error(err)));child.stdin.end(statement);
  });
  const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
  const owner=id(1),foreign=id(2),product=id(3),warehouseA=id(4),warehouseB=id(5),levelA=id(6),levelB=id(7),foreignProduct=id(8),foreignWarehouse=id(9);
  await query(`create schema auth;create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    insert into auth.users(id) values ('${owner}'),('${foreign}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to authenticated;${sql}`);
  const login=who=>`set role authenticated;select set_config('request.jwt.claim.sub','${who}',false),set_config('request.jwt.claims','{"is_anonymous":false}',false);`;
  await query(`insert into public.app_catalog(id,owner_id,name) values ('${product}','${owner}','Product'),('${foreignProduct}','${foreign}','Private');
    insert into public.app_warehouses(id,owner_id,name) values ('${warehouseA}','${owner}','A'),('${warehouseB}','${owner}','B'),('${foreignWarehouse}','${foreign}','Private');
    ${login(owner)}insert into public.app_levels(id,product_id,warehouse_id) values ('${levelA}','${product}','${warehouseA}'),('${levelB}','${product}','${warehouseB}');
    select public.app_adjust_counter_2('${levelA}',10,gen_random_uuid());select public.app_adjust_counter_2('${levelB}',4,gen_random_uuid());`);
  const available=(level,who=owner)=>query(`${login(who)}select public.app_stock_available_2('${level}');`).then(text=>text.split('\n').at(-1));
  const reserve=(level,warehouse,receipt,quantity,who=owner)=>query(`${login(who)}select public.app_stock_reserve_2('${level}','${warehouse}','${receipt}',${quantity});`);
  const finalize=receipt=>query(`${login(owner)}select public.app_stock_finalize_2('${receipt}','fulfill');`);
  assert.equal(await available(levelA),'10');assert.equal(await available(levelB),'4');
  await assert.rejects(available(levelA,foreign),/unavailable/);
  await assert.rejects(reserve(levelA,warehouseB,id(10),1),/unavailable/,'A stock-level row cannot reserve from a different warehouse');
  await assert.rejects(reserve(levelA,warehouseA,id(10),1,foreign),/unavailable/);
  assert.match(await reserve(levelA,warehouseA,id(10),8),/reserved$/);
  assert.equal(await available(levelA),'2');assert.equal(await available(levelB),'4');
  await assert.rejects(reserve(levelA,warehouseA,id(11),3),/exceeds availability/,'Stock at B cannot cover a shortage at A');
  await assert.rejects(query(`${login(owner)}select public.app_adjust_counter_2('${levelA}',-3,gen_random_uuid());`),/cross reservations/);
  assert.match(await finalize(id(10)),/fulfilled$/);assert.match(await finalize(id(10)),/already-fulfilled$/);
  assert.equal(await available(levelA),'2');assert.equal(await available(levelB),'4');
  const competing=await Promise.allSettled([id(12),id(13)].map(receipt=>reserve(levelB,warehouseB,receipt,3)));
  assert.equal(competing.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(await available(levelB),'1');assert.equal(await available(levelA),'2');
  await assert.rejects(query(`${login(owner)}insert into public.app_levels(product_id,warehouse_id) values ('${product}','${warehouseA}');`),/unique constraint/);
  for(const [item,warehouse] of [[foreignProduct,warehouseA],[product,foreignWarehouse]])
    await assert.rejects(query(`${login(owner)}insert into public.app_levels(product_id,warehouse_id) values ('${item}','${warehouse}');`),/Stock (item|location) unavailable/);
  await assert.rejects(query(`${login(owner)}update public.app_levels set warehouse_id='${warehouseB}' where id='${levelA}';`),/identity is immutable/);
  await assert.rejects(query(`${login(owner)}update public.app_levels set product_id='${foreignProduct}' where id='${levelA}';`),/identity is immutable/);
  await assert.rejects(query(`${login(owner)}update public.app_levels set quantity=99 where id='${levelA}';`));
  // Ownership is structural even if a privileged operator removes a normal
  // audit trigger: existing stock cannot silently become another owner's item.
  await query('alter table public.app_catalog disable trigger app_guard_audit;');
  await assert.rejects(query(`update public.app_catalog set owner_id='${foreign}' where id='${product}';`),/foreign key constraint/);
  await query('alter table public.app_catalog enable trigger app_guard_audit;');
  const transferProduct=id(30),from=id(31),to=id(32),foreignLevel=id(34);
  await query(`insert into public.app_catalog(id,owner_id,name) values ('${transferProduct}','${owner}','Transfer product');
    insert into public.app_levels(id,owner_id,product_id,warehouse_id) values
      ('${from}','${owner}','${transferProduct}','${warehouseA}'),('${to}','${owner}','${transferProduct}','${warehouseB}'),
      ('${foreignLevel}','${foreign}','${foreignProduct}','${foreignWarehouse}');
    ${login(owner)}select public.app_adjust_counter_2('${from}',20,gen_random_uuid());select public.app_adjust_counter_2('${to}',90,gen_random_uuid());`);
  const transfer=(source,destination,receipt,quantity,who=owner)=>query(`${login(who)}set lock_timeout='2s';set statement_timeout='4s';select public.app_stock_transfer_2('${source}','${destination}','${receipt}',${quantity});`);
  const balances=()=>query(`select quantity from public.app_levels where id in ('${from}','${to}') order by id;`);
  assert.match(await reserve(from,warehouseA,id(40),15),/reserved$/);
  await assert.rejects(transfer(from,to,id(41),6),/cross reservations/);
  assert.equal(await balances(),'20\n90');
  assert.equal(await query(`select count(*) from private.app_stock_transfers_2 where request_id='${id(41)}';`),'0','A failed transfer stores no success receipt');
  assert.match(await transfer(from,to,id(42),5),/transferred$/);
  assert.equal(await balances(),'15\n95');
  assert.match(await transfer(from,to,id(42),5),/already-transferred$/,'Response-loss retry succeeds even when current free stock is zero');
  assert.equal(await balances(),'15\n95');
  for(const [source,destination,amount] of [[from,to,4],[to,from,5],[levelA,levelB,5]])await assert.rejects(transfer(source,destination,id(42),amount),/identity mismatch/);
  for(const [source,destination,who] of [[from,levelA,owner],[from,from,owner],[from,foreignLevel,owner],[from,to,foreign]])await assert.rejects(transfer(source,destination,id(43),1,who),/unavailable/);
  for(const quantity of [0,-1,1.5])await assert.rejects(transfer(from,to,id(43),quantity),/unavailable/);
  await query(`${login(owner)}select public.app_adjust_counter_2('${from}',2,gen_random_uuid());select public.app_adjust_counter_2('${to}',5,gen_random_uuid());`);
  const beforeDebits=await query('select count(*) from private.app_counter_requests;');
  await assert.rejects(transfer(from,to,id(44),2),/bounds/,'The destination maximum rejects the second counter leg');
  assert.equal(await balances(),'17\n100','Credit failure rolls back the source debit');
  assert.equal(await query('select count(*) from private.app_counter_requests;'),beforeDebits,'Credit failure rolls back internal counter receipts');
  assert.equal(await query(`select count(*) from private.app_stock_transfers_2 where request_id='${id(44)}';`),'0');
  await query(`${login(owner)}select public.app_adjust_counter_2('${to}',-2,gen_random_uuid());`);
  assert.match(await transfer(from,to,id(44),2),/transferred$/,'The same request may retry after an atomic rejection');
  assert.equal(await balances(),'15\n100');
  await query(`${login(owner)}select public.app_stock_finalize_2('${id(40)}','release');select public.app_adjust_counter_2('${to}',-100,gen_random_uuid());`);
  const racing=await Promise.allSettled([id(50),id(51)].map(receipt=>transfer(from,to,receipt,10)));
  assert.equal(racing.filter(result=>result.status==='fulfilled').length,1,'Competing transfers cannot oversell the source');
  assert.equal(await balances(),'5\n10');
  const opposite=await Promise.all([transfer(from,to,id(52),2),transfer(to,from,id(53),2)]);
  assert.ok(opposite.every(result=>/\ntransferred$/.test(result)),'Opposite transfers acquire the same ordered locks without deadlock');
  assert.equal(await balances(),'5\n10','Opposite transfers conserve the total quantity');
  const sameRequest=await Promise.all([transfer(from,to,id(60),2),transfer(from,to,id(60),2)]);
  assert.equal(sameRequest.filter(result=>/\ntransferred$/.test(result)).length,1);
  assert.equal(sameRequest.filter(result=>/already-transferred$/.test(result)).length,1);
  assert.equal(await balances(),'3\n12');
  assert.match(await reserve(from,warehouseA,id(70),3),/reserved$/);
  await query(`update private.app_stock_reservations_2 set expires_at=statement_timestamp()-interval '1 second' where reservation_id='${id(70)}';`);
  const nativeRpc=rpc(app,'levels',{rpc:async(name,args)=>{
    assert.equal(name,'app_stock_transfer_2');
    const text=await transfer(args.source_id,args.destination_id,args.request_id,args.amount);
    return {data:text.split('\n').at(-1),error:null};
  }});
  assert.equal(await nativeRpc.transfer(from,to,id(71),1),'transferred','The real RPC adapter executes against the generated native function and ignores expired holds');
  assert.equal(await nativeRpc.transfer(from,to,id(71),1),'already-transferred');
  assert.equal(await balances(),'2\n13');
  await assert.rejects(query(`${login(owner)}select * from private.app_stock_transfers_2;`),/permission denied/);
  await assert.rejects(query(`set role anon;select public.app_stock_transfer_2('${from}','${to}','${id(72)}',1);`),/permission denied/);
  await assert.rejects(query(`${login(owner)}select set_config('request.jwt.claims','{"is_anonymous":true}',false);select public.app_stock_transfer_2('${from}','${to}','${id(72)}',1);`),/unavailable/);
  const catalogQuery=statement=>query(`select coalesce(json_agg(row),'[]') from (${statement}) row;`).then(JSON.parse);
  assert.equal(await verify(app,'levels',catalogQuery),true,'Physical stock proof includes function source, trigger, dimensions, uniqueness and restrictive references');
  const setupEvidence=[];
  const fullVerified=await verifyFull(app,async statement=>{const rows=await catalogQuery(statement);setupEvidence.push({statement,rows});return rows;});
  if(!fullVerified)console.error('Physical stock full-catalog diagnostics:',JSON.stringify(setupEvidence));
  assert.equal(fullVerified,true,'Normal publication verifies the complete physical stock app');
  await query('alter table public.app_levels disable trigger app_stock_location_guard_2;');
  assert.equal(await verify(app,'levels',catalogQuery),false);await query('alter table public.app_levels enable trigger app_stock_location_guard_2;');
  await query('alter table public.app_levels drop constraint app_stock_location_unique_2;');
  assert.equal(await verify(app,'levels',catalogQuery),false);
  await query(statements.find(statement=>statement.includes('add constraint app_stock_location_unique_2')));
  await query('alter table public.app_levels drop constraint app_stock_location_owner_2;');
  assert.equal(await verify(app,'levels',catalogQuery),false);
  await query(statements.find(statement=>statement.includes('add constraint app_stock_location_owner_2')));
  await query('alter table public.app_levels alter column warehouse_id drop not null;');
  assert.equal(await verify(app,'levels',catalogQuery),false);await query('alter table public.app_levels alter column warehouse_id set not null;');
  assert.equal(await verify(app,'levels',catalogQuery),true);
  await query('grant select on private.app_stock_transfers_2 to authenticated;');
  assert.equal(await verify(app,'levels',catalogQuery),false,'A browser-readable transfer ledger cannot pass publication');
  await query('revoke select on private.app_stock_transfers_2 from authenticated;alter table private.app_stock_transfers_2 disable row level security;');
  assert.equal(await verify(app,'levels',catalogQuery),false);await query('alter table private.app_stock_transfers_2 enable row level security;');
  await query('alter table private.app_stock_transfers_2 drop constraint app_stock_transfers_2_pkey;');
  assert.equal(await verify(app,'levels',catalogQuery),false);await query('alter table private.app_stock_transfers_2 add primary key (actor_id,request_id);');
  assert.equal(await verify(app,'levels',catalogQuery),true);
  console.log('PASS native PostgreSQL transfers: held-unit floors, same owner/item, atomic rollback, durable replay, competing/opposite locks, adapter execution and private receipt proof');
  console.log('PASS native PostgreSQL physical stock: independent warehouse balances, exact-location holds, concurrent oversell prevention, immutable owner references and catalog drift refusal');
} finally { await rm(dir,{recursive:true,force:true}); }
