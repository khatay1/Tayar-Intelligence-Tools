import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory=await mkdtemp(join(tmpdir(),'tayar-social-dispatch-'));
try {
  await build({entryPoints:['server/social-dispatch-runtime.ts'],bundle:true,platform:'node',format:'esm',outfile:join(directory,'runtime.mjs'),external:['@supabase/supabase-js']});
  const {createSocialDispatchHandler}=await import(pathToFileURL(join(directory,'runtime.mjs')).href);
  const scope='00000000-0000-4000-8000-000000000001',connection='00000000-0000-4000-8000-000000000002',job='00000000-0000-4000-8000-000000000003',lease='00000000-0000-4000-8000-000000000004';
  const rpcCalls=[];
  const client={async rpc(name,args){rpcCalls.push({name,args});let data=null;
    if(name==='list_due_social_hub_outgoing')data=[{job_id:job,scope_id:scope,connection_id:connection}];
    if(name==='claim_social_hub_outgoing')data={id:job,claim_token:lease,lease_until:new Date(Date.now()+120000).toISOString(),scope_id:scope,connection_id:connection,external_account_id:'123456789',recipient_id:'987654321',text:'hello'};
    if(name==='resolve_social_hub_outgoing')data={connection:{id:connection,scope_id:scope,channel:'telegram',external_account_id:'123456789',ownership:'customer',status:'connected',permissions_verified:true,webhook_verified:true,expires_at:null,secret_ref:'00000000-0000-4000-8000-000000000005'},policy:{consent_verified:true,recipient_initiated:true,last_inbound_at:new Date().toISOString()}};
    if(name==='read_social_hub_credential')data='123456:abcdefghijklmnopqrstuvwxyz';
    if(name==='reserve_social_hub_dispatch')data=true;
    return {data,error:null};}};
  const fetcher=async url=>{assert.match(String(url),/^https:\/\/api\.telegram\.org\/bot/);return new Response('{"ok":true,"result":{"message_id":42}}',{status:200});};
  const secret='scheduler-fixture-secret-at-least-32-characters';
  let enabled=true;const handler=createSocialDispatchHandler({enabled:()=>enabled,secret,client,fetcher});
  assert.equal((await handler(new Request('https://app.example/api/social-dispatch'))).status,401);
  assert.equal((await handler(new Request('https://app.example/api/social-dispatch?job='+job,{headers:{authorization:`Bearer ${secret}`}}))).status,400);
  assert.equal((await handler(new Request('https://app.example/api/social-dispatch',{method:'POST',headers:{authorization:`Bearer ${secret}`}}))).status,405);
  const response=await handler(new Request('https://app.example/api/social-dispatch',{headers:{authorization:`Bearer ${secret}`}}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{processed:1,accepted:1,review:0,rejected:0,idle:0});
  assert.deepEqual(rpcCalls[0],{name:'list_due_social_hub_outgoing',args:{p_limit:3}});
  assert.equal(rpcCalls.filter(call=>call.name==='claim_social_hub_outgoing').length,1);
  assert.equal(rpcCalls.filter(call=>call.name==='settle_social_hub_outbox').length,1);
  enabled=false;assert.equal((await handler(new Request('https://app.example/api/social-dispatch',{headers:{authorization:`Bearer ${secret}`}}))).status,503);
  assert.throws(()=>createSocialDispatchHandler({enabled:()=>true,secret:'short',client}));
  console.log('PASS Social dispatch scheduler: server-selected IDs, exact auth, bounded batch, existing claim/reserve/settle worker and default kill switch');
} finally { await rm(directory,{recursive:true,force:true}); }
