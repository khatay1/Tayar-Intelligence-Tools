import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-secret-plan-'));
try {
  const out=join(dir,'plan.cjs');
  await build({entryPoints:['server/website-owned-runtime-secret-plan.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
  const {createOwnedRuntimeSecretPlan:create,readOwnedRuntimeEnvironment:read}=(await import(pathToFileURL(out))).default;
  const capabilities={integrationProviders:['resend','stripe'],stripeCheckouts:[{id:'buy',previewPriceId:'price_test12345678',productionPriceId:'price_live12345678'}]};
  const plan=create({environment:'production',capabilities,emailConnections:[{id:'z-mail',from:'Z <z@example.com>'},{id:'a-mail',from:'a@example.com'}]});
  assert.deepEqual(plan.emailConnections.map(item=>[item.id,item.environmentKey]),[['a-mail','TAYAR_RESEND_01_API_KEY'],['z-mail','TAYAR_RESEND_02_API_KEY']]);
  assert.deepEqual(plan.requirements.map(item=>item.key),['SUPABASE_URL','SUPABASE_ANON_KEY','STRIPE_SECRET_KEY','SUPABASE_SECRET_KEY','CRON_SECRET','TAYAR_RESEND_01_API_KEY','TAYAR_RESEND_02_API_KEY']);
  assert.equal(JSON.stringify(plan).includes('secret://'),false);
  const paymentPlan=create({environment:'preview',capabilities:{definition:{tables:[{payment:{provider:'stripe'}}]},integrationProviders:[],stripeCheckouts:[]}});
  assert.deepEqual(paymentPlan.requirements.map(item=>item.key),['SUPABASE_URL','SUPABASE_ANON_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','SUPABASE_SECRET_KEY']);
  const values=Object.fromEntries(plan.requirements.map(item=>[item.key,`${item.key.toLowerCase()}-fixture`]));
  assert.deepEqual(read(plan,values),values);
  await assert.rejects(async()=>read(plan,{...values,CRON_SECRET:''}),/CRON_SECRET/);
  await assert.rejects(async()=>read(plan,{...values,CRON_SECRET:'bad\nvalue'}),/CRON_SECRET/);
  console.log('PASS owned runtime secret plan: deterministic names, no values, Preview/Production scope and fail-closed environment reads');
} finally { await rm(dir,{recursive:true,force:true}); }
