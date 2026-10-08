import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

const findChrome = () => {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync('which', [name], { encoding: 'utf8' }); if (result.status === 0) return result.stdout.trim();
  }
  throw new Error('Chrome is required for the data view browser regression. Set CHROME_BIN.');
};
const dir = await mkdtemp(join(tmpdir(), 'tayar-data-view-browser-'));
let server;
try {
  const chrome = findChrome();
  const fixture = `import { mountApplicationDataView } from './src/modules/website-builder/browser/application-data-view';
import { ApplicationBookingRejected } from './src/modules/website-builder/core/application-booking';
const check=(value,message)=>{if(!value)throw Error(message)};
const wait=async fn=>{for(let n=0;n<400;n++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10))}throw Error('Timed out')};
const owner='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ids=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd'];
const fields=[{id:'record_name',key:'name',name:'Name',type:'text',required:true},{id:'record_active',key:'active',name:'Active',type:'boolean',required:true},{id:'record_state',key:'state',name:'State',type:'enum',required:true,options:['open','closed']},{id:'record_date',key:'date',name:'Date',type:'datetime',required:false}];
const app={version:1,roles:[{id:'admin',name:'Admin'}],pageAccess:[],auth:{enabled:true,signUpEnabled:true,emailVerificationRequired:true},tables:[{id:'records',key:'records',name:'Records',fields,permissions:[...['read','create','update'].map(operation=>({operation,access:'owner'})),{operation:'delete',access:'role',roleId:'admin'}]}]};
const binding={tableId:'records',columns:fields.map(field=>field.id),actions:['create','update','delete'],pageSize:2,searchFieldId:'record_name'};
const copies={en:{add:'Add record',edit:'Edit',save:'Save',next:'Next',search:'Search',remove:'Delete',refresh:'Refresh'},ar:{add:'إضافة سجل',edit:'تعديل',save:'حفظ',next:'التالي',search:'بحث',remove:'حذف',refresh:'تحديث'},sv:{add:'Lägg till post',edit:'Redigera',save:'Spara',next:'Nästa',search:'Sök',remove:'Ta bort',refresh:'Uppdatera'}};
async function run(){
 for(const language of ['en','ar','sv']){
  let rows=ids.map((id,index)=>({id,owner_id:owner,name:'Record '+index,active:false,state:'open',date:'2026-10-09T12:34:56.789Z'})),userId=owner,roles=[],writes=0;
  const requests=new Map();
  const runtime={auth:{currentUser:async()=>({id:userId,is_anonymous:false}),currentRoles:async()=>roles},list:async(_id,options)=>{let filtered=rows;if(options.filters.length){const q=options.filters[0].value.slice(1,-1).split(String.fromCharCode(92)).join('').toLowerCase();filtered=rows.filter(row=>row.name.toLowerCase().includes(q))}return filtered.slice(options.offset,options.offset+options.limit)},createOnce:async(_id,values,requestId)=>{writes++;if(!requests.has(requestId)){requests.set(requestId,true);rows.unshift({...values,id:crypto.randomUUID(),owner_id:owner})}return 'created'},update:async(_id,id,values)=>{writes++;Object.assign(rows.find(row=>row.id===id),values)},remove:async(_id,id)=>{writes++;rows=rows.filter(row=>row.id!==id)}};
  const host=document.createElement('div');document.body.append(host);const dispose=mountApplicationDataView(host,app,binding,runtime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'dashboard',sectionId:'records'});const root=host.shadowRoot;const copy=copies[language];
  const idle=()=>wait(()=>root.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const button=text=>[...root.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  await idle();check(root.querySelectorAll('tbody tr').length===2,'page size');check(!button(copy.remove),'role-protected delete hidden');check(root.querySelector('.view').dir===(language==='ar'?'rtl':'ltr'),'direction');
  button(copy.next).click();await idle();check(root.querySelectorAll('tbody tr').length===1,'next page');
  button(copy.add).click();let form=root.querySelector('.editor form');form.elements.name.value='<img src=x onerror="window.recordXss=true">';form.elements.active.value='false';form.elements.state.value='closed';form.requestSubmit();await idle();
  check(writes===1&&rows.length===4,'create persists');
  const search=root.querySelector('input[type=search]');search.value='<img';search.closest('form').requestSubmit();await idle();check(root.querySelectorAll('tbody tr').length===1,'search results');check(!root.querySelector('tbody img')&&!window.recordXss,'record content is text');
  button(copy.edit).click();form=root.querySelector('.editor form');form.elements.name.value='Edited';form.requestSubmit();await idle();check(rows[0].name==='Edited'&&rows[0].active===false,'edit preserves false values');
  search.value='Record 0';search.closest('form').requestSubmit();await idle();button(copy.edit).click();form=root.querySelector('.editor form');check(form.elements.date.value.endsWith('56.789'),'datetime precision retained');form.requestSubmit();await idle();check(rows.find(row=>row.id===ids[0]).date==='2026-10-09T12:34:56.789Z','unchanged datetime round trip');
  roles=['admin'];button(copy.refresh).click();await idle();const remove=button(copy.remove);check(remove,'role enables delete');window.confirm=()=>false;remove.click();check(rows.length===4,'cancel deletion');window.confirm=()=>true;remove.click();await idle();check(rows.length===3,'confirmed deletion');
  userId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';button(copy.refresh).click();await idle();check(root.querySelectorAll('tbody tr').length===0&&!root.querySelector('.editor form'),'account switch clears records');
  dispose();check(!root.childNodes.length,'disposal removes private UI');host.remove();
  const bookingFields=[{id:'resource',key:'resource_id',name:'Resource',type:'uuid',required:true},{id:'start',key:'starts_at',name:'Start',type:'datetime',required:true},{id:'end',key:'ends_at',name:'End',type:'datetime',required:true}];
  const bookingApp={...app,roles:[],tables:[{id:'bookings',key:'bookings',name:'Bookings',fields:bookingFields,permissions:['read','create','update'].map(operation=>({operation,access:'owner'})),booking:{resourceFieldId:'resource',startFieldId:'start',endFieldId:'end'}}]};
  let bookingWrites=0,bookings=[];
  const bookingRuntime={auth:{currentUser:async()=>({id:owner,is_anonymous:false}),currentRoles:async()=>[]},list:async()=>bookings,createOnce:async(_id,values)=>{bookingWrites++;if(bookingWrites===1)throw new ApplicationBookingRejected('conflict');bookings.push({...values,id:ids[0]});return 'created'},update:async()=>{throw new ApplicationBookingRejected('conflict')},remove:async()=>{}};
  const bookingHost=document.createElement('div');document.body.append(bookingHost);
  const stopBooking=mountApplicationDataView(bookingHost,bookingApp,{tableId:'bookings',columns:bookingFields.map(field=>field.id),actions:['create','update'],pageSize:10},bookingRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'booking',sectionId:'bookings'});
  const bookingRoot=bookingHost.shadowRoot,bookingIdle=()=>wait(()=>bookingRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const bookingButton=text=>[...bookingRoot.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  const conflict={en:'This resource is already booked for that time. Choose another time.',ar:'هذا المورد محجوز في الوقت المحدد. اختر وقتًا آخر.',sv:'Resursen är redan bokad den tiden. Välj en annan tid.'}[language];
  const interval={en:'Booking end must be after start.',ar:'يجب أن يكون انتهاء الحجز بعد بدايته.',sv:'Bokningens slut måste vara efter starten.'}[language];
  await bookingIdle();bookingButton(copy.add).click();let bookingForm=bookingRoot.querySelector('.editor form');
  bookingForm.elements.resource_id.value=ids[1];bookingForm.elements.starts_at.value='2026-10-09T10:00';bookingForm.elements.ends_at.value='2026-10-09T09:00';bookingForm.requestSubmit();await bookingIdle();
  check(bookingWrites===0&&bookingRoot.querySelector('[role=status]').textContent===interval,'invalid interval rejected locally with translated message');
  bookingForm.elements.ends_at.value='2026-10-09T11:00';bookingForm.requestSubmit();await bookingIdle();
  check(bookingWrites===1&&bookingRoot.querySelector('[role=status]').textContent===conflict,'database conflict message');
  bookingForm.elements.starts_at.value='2026-10-09T12:00';bookingForm.elements.ends_at.value='2026-10-09T13:00';bookingForm.requestSubmit();await bookingIdle();
  check(bookings.length===1&&bookingWrites===2,'corrected rejected booking saves once');
  bookingButton(copy.edit).click();bookingRoot.querySelector('.editor form').requestSubmit();await bookingIdle();
  check(bookingRoot.querySelector('[role=status]').textContent===conflict&&bookings.length===1,'edit conflict retains editor without success');
  stopBooking();bookingHost.remove();

 }
}
run().then(()=>document.querySelector('#result').textContent='PASS application data view browser CRUD / search / pagination / role controls / XSS / datetime / booking conflicts / account switch in en-ar-sv').catch(error=>document.querySelector('#result').textContent='FAIL '+error.stack);`;
  const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'data-view-fixture.ts' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', target: 'es2020', alias: { '@': resolve('src') } });
  const html = '<!doctype html><html><body><p id="result">RUNNING</p><script src="/fixture.js"></script></body></html>';
  server = createServer((req, res) => { res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html'); res.end(req.url === '/fixture.js' ? result.outputFiles[0].text : html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const output = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--dump-dom', '--virtual-time-budget=15000', `--user-data-dir=${dir}`, url], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Data view browser timed out')); }, 35_000);
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
    child.on('error', error => { clearTimeout(timer); reject(error); }); child.on('exit', code => { clearTimeout(timer); if (code) reject(new Error(stderr)); else resolve(stdout); });
  });
  const marker = /<p id="result">([\s\S]*?)<\/p>/.exec(output)?.[1];
  if (!marker?.startsWith('PASS')) throw new Error(marker ?? 'Browser did not return a result');
  console.log(marker);
} finally { await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(dir, { recursive: true, force: true }); }
