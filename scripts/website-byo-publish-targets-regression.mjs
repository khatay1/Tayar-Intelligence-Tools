import assert from'node:assert/strict';import{mkdtemp,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import{build}from'esbuild';
const dir=await mkdtemp(join(tmpdir(),'tayar-publish-targets-'));try{const out=join(dir,'targets.cjs');await build({entryPoints:['server/website-byo-publish-targets.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
const{captureWebsiteByoPublishTargets:capture}=(await import(pathToFileURL(out))).default;const projectId='11111111-1111-4111-8111-111111111111',ownerId='22222222-2222-4222-8222-222222222222';
const value={githubPreview:{connectionId:'33333333-3333-4333-8333-333333333333',version:4},vercelPreview:{connectionId:'44444444-4444-4444-8444-444444444444',version:5},vercelProduction:{connectionId:'55555555-5555-4555-8555-555555555555',version:6}};let reads=0,current=structuredClone(value);
const client={rpc:async(name,args)=>{assert.equal(name,'website_byo_publish_targets');assert.deepEqual(args,{p_project_id:projectId,p_owner_id:ownerId});reads++;return{data:structuredClone(current),error:null};}};
const captured=await capture({client,projectId,ownerId});assert.deepEqual(captured.targets,value);assert.equal(reads,2);assert.equal(await captured.isCurrent(),true);
current.vercelProduction.version++;assert.equal(await captured.isCurrent(),false);
const previewOnly={...value,vercelProduction:null};const preview=await capture({client:{rpc:async()=>({data:previewOnly,error:null})},projectId,ownerId});assert.equal(preview.targets.vercelProduction,null);
await assert.rejects(capture({client:{rpc:async()=>({data:previewOnly,error:null})},projectId,ownerId,requireProduction:true}),/unavailable/);
await assert.rejects(capture({client:{rpc:async()=>({data:{...value,accessToken:'secret'},error:null})},projectId,ownerId}),/unavailable/);
await assert.rejects(capture({client:{rpc:async()=>({data:null,error:null})},projectId,ownerId}),/unavailable/);
const sql=await readFile('supabase/migrations/20260930050000_website_byo_publish_targets.sql','utf8');
for(const proof of["g.provider='github'","vp.environment='preview'","vr.environment='production'",'pvc.repository_id=g.target_id','pvc.vercel_project_id=rvc.vercel_project_id','pvc.custody_expires_at>clock_timestamp()','rvc.custody_expires_at>clock_timestamp()','revoke all on function public.website_byo_publish_targets(uuid,uuid) from public,anon,authenticated','grant execute on function public.website_byo_publish_targets(uuid,uuid) to service_role'])assert.ok(sql.includes(proof),proof);
assert.ok(!/accessToken|secretValue|decrypted_secret/.test(sql));console.log('PASS BYO publish targets: private exact provider selection, leased matching customer targets, strict metadata parsing and stale-version refusal');
}finally{await rm(dir,{recursive:true,force:true});}
