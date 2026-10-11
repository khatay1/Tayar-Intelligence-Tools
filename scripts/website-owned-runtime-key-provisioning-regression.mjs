import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-runtime-key-'));
try{
 const out=join(dir,'key.cjs');await build({entryPoints:['server/website-owned-runtime-key-provisioning.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
 const{inspectOwnedSupabaseRuntimeKey:inspect,ensureOwnedSupabaseRuntimeKey:ensure,generateOwnedCronSecret:cron}=(await import(pathToFileURL(out))).default;
 const custody={version:1,accountId:'customer',organizationId:'org',organizationSlug:'org',projectRef:'abcdefghijklmnopqrst',environment:'preview',accessToken:'oauth_fixture_12345678901234567890'};
 const value=['sb','secret','fixture12345678901234567890'].join('_'),row={id:'key_runtime_preview',name:'tayar-runtime-preview',type:'secret',api_key:value};
 let calls=[];const existing=await inspect({custody,fetcher:async(url,init)=>{calls.push([url,init]);return Response.json([row]);}});
 assert.deepEqual(existing,{id:row.id,name:row.name,type:'secret',apiKey:value});assert.equal(calls[0][1].method,'GET');
 calls=[];const created=await ensure({custody,isCurrent:()=>true,fetcher:async(url,init)=>{calls.push([url,init]);
  if(calls.length===1)return Response.json([]);assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),{type:'secret',name:'tayar-runtime-preview',description:'Dedicated Tayar customer runtime key'});return Response.json(row,{status:201});}});
 assert.equal(created.apiKey,value);assert.deepEqual(calls.map(call=>call[1].method),['GET','POST']);
 let read=0;const reconciled=await ensure({custody,isCurrent:()=>true,fetcher:async(_url,init)=>{
  if(init.method==='POST')throw new Error('uncertain');read++;return Response.json(read===1?[]:[row]);}});assert.equal(reconciled.id,row.id);
 await assert.rejects(inspect({custody,fetcher:async()=>Response.json([row,{...row,id:'key_duplicate'}])}),/unavailable/);
 await assert.rejects(ensure({custody,isCurrent:()=>false,fetcher:()=>assert.fail()}),/unavailable/);
 const first=cron(),second=cron();assert.match(first,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(first,second);
 assert.equal(JSON.stringify({existing,created,reconciled}).includes(custody.accessToken),false);
 console.log('PASS owned runtime key provisioning: dedicated Supabase keys, bounded reads, idempotent uncertain-create recovery and per-environment cron entropy');
}finally{await rm(dir,{recursive:true,force:true});}
