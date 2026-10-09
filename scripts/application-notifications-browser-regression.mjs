import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

const dir = await mkdtemp(join(tmpdir(), 'tayar-notifications-browser-'));
let server;
try {
  const fixture = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {BuilderApplicationNotificationsRule} from './src/modules/website-builder/v2-ui/BuilderApplicationNotificationsRule';
import {setEditorIntegrationsHostConfig} from './src/modules/website-builder/core/editor-integrations-host-store';
import {localizeUi} from './src/lib/ui-localization-cms';
const check=(value,message)=>{if(!value)throw Error(message)};
const project='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const connection={id:'mail',providerId:'resend',name:'Customer mail',enabled:true,status:'configured',environments:['production'],config:{from:'receipts@example.com'},secrets:{apiKey:{ref:'secret://website/'+project+'/mail/apiKey/production',updatedAt:'2026-10-09T10:00:00Z'}},events:[],createdAt:'2026-10-09T10:00:00Z',updatedAt:'2026-10-09T10:00:00Z'};
const base={id:'orders',key:'orders',name:'Orders',fields:[{id:'title',key:'title',name:'Title',type:'text',required:true},{id:'state',key:'state',name:'State',type:'enum',required:true,options:['pending','confirmed']}],permissions:['read','create','update'].map(operation=>({operation,access:'owner'})),workflow:{fieldId:'state',transitions:[{id:'confirm',label:'Confirm',from:['pending'],to:'confirmed',access:'owner'}]}};
function run(){for(const language of ['en','ar','sv']){
  globalThis.fixtureLanguage=language;let saved=base;
  flushSync(()=>setEditorIntegrationsHostConfig({version:1,connections:[connection]}));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  function App(){const [table,setTable]=useState(base);return <BuilderApplicationNotificationsRule key={JSON.stringify(table)} table={table} onSave={notifications=>{saved={...table};if(notifications)saved.notifications=notifications;else delete saved.notifications;setTable(saved)}}/>}
  flushSync(()=>root.render(<App/>));
  const label=text=>[...host.querySelectorAll('label')].find(item=>item.textContent.startsWith(localizeUi(text,language)));
  const button=text=>[...host.querySelectorAll('button')].find(item=>item.textContent===localizeUi(text,language));
  const change=(control,value)=>flushSync(()=>{const proto=control instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:control instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(control,value);control.dispatchEvent(new Event(control instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});
  const click=text=>flushSync(()=>button(text).click());
  check(button('Save notification').disabled,'Incomplete rule must not save');
  change(label('Email connection').querySelector('select'),'mail');
  change(label('Email subject').querySelector('input'),'Booking {{field:title}}');
  change(label('Email message').querySelector('textarea'),'Record {{record.id}}');
  check(!button('Save notification').disabled,'Valid owner rule must save');click('Save notification');
  check(saved.notifications.length===1 && saved.notifications[0].event.type==='created','Creation rule must persist');
  check(!('from' in saved.notifications[0])&&!('secrets' in saved.notifications[0]),'Rules contain configuration only');
  const originalId=saved.notifications[0].id;click('Edit notification');
  change(label('Notification event').querySelector('select'),'transition:confirm');
  change(label('Email subject').querySelector('input'),'{{field:missing}}');
  check(button('Save notification').disabled && host.querySelector('[role=alert]'),'Unknown variable must reject');
  change(label('Email subject').querySelector('input'),'Confirmed');click('Save notification');
  check(saved.notifications.length===1&&saved.notifications[0].id===originalId&&saved.notifications[0].event.transitionId==='confirm','Edit must retain identity and workflow event');
  click('Edit notification');flushSync(()=>setEditorIntegrationsHostConfig({version:1,connections:[{...connection,enabled:false}]}));
  check(button('Save notification').disabled,'Live connection disable must invalidate draft');
  flushSync(()=>setEditorIntegrationsHostConfig({version:1,connections:[{...connection,events:['form.submitted']}]}));
  check(button('Save notification').disabled,'Generic producer and SQL producer must not overlap');
  click('Remove notification');check(!saved.notifications,'Last removal clears optional definition');
  flushSync(()=>root.unmount());host.remove();
}}
try{run();document.querySelector('#result').textContent='PASS notification editor: create/edit/delete, owner templates, live connection changes and dual-producer guard in en-ar-sv'}catch(error){document.querySelector('#result').textContent='FAIL '+error.stack}
`;
  const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'notifications-fixture.tsx', loader: 'tsx' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', target: 'es2020', alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'fixture-preferences', setup(builder) {
      builder.onResolve({ filter: /PreferencesContext$/ }, () => ({ path: 'fixture-preferences', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export function usePreferences(){return {prefs:{language:globalThis.fixtureLanguage}}}', loader: 'js' }));
    } }] });
  if (process.argv.includes('--check-bundle')) { console.log('PASS notification browser fixture compiles'); }
  else {
    let chrome = process.env.CHROME_BIN;
    if (!chrome || !existsSync(chrome)) for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
      const found = spawnSync('which', [name], { encoding: 'utf8' }); if (found.status === 0) { chrome = found.stdout.trim(); break; }
    }
    if (!chrome) throw new Error('Chrome is required for notification browser regression. Set CHROME_BIN.');
    const html = '<!doctype html><html><body><p id="result">RUNNING</p><script src="/fixture.js"></script></body></html>';
    server = createServer((request, response) => { response.setHeader('content-type', request.url === '/fixture.js' ? 'text/javascript' : 'text/html'); response.end(request.url === '/fixture.js' ? result.outputFiles[0].text : html); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const output = await new Promise((resolve, reject) => {
      const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--dump-dom', '--virtual-time-budget=5000', `--user-data-dir=${dir}`, `http://127.0.0.1:${server.address().port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = ''; const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Notification browser timed out')); }, 30_000);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
      child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('exit', code => { clearTimeout(timer); code ? reject(new Error(stderr)) : resolve(stdout); });
    });
    const marker = /<p id="result">([\s\S]*?)<\/p>/.exec(output)?.[1];
    if (!marker?.startsWith('PASS')) throw new Error(marker ?? 'Browser did not return a result');
    console.log(marker);
  }
} finally { await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(dir, { recursive: true, force: true }); }
