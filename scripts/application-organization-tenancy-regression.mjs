import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-organization-tenancy-'));
try{
  const entry=join(dir,'tenancy.ts'),out=join(dir,'tenancy.cjs');
  await writeFile(entry,[
    `export * from ${JSON.stringify(resolve('src/modules/website-builder/core/application-schema-sql.ts'))};`,
    `export { readApplicationDefinition } from ${JSON.stringify(resolve('src/modules/website-builder/core/application-validation.ts'))};`,
  ].join('\n'));
  await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',outfile:out,alias:{'@':resolve('src')}});
  const compiled=(await import(pathToFileURL(out))).default;
  const orgField={id:'project-organization',key:'organization_id',name:'Organization',type:'reference',required:true,referenceTableId:'organizations'};
  const app={version:1,auth:{enabled:true,signUpEnabled:true,emailVerificationRequired:true},roles:[],pageAccess:[],
    tenancy:{mode:'organizations',organizationTableId:'organizations'},tables:[
      {id:'organizations',key:'organizations',name:'Organizations',fields:[{id:'organization-name',key:'name',name:'Name',type:'text',required:true}],permissions:[
        {operation:'create',access:'authenticated'},{operation:'read',access:'organization'},{operation:'read',access:'owner'},
        {operation:'update',access:'owner'},{operation:'delete',access:'owner'}]},
      {id:'projects',key:'projects',name:'Projects',organizationFieldId:'project-organization',fields:[orgField,{id:'project-name',key:'name',name:'Name',type:'text',required:true}],permissions:[
        {operation:'create',access:'organization'},{operation:'read',access:'organization'},{operation:'update',access:'organization'},{operation:'delete',access:'organization'}]},
    ]};
  assert.doesNotThrow(()=>compiled.readApplicationDefinition(app));
  const sql=compiled.compileInitialApplicationSchema(app).join('\n');
  assert.match(sql,/create table private\.app_organization_members/);
  assert.match(sql,/private\.app_has_organization_access\(id\)/);
  assert.match(sql,/private\.app_has_organization_access\("organization_id"\)/);
  assert.match(sql,/create trigger app_guard_organization_scope before update on public\."app_projects"/);
  assert.match(sql,/revoke all on private\.app_organization_members from public, anon, authenticated/);
  assert.doesNotMatch(sql,/user_metadata/);
  assert.throws(()=>compiled.readApplicationDefinition({...app,tables:app.tables.map((table,index)=>index?{...table,organizationFieldId:undefined}:table)}),/Organization|organization/);
  assert.throws(()=>compiled.readApplicationDefinition({...app,tables:app.tables.map((table,index)=>index?{...table,permissions:[{operation:'read',access:'authenticated'}]}:table)}),/Organization|organization/);
  assert.throws(()=>compiled.readApplicationDefinition({...app,tables:app.tables.map((table,index)=>index?{...table,permissions:[{operation:'read',access:'owner'}]}:table)}),/Organization|organization/);
  assert.throws(()=>compiled.compileAdditiveApplicationMigration(app,{...app,auth:{...app.auth,signUpEnabled:false}}),/separately reviewed/);

  if(process.argv.includes('--postgres')){
    const databaseUrl=process.env.TAYAR_ORGANIZATION_TEST_DATABASE_URL,url=new URL(databaseUrl??'http://invalid');
    if(!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/tayar_organization_test')throw Error('An isolated local tayar_organization_test database is required.');
    const{spawn}=await import('node:child_process');
    const query=sql=>new Promise((resolveQuery,reject)=>{const child=spawn('psql',[databaseUrl,'-X','-q','-v','ON_ERROR_STOP=1','-A','-t'],{stdio:['pipe','pipe','pipe']});let output='',error='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>error+=data);child.on('error',reject);child.on('close',code=>code===0?resolveQuery(output.trim()):reject(Error(error.trim()||`psql ${code}`)));child.stdin.end(sql);});
    const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',stranger='33333333-3333-4333-8333-333333333333';
    await query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema auth;
      create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
      insert into auth.users(id) values('${owner}'),('${member}'),('${stranger}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('is_anonymous',coalesce(nullif(current_setting('request.jwt.claim.is_anonymous',true),''),'false')::boolean) $$;
      grant usage on schema auth to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;`);
    for(const statement of compiled.compileInitialApplicationSchema(app))await query(statement);
    const as=async(user,statement)=>{const output=await query(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);select set_config('request.jwt.claim.is_anonymous','false',false);${statement};`);return output.split('\n').at(-1);};
    const org=await as(owner,`insert into public.app_organizations(name) values('Owner org') returning id`);
    await as(owner,`insert into public.app_projects(organization_id,name) values('${org}','Owner project') returning id`);
    assert.equal(await as(member,'select count(*) from public.app_projects'),'0');
    await as(owner,`select public.app_set_organization_member('${org}','${member}',true,false)`);
    assert.equal(await as(member,'select count(*) from public.app_projects'),'1');
    await as(member,`insert into public.app_projects(organization_id,name) values('${org}','Member project') returning id`);
    assert.equal(await as(owner,'select count(*) from public.app_projects'),'2');
    await assert.rejects(as(member,`select public.app_set_organization_member('${org}','${stranger}',true,false)`));
    await assert.rejects(as(owner,`select public.app_set_organization_member('${org}','${owner}',false,false)`));
    const other=await as(stranger,`insert into public.app_organizations(name) values('Other org') returning id`);
    await assert.rejects(as(member,`insert into public.app_projects(organization_id,name) values('${other}','Cross tenant') returning id`));
    const project=await as(member,`select id from public.app_projects where name='Member project'`);
    await assert.rejects(as(member,`update public.app_projects set organization_id='${other}' where id='${project}' returning id`));
    assert.equal(await as(stranger,'select count(*) from public.app_projects'),'0');
    console.log('PASS organization tenancy: private membership, member CRUD, admin-only grants, immutable scope and cross-tenant RLS denial');
  }else console.log('PASS organization tenancy static contract (use --postgres for native isolation proof)');
}finally{await rm(dir,{recursive:true,force:true});}
