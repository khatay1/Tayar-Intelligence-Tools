import assert from'node:assert/strict';import{mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{pathToFileURL}from'node:url';import{build}from'esbuild';
const dir=await mkdtemp(join(tmpdir(),'tayar-publish-browser-'));try{const out=join(dir,'browser.cjs');await build({entryPoints:['src/modules/website-builder/services/websiteByoPublishBrowserService.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
const mod=(await import(pathToFileURL(out))).default;const ownerId='11111111-1111-4111-8111-111111111111',projectId='22222222-2222-4222-8222-222222222222';let current=true;const scope={ownerId,projectId,loadSequence:7,isCurrent:()=>current};
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};const requests=[];let pollReady=false,sessionReads=0;
const fetcher=async(url,init)=>{assert.equal(url,'https://platform.example/functions/v1/website-byo-publish');assert.equal(init.headers.authorization,'Bearer header.payload.signature');const body=JSON.parse(init.body);requests.push(body);
  if(body.action==='status'){const status=pollReady?'ready':'pending';return Response.json({status,operationId:body.operationId,environment:body.environment,stage:pollReady?'ready':'observing',version:pollReady?3:2,liveUrl:pollReady?'https://preview.vercel.app':null},{status:pollReady?200:202});}
  if(body.action==='production')assert.fail('browser must not request the closed public Production route');
  return Response.json({status:'pending',operationId:body.operationId,environment:'preview',stage:'observing',version:1,liveUrl:null},{status:202});};
const transport={platformUrl:'https://platform.example',anonKey:'anon-public-key',getSession:async()=>{sessionReads+=1;return{ownerId,accessToken:'header.payload.signature'};},fetcher};
await assert.rejects(mod.startWebsiteByoPreview({scope:{...scope,ownerId:'11111111-1111-4111-111111111111'},transport,storage}),/changed/);assert.equal(requests.length,0);
const first=await mod.startWebsiteByoPreview({scope,transport,storage});assert.equal(first.status,'pending');assert.match(first.operationId,/^[0-9a-f-]{36}$/);assert.equal(requests[0].action,'preview');
const retry=await mod.startWebsiteByoPreview({scope,transport,storage});assert.equal(retry.operationId,first.operationId,'pending retry reuses operation');
pollReady=true;const ready=await mod.pollWebsiteByoPublish({scope,transport,storage,environment:'preview'});assert.equal(ready.status,'ready');assert.equal(ready.operationId,first.operationId);
assert.equal(await mod.pollWebsiteByoPublish({scope,transport,storage,environment:'preview'}),null,'settled operations do not auto-poll');
const restored=await mod.pollWebsiteByoPublish({scope,transport,storage,environment:'preview',includeSettled:true});assert.equal(restored.status,'ready');assert.equal(requests.at(-1).action,'status','reopening verifies the server instead of trusting stored readiness');
const requestCount=requests.length,sessionReadCount=sessionReads;
await assert.rejects(mod.startWebsiteByoProduction({scope,transport,storage}),error=>error.code==='production-candidate-required'&&/separately staged/.test(error.message));
await assert.rejects(mod.startWebsiteByoProduction({scope,transport,storage,newOperation:true}),error=>error.code==='production-candidate-required');
assert.equal(requests.length,requestCount,'closed Production makes no authenticated request');
assert.equal(sessionReads,sessionReadCount,'closed Production does not read the authenticated transport');
assert.equal(mod.readStoredWebsiteByoPublishOperation({scope,environment:'production',storage}),null,'closed Production creates no browser operation');
assert.equal(await mod.pollWebsiteByoPublish({scope,transport,storage,environment:'production'}),null,'missing Production operation is not polled');
current=false;await assert.rejects(mod.startWebsiteByoPreview({scope,transport,storage}),/changed/);
assert.ok(!JSON.stringify([...values.values()]).includes('header.payload.signature'),'session storage contains no token');
console.log('PASS BYO publish browser: scoped durable UUIDs, pending reuse, ready Preview restore, local Production refusal and stale-project refusal');
}finally{await rm(dir,{recursive:true,force:true});}
