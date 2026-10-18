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
const scope={id:'scope1',kind:'customer',enabled:true,automation_enabled:false};
const inbox={scope,connections:[{id:'conn1',channel:'telegram',external_account_id:'bot1',status:'connected'}],conversations:[{id:'conv1',connection_id:'conn1',external_id:'chat1',status:'open',assigned_to:null,updated_at:'2026-10-18'}],messages:[{id:'m1',conversation_id:'conv1',direction:'inbound',text:'Opening hours?',created_at:'2026-10-18'}],notes:[]};
globalThis.socialFixture.rpc=async(name,args)=>{calls.push({name,args}); if(name==='get_social_hub_assistant_settings')return {data:null};if(name==='list_social_hub_scopes')return {data:[scope]};if(name==='get_social_hub_inbox')return {data:inbox};if(name==='enqueue_social_hub_message')return {data:'job1'};if(name==='mutate_social_hub_conversation')return {data:true};throw Error('unknown RPC')};
globalThis.fetch=async(url,options)=>{check(url==='/api/social-assistant','Fixed assistant destination');check(JSON.stringify(JSON.parse(options.body))===JSON.stringify({scopeId:'scope1',conversationId:'conv1',messageId:'m1'}),'Assistant accepts identifiers only');return new Response(JSON.stringify({decision:{kind:'suggestion',messageId:'m1',text:'Open at 09:00'}}));};
const check=(v,m)=>{if(!v)throw Error(m)};
const wait=()=>new Promise(r=>setTimeout(r,30));
const change=(control,value)=>{Object.getOwnPropertyDescriptor(control instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype,'value').set.call(control,value);control.dispatchEvent(new Event(control instanceof HTMLSelectElement?'change':'input',{bubbles:true}))};
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
async function run(){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);root.render(<SocialHubTool darkMode={false}/>);await wait();await wait();
change(document.querySelector('[aria-label="Account scope"]'),'scope1');await wait();await wait();
const conversation=document.querySelector('nav button');check(conversation.textContent.includes('telegram'),'Channel visible');conversation.click();await wait();
check(document.querySelector('[role="log"]').textContent.includes('Opening hours?'),'Actual message visible');
button('Suggest reply').click();await wait();await wait();button('Use suggestion in draft').click();await wait();
check(document.querySelector('textarea').value==='Open at 09:00','Suggestion fills draft');check(!calls.some(c=>c.name==='enqueue_social_hub_message'),'Suggestion never sends');
change(document.querySelector('textarea'),'Open at 09:00');await wait();button('Queue reply').click();await wait();await wait();
check(calls.some(c=>c.name==='enqueue_social_hub_message'&&c.args.p_text==='Open at 09:00'&&c.args.p_idempotency_key),'Queue with idempotency');
check(document.body.textContent.includes('Reply queued'),'No delivery claim');
button('Assign to me').click();await wait();await wait();check(calls.some(c=>c.name==='mutate_social_hub_conversation'&&c.args.p_assigned_to==='user1'),'Existing user assignment');
root.unmount();document.querySelector('#result').textContent='PASS social inbox browser: scope load, channel, actual message, queued reply, assignment';}
run().catch(e=>{document.querySelector('#result').textContent='FAIL '+e.stack});
`;
  const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'social-inbox-fixture.tsx', loader: 'tsx' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', target: 'es2020', jsx: 'automatic', alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'fixture-preferences', setup(builder) {
      builder.onResolve({ filter: /(?:Auth|Admin|Preferences)Context$/ }, () => ({ path: 'fixture-preferences', namespace: 'fixture' }));
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({path:'supabase',namespace:'rpc'}));
      builder.onLoad({filter:/.*/,namespace:'rpc'},()=>({contents:'export const supabase={rpc:(...args)=>globalThis.socialFixture.rpc(...args),auth:{getSession:async()=>({data:{session:{access_token:"fixture-browser-session"}}})}}',loader:'js'}));
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
