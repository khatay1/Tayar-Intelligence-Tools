import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'tayar-email-capture-'));
try{
 const out=join(dir,'capture.cjs');await build({entryPoints:['server/website-owned-source-capture.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
 const{captureOwnedEmailRuntimeSource:capture}=(await import(pathToFileURL(out))).default;
 const projectId='22222222-2222-4222-8222-222222222222',updatedAt='2026-10-09T20:00:00.000Z';
 const definition={version:1,roles:[],pageAccess:[],auth:{enabled:true,signUpEnabled:true,emailVerificationRequired:true},tables:[{
  id:'appointments',key:'appointments',name:'Appointments',fields:[{id:'name',key:'name',name:'Name',type:'text',required:true}],
  permissions:[{operation:'read',access:'owner'},{operation:'create',access:'owner'}],notifications:[{
   id:'created',connectionId:'mail-z',event:{type:'created'},subject:'New {{field:name}}',text:'Record {{record.id}}'}]}]};
 const connection={id:'mail-z',providerId:'resend',name:'Mail',enabled:true,status:'configured',environments:['production'],
  config:{from:'mail@example.com'},secrets:{apiKey:{ref:`secret://website/${projectId}/mail-z/apiKey/production`,updatedAt}},events:[],
  createdAt:updatedAt,updatedAt};
 const snapshot={application:definition,integrationsMax:{version:1,connections:[connection]}};
 const capabilities={definition,pageIds:['home'],needs:{auth:true,database:true,privatePages:false,forms:false,integrations:true,cms:false},
  integrationProviders:['resend'],stripeCheckouts:[],blockers:[]};
 const result=capture(snapshot,projectId,'production',capabilities);
 assert.deepEqual(result,{connections:[{sourceConnectionId:'mail-z',sourceUpdatedAt:updatedAt,connectionUpdatedAt:updatedAt,
  from:'mail@example.com',environmentKey:'TAYAR_RESEND_01_API_KEY'}]});
 assert.equal(JSON.stringify(result).includes('secret://'),false);assert.equal(JSON.stringify(result).includes('re_'),false);
 assert.equal(capture({...snapshot,application:{...definition,tables:[{...definition.tables[0],notifications:[]}]}},projectId,'production',
  {...capabilities,definition:{...definition,tables:[{...definition.tables[0],notifications:[]}]}}),null);
 assert.throws(()=>capture({...snapshot,integrationsMax:{version:1,connections:[{...connection,events:['form.submitted']}]}},projectId,'production',capabilities));
 console.log('PASS owned email source capture: exact saved credential identity, deterministic Vercel key names and no secret material');
}finally{await rm(dir,{recursive:true,force:true});}
