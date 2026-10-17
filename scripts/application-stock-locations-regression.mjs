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
    verifyOwnedSupabaseCatalogSecurity:verifyFull} = createRequire(import.meta.url)(outfile);
  const permissions = ['read','create','update','delete'].map(operation=>({operation,access:'owner'}));
  const app = {version:1,auth:{enabled:true,signUpEnabled:false,emailVerificationRequired:true},roles:[],pageAccess:[],tables:[
    {id:'catalog',key:'catalog',name:'Catalog',permissions,fields:[{id:'catalog_name',key:'name',name:'Name',type:'text',required:true}]},
    {id:'warehouses',key:'warehouses',name:'Warehouses',permissions,fields:[{id:'warehouse_name',key:'name',name:'Name',type:'text',required:true}]},
    {id:'levels',key:'levels',name:'Stock by warehouse',permissions,fields:[
      {id:'stock_product',key:'product_id',name:'Item',type:'reference',required:true,referenceTableId:'catalog'},
      {id:'stock_warehouse',key:'warehouse_id',name:'Warehouse',type:'reference',required:true,referenceTableId:'warehouses'},
      {id:'level_quantity',key:'quantity',name:'Quantity',type:'number',required:true,defaultValue:0},
    ],counter:{fieldId:'level_quantity',minimum:0,integer:true},stockReservations:true,
    stockLocations:{itemFieldId:'stock_product',locationFieldId:'stock_warehouse'}},
  ]};
  assert.deepEqual(issues(app),[]);
  const statements = compile(app), sql=statements.join('\n');
  assert.match(sql,/unique \(owner_id,"product_id","warehouse_id"\)/);
  assert.deepEqual(migrate(app,app),[]);
  const noLocations=structuredClone(app);delete noLocations.tables[2].stockLocations;
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
  ]) {const invalid=structuredClone(app);change(invalid);assert.ok(issues(invalid).length);assert.throws(()=>compile(invalid));}
  const binding={tableId:'levels',columns:['stock_product','stock_warehouse','level_quantity'],actions:['stock-availability','stock-reservation','adjust'],pageSize:10};
  assert.equal(view(app,binding).table.stockLocations.locationFieldId,'stock_warehouse');
  for(const removed of binding.columns)assert.throws(()=>view(app,{...binding,columns:binding.columns.filter(id=>id!==removed)}),/visible item, location and quantity/);
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
  for(const prompt of ['Transfer stock between warehouses','Warehouse transfers','نقل المخزون بين المستودعات','Lageröverföring'])
    assert.throws(()=>generate(generated,pages,prompt),/Atomic warehouse transfers are unsupported/);
  assert.ok(repair(app,pages,pages,noLocations).some(issue=>issue.includes('stockLocations')));
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
  console.log('PASS native PostgreSQL physical stock: independent warehouse balances, exact-location holds, concurrent oversell prevention, immutable owner references and catalog drift refusal');
} finally { await rm(dir,{recursive:true,force:true}); }
