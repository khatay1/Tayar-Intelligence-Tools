// Uses isolated PostgreSQL via an externally supplied PGlite package; no live DB writes.
// TAYAR_PGLITE_MODULE=/path/to/pglite/dist/index.js node scripts/website-legacy-form-rate-limit-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const modulePath=process.env.TAYAR_PGLITE_MODULE || '@electric-sql/pglite';
const {PGlite}=await import(modulePath);
const {pgcrypto}=await import(process.env.TAYAR_PGCRYPTO_MODULE || '@electric-sql/pglite/contrib/pgcrypto');
const db=new PGlite({extensions:{pgcrypto}});
const root=new URL('../supabase/migrations/',import.meta.url);
try {
  await db.exec(`create extension pgcrypto; create role anon; create role authenticated; create role service_role;
    create table public.projects(id uuid primary key,user_id uuid,type text);
    create table public.website_leads(id uuid default gen_random_uuid(),project_id uuid,user_id uuid,name text,email text,message text,form_data jsonb,page_path text);
    create function public.website_public_ingestion_limit(uuid,text) returns integer language sql as $$select 1000$$;
    insert into public.projects values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','website-builder');`);
  const baseline=await fs.readFile(new URL('20260828161000_quality_security_hardening.sql',root),'utf8');
  await db.exec(baseline.slice(0,baseline.indexOf('CREATE OR REPLACE FUNCTION public.website_public_ingestion_limit(')));
  const formStart=baseline.indexOf('CREATE OR REPLACE FUNCTION public.submit_website_form(');
  await db.exec(baseline.slice(formStart));
  await db.exec(await fs.readFile(new URL('20260907101257_harden_legacy_website_lead_ingestion.sql',root),'utf8'));
  await db.exec('grant execute on function public.enforce_website_public_rate_limit(uuid,text,integer,integer,text) to service_role;');
  if(!process.argv.includes('--baseline')){
    const names=(await fs.readdir(root)).filter(n=>n.endsWith('_website_legacy_form_rate_limit_identity.sql'));
    assert.equal(names.length,1);await db.exec(await fs.readFile(new URL(names[0],root),'utf8'));
  }
  const grants=await db.query("select has_function_privilege('service_role','public.enforce_website_public_rate_limit(uuid,text,integer,integer,text)','EXECUTE') as service, has_function_privilege('anon','public.enforce_website_public_rate_limit(uuid,text,integer,integer,text)','EXECUTE') as anon");
  assert.deepEqual(grants.rows[0],{service:true,anon:false},'existing helper EXECUTE permissions must be preserved');
  const project='11111111-1111-4111-8111-111111111111';
  async function submit(kind,n,ip='203.0.113.7'){
    await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'cf-connecting-ip':ip,'user-agent':`rotating-agent-${n}`})]);
    if(kind==='lead-form') return db.query('select public.submit_website_form($1,$2::jsonb,$3)',[project,JSON.stringify({name:'Visitor',email:`visitor${n}@example.com`,message:'Hello'}),'/']);
    return db.query('select public.submit_website_lead($1,$2,$3,$4)',[project,'Visitor',`visitor${n}@example.com`,'Hello']);
  }
  for(const kind of ['lead-form','lead-legacy']){
    for(let n=0;n<8;n++) await submit(kind,n);
    await assert.rejects(submit(kind,8),/Too many requests/);
    await submit(kind,9,'203.0.113.8');
    await db.query("update public.website_public_rate_limits set window_started_at=now()-interval '901 seconds' where bucket=$1",[kind]);
    await submit(kind,10);
    console.log(`PASS ${kind}: rotating email and User-Agent cannot reset limit; distinct IP and expired window work`);
  }
  // Modern Edge handlers use trusted p_client_key because DB requests come from the Edge egress IP.
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'cf-connecting-ip':'203.0.113.99','user-agent':'edge-runtime'})]);
  for(let n=0;n<8;n++) await db.query('select public.enforce_website_public_rate_limit($1,$2,8,900,$3)',[project,'form-max','203.0.113.20']);
  await assert.rejects(db.query('select public.enforce_website_public_rate_limit($1,$2,8,900,$3)',[project,'form-max','203.0.113.20']),/Too many requests/);
  await db.query('select public.enforce_website_public_rate_limit($1,$2,8,900,$3)',[project,'form-max','203.0.113.21']);
  console.log('PASS modern Edge namespace keeps distinct trusted client keys');
} finally {await db.close();}
