import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-social-inbox-browser-'));
let server;
try {
  const fixture = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import SocialHubTool from './src/modules/social-hub/SocialHubTool';
const calls=[];
globalThis.socialFixture={calls,user:{id:'user1'}};
const scope={id:'scope1',kind:'customer',enabled:true,automation_enabled:false,business_time_zone:'UTC',business_hours:[]};
const inbox={scope,connections:[{id:'conn1',channel:'telegram',external_account_id:'bot1',status:'connected',permissions_verified:true,webhook_verified:false,expires_at:null}],conversations:[{id:'conv1',connection_id:'conn1',external_id:'chat1',status:'open',assigned_to:null,crm_lead_id:null,updated_at:'2026-10-18'}],messages:[{id:'m1',conversation_id:'conv1',direction:'inbound',text:'Opening hours?',attachment_refs:[{type:'image',providerId:'opaque-file'}],created_at:'2026-10-18'}],notes:[],outbox:[],followups:[],crmLeads:[{id:'lead1',name:'Alice',email:'alice@example.test',stage:'new',priority:0}]};
let unread=1;
globalThis.socialFixture.rpc=async(name,args)=>{calls.push({name,args});if(name==='get_social_hub_automation_rules')return {data:[]};if(name==='set_social_hub_automation'){scope.automation_enabled=args.p_enabled;return {data:null}}if(name==='configure_social_hub_business_hours'){scope.business_time_zone=args.p_time_zone;scope.business_hours=args.p_hours;return {data:null}}if(name==='save_social_hub_event_rule')return {data:'rule1'};if(name==='get_social_hub_assistant_settings')return {data:null};if(name==='create_social_hub_scope')return {data:'scope1'};if(name==='list_social_hub_scopes')return {data:[scope]};if(name==='get_social_hub_unread_counts')return {data:[{conversationId:'conv1',unread}]};if(name==='list_social_hub_assignees')return {data:[{id:'user1',name:'Owner'},{id:'teammate1',name:'Editor'}]};if(name==='mark_social_hub_conversation_read'){unread=0;return {data:null}}if(name==='get_social_hub_message_history')return {data:args.p_before_id?{messages:[{id:'old1',conversation_id:'conv1',direction:'inbound',text:'Earlier conversation',occurred_at:'2020-01-01'}],nextBeforeId:null}:{messages:inbox.messages,nextBeforeId:'m1'}};if(name==='get_social_hub_inbox')return {data:inbox};if(name==='enqueue_social_hub_message')return {data:'job1'};if(name==='mutate_social_hub_conversation'){inbox.conversations[0].assigned_to=args.p_set_assignment?args.p_assigned_to:inbox.conversations[0].assigned_to;return {data:true}}if(name==='link_social_hub_crm_lead'){inbox.conversations[0].crm_lead_id=args.p_lead_id;return {data:null}}if(name==='create_social_hub_followup'){inbox.followups.push({id:'follow1',conversation_id:'conv1',title:args.p_title,body:'',status:'open',source:'manual',assigned_to:null,created_at:'2026-10-19'});return {data:'follow1'}}if(name==='mutate_social_hub_followup'){if(args.p_status)inbox.followups[0].status=args.p_status;if(args.p_set_assignment)inbox.followups[0].assigned_to=args.p_assigned_to;return {data:null}}throw Error('unknown RPC')};
globalThis.fetch=async(url,options)=>{check(url==='/api/social-assistant','Fixed assistant destination');check(JSON.stringify(JSON.parse(options.body))===JSON.stringify({scopeId:'scope1',conversationId:'conv1',messageId:'m1'}),'Assistant accepts identifiers only');return new Response(JSON.stringify({decision:{kind:'suggestion',messageId:'m1',text:'Open at 09:00'}}));};
const check=(v,m)=>{if(!v)throw Error(m)};
const wait=()=>new Promise(r=>setTimeout(r,30));
const change=(control,value)=>{const proto=control instanceof HTMLSelectElement?HTMLSelectElement.prototype:control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(control,value);control.dispatchEvent(new Event(control instanceof HTMLSelectElement?'change':'input',{bubbles:true}))};
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
async function run(){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);root.render(<SocialHubTool darkMode={false}/>);await wait();await wait();
change(document.querySelector('[aria-label="Owned website project"]'),'project1');await wait();button('Create project inbox').click();await wait();await wait();check(calls.some(c=>c.name==='create_social_hub_scope'&&c.args.p_project_id==='project1'&&c.args.p_workspace_id==='workspace1'&&c.args.p_kind==='customer'),'Project and workspace preserved by Connect scope creation');
check(document.body.textContent.includes('Authorization verified'),'Provider authorization readiness visible');check(document.body.textContent.includes('Webhook verification required'),'Webhook readiness visible');check(document.body.textContent.includes('Messaging not ready'),'Connected does not overclaim messaging readiness');
change(document.querySelector('[aria-label="Time zone"]'),'Europe/Stockholm');const monday=[...document.querySelectorAll('label')].find(label=>label.textContent.includes('Monday')).querySelector('input[type="checkbox"]');monday.click();await wait();button('Save business hours').click();await wait();await wait();check(calls.some(c=>c.name==='configure_social_hub_business_hours'&&c.args.p_time_zone==='Europe/Stockholm'&&c.args.p_hours[0].day===1),'Tenant business schedule uses explicit time zone and bounded minutes');
button('Save rule').click();await wait();await wait();check(calls.some(c=>c.name==='save_social_hub_event_rule'&&c.args.p_scope_id==='scope1'&&c.args.p_enabled===false&&c.args.p_action==='notify'),'Rules default disabled');for(const trigger of ['conversation.assigned','outside.hours','order.status.changed','booking.reminder']){change(document.querySelector('[aria-label="Trigger"]'),trigger);await wait();button('Save rule').click();await wait();await wait();check(calls.some(c=>c.name==='save_social_hub_event_rule'&&c.args.p_trigger===trigger&&c.args.p_action==='notify'),trigger+' rule stays bounded and non-sending');}
button('Enable automation').click();await wait();await wait();check(!!button('Stop automation'),'Automation enable state refresh');button('Stop automation').click();await wait();await wait();check(calls.some(c=>c.name==='set_social_hub_automation'&&c.args.p_enabled===false),'Immediate stop control');
 const conversation=document.querySelector('nav button');check(conversation.textContent.includes('telegram'),'Channel visible');check(conversation.textContent.includes('1 new'),'Unread count visible');conversation.click();await wait();await wait();check(calls.some(c=>c.name==='mark_social_hub_conversation_read'&&c.args.p_conversation_id==='conv1'),'Opening conversation marks only that conversation read');check(!conversation.textContent.includes('1 new'),'Unread count clears after opening');
 check(document.querySelector('[role="log"]').textContent.includes('Opening hours?'),'Actual message visible');check(document.querySelector('[role="log"]').textContent.includes('Image attachment'),'Safe attachment type visible');check(!document.querySelector('[role="log"]').innerHTML.includes('opaque-file'),'Provider attachment identifier stays hidden');button('Load older messages').click();await wait();await wait();check(document.querySelector('[role="log"]').textContent.includes('Earlier conversation'),'Older messages load independently');check(calls.some(c=>c.name==='get_social_hub_message_history'&&c.args.p_before_id==='m1'),'Conversation-scoped page cursor');
button('Suggest reply').click();await wait();await wait();button('Use suggestion in draft').click();await wait();
check(document.querySelector('textarea').value==='Open at 09:00','Suggestion fills draft');check(!calls.some(c=>c.name==='enqueue_social_hub_message'),'Suggestion never sends');
change(document.querySelector('textarea'),'Open at 09:00');await wait();button('Queue reply').click();await wait();await wait();
check(calls.some(c=>c.name==='enqueue_social_hub_message'&&c.args.p_text==='Open at 09:00'&&c.args.p_idempotency_key),'Queue with idempotency');
check(document.body.textContent.includes('Reply queued'),'No delivery claim');
change(document.querySelector('[aria-label="Assigned team member"]'),'teammate1');await wait();await wait();check(calls.some(c=>c.name==='mutate_social_hub_conversation'&&c.args.p_assigned_to==='teammate1'&&c.args.p_set_assignment===true),'Eligible team member assignment');
change(document.querySelector('[aria-label="CRM lead"]'),'lead1');await wait();await wait();check(calls.some(c=>c.name==='link_social_hub_crm_lead'&&c.args.p_lead_id==='lead1'),'Project CRM link');
const followupInput=[...document.querySelectorAll('input')].find(input=>input.parentElement.textContent.includes('Follow-up title'));change(followupInput,'Call customer');button('Create follow-up').click();await wait();await wait();check(calls.some(c=>c.name==='create_social_hub_followup'&&c.args.p_title==='Call customer'),'Tenant follow-up creation');change(document.querySelector('[aria-label^="Follow-up assignee:"]'),'teammate1');await wait();await wait();check(calls.some(c=>c.name==='mutate_social_hub_followup'&&c.args.p_assigned_to==='teammate1'&&c.args.p_set_assignment===true),'Follow-up team member assignment');button('Mark done').click();await wait();await wait();check(calls.some(c=>c.name==='mutate_social_hub_followup'&&c.args.p_status==='done'),'Follow-up completion');
root.unmount();document.querySelector('#result').textContent='PASS social inbox browser: scope load, channel, actual message, queued reply, assignment, CRM link and follow-up';}
run().catch(e=>{document.querySelector('#result').textContent='FAIL '+e.stack});
`;
  const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'social-inbox-fixture.tsx', loader: 'tsx' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', target: 'es2020', jsx: 'automatic', alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'fixture-preferences', setup(builder) {
      builder.onResolve({ filter: /(?:Auth|Admin|Preferences)Context$/ }, () => ({ path: 'fixture-preferences', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({path:'supabase',namespace:'rpc'}));
      builder.onLoad({filter:/.*/,namespace:'rpc'},()=>({contents:'export const supabase={from:()=>({select:()=>({eq:()=>({eq:()=>({is:()=>({order:()=>({limit:async()=>({data:[{id:\"project1\",title:\"Store\",workspace_id:\"workspace1\"}]})})})})})})}),rpc:(...args)=>globalThis.socialFixture.rpc(...args),auth:{getSession:async()=>({data:{session:{access_token:"fixture-browser-session"}}})}}',loader:'js'}));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export function useAuth(){return {user:globalThis.socialFixture.user}};export function useAdmin(){return {isAdmin:false}};export function usePreferences(){return {prefs:{language:'en'}}}", loader: 'js' }));
    } }] });
  if (process.argv.includes('--check-bundle')) { console.log('PASS social inbox browser fixture compiles'); }
  else {
    let chrome = process.env.CHROME_BIN;
    if (!chrome || !existsSync(chrome)) for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const found = spawnSync('which', [name], { encoding: 'utf8' }); if (found.status === 0) { chrome = found.stdout.trim(); break; }
    }
    if (!chrome) throw new Error('Chrome is required for social inbox browser regression. Set CHROME_BIN.');
    const html = '<!doctype html><html><body><p id="result">RUNNING</p><script src="/fixture.js"></script></body></html>';
    server = createServer((request, response) => { response.setHeader('content-type', request.url === '/fixture.js' ? 'text/javascript' : 'text/html'); response.end(request.url === '/fixture.js' ? result.outputFiles[0].text : html); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const output = await new Promise((resolve, reject) => {
      const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--dump-dom', '--virtual-time-budget=5000', `--user-data-dir=${dir}`, `http://127.0.0.1:${server.address().port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = ''; const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Social inbox browser timed out')); }, 30_000);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
      child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('exit', code => { clearTimeout(timer); code ? reject(new Error(stderr)) : resolve(stdout); });
    });
    const marker = /<p id="result">([\s\S]*?)<\/p>/.exec(output)?.[1];
    if (!marker?.startsWith('PASS')) throw new Error(marker ?? 'Browser did not return a result');
    console.log(marker);
  }
} finally { await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(dir, { recursive: true, force: true }); }
