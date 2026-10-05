import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
const {PGlite}=await import(process.env.TAYAR_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();const root=new URL('../supabase/migrations/',import.meta.url);
try{
 await db.exec(`create schema auth;create function auth.uid()returns uuid language sql as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
 create table public.tool_usage_events(user_id uuid,tool_id text,action text);
 create function public.tool_access_state(p_tool_id text)returns jsonb language sql as $$select jsonb_build_object('allowed',count(*)<2,'reason',case when count(*)<2 then 'allowed' else 'limit_reached' end,'usage_count',count(*),'usage_limit',2,'usage_remaining',greatest(2-count(*),0))from public.tool_usage_events where tool_id=p_tool_id$$;`);
 const original=await fs.readFile(new URL('20260907125359_fix_local_background_usage_and_auth_prechecks.sql',root),'utf8');await db.exec(original.slice(0,original.indexOf('revoke all on function public.is_signup_enabled')));
 if(!process.argv.includes('--baseline')){const names=(await fs.readdir(root)).filter(n=>n.endsWith('_local_tool_consumption_receipt.sql'));assert.equal(names.length,1);await db.exec(await fs.readFile(new URL(names[0],root),'utf8'));}
 globalThis.__tayarUsageRpc=async(name,args)=>{try{const result=name==='tool_access_state'?await db.query('select public.tool_access_state($1)as state',[args.p_tool_id]):await db.query('select public.consume_tool_usage($1,$2)as state',[args.p_tool_id,args.p_action]);return{data:result.rows[0].state,error:null};}catch(error){return{data:null,error:{message:error.message}};}};
 const bundle=await build({entryPoints:[new URL('../src/lib/tool-usage.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'local-rpc',setup(b){b.onResolve({filter:/^@\/lib\/supabase$/},()=>({path:'supabase',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const supabase={rpc:(...args)=>globalThis.__tayarUsageRpc(...args)}',loader:'js'}));}}]});
 const {completeMeteredLocalAction,getToolUsageState}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
 for(let n=1;n<=2;n++)assert.equal(await completeMeteredLocalAction('csv-cleaner','clean',()=>`result-${n}`),`result-${n}`,'every permitted use, including the final one, must expose its result');
 assert.equal((await getToolUsageState('csv-cleaner')).allowed,false,'next action is unavailable');let ran=false;
 await assert.rejects(completeMeteredLocalAction('csv-cleaner','clean',()=>{ran=true;}),/Usage limit reached/);assert.equal(ran,false);
 assert.equal((await db.query('select count(*)::int as n from public.tool_usage_events')).rows[0].n,2);
 // Two clients can both pass preflight. The consume RPC must still reject the loser.
 await db.exec('truncate public.tool_usage_events');let arrive;const barrier=new Promise(resolve=>arrive=resolve);let n=0;
 const work=async()=>{if(++n===3)arrive();await barrier;return 'finished';};
 const concurrent=await Promise.allSettled([1,2,3].map(()=>completeMeteredLocalAction('csv-cleaner','clean',work)));
 assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,2);assert.equal(concurrent.filter(r=>r.status==='rejected').length,1);
 console.log('PASS final permitted use returns result; next use blocked; concurrent consumption stays bounded');
}finally{delete globalThis.__tayarUsageRpc;await db.close();}
