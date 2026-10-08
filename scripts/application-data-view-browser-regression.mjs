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
import { ApplicationCounterRejected } from './src/modules/website-builder/core/application-counter';
import { ApplicationTransactionRejected } from './src/modules/website-builder/core/application-transaction';
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
  const bookingFields=[{id:'resource',key:'resource_id',name:'Resource',type:'reference',referenceTableId:'resources',required:true},{id:'start',key:'starts_at',name:'Start',type:'datetime',required:true},{id:'end',key:'ends_at',name:'End',type:'datetime',required:true}];
  const bookingApp={...app,roles:[],tables:[{id:'bookings',key:'bookings',name:'Bookings',fields:bookingFields,permissions:['read','create','update'].map(operation=>({operation,access:'owner'})),booking:{resourceFieldId:'resource',startFieldId:'start',endFieldId:'end'}}]};
  bookingApp.tables.push({id:'resources',key:'resources',name:'Rooms',fields:[{id:'room_name',key:'name',name:'Room',type:'text',required:true}],permissions:[{operation:'read',access:'authenticated'}]});
  const roomRows=Array.from({length:25},(_,index)=>({id:index===0?ids[1]:String(index).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:index===1?'<img src=x onerror="window.referenceXss=true">':'Room '+index}));
  let bookingWrites=0,bookings=[],lookupUser=owner;
  const bookingRuntime={auth:{currentUser:async()=>({id:lookupUser,is_anonymous:false}),currentRoles:async()=>[]},list:async(tableId,options)=>tableId==='resources'?(options.filters.length?roomRows.filter(row=>row.name==='Room 24'):roomRows).slice(options.offset,options.offset+options.limit):bookings,createOnce:async(_id,values)=>{bookingWrites++;if(bookingWrites===1)throw new ApplicationBookingRejected('conflict');bookings.push({...values,id:ids[0]});return 'created'},update:async()=>{throw new ApplicationBookingRejected('conflict')},remove:async()=>{}};
  const bookingHost=document.createElement('div');document.body.append(bookingHost);
  const stopBooking=mountApplicationDataView(bookingHost,bookingApp,{tableId:'bookings',columns:bookingFields.map(field=>field.id),actions:['create','update'],pageSize:10},bookingRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'booking',sectionId:'bookings'});
  const bookingRoot=bookingHost.shadowRoot,bookingIdle=()=>wait(()=>bookingRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const bookingButton=text=>[...bookingRoot.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  const conflict={en:'This resource is already booked for that time. Choose another time.',ar:'هذا المورد محجوز في الوقت المحدد. اختر وقتًا آخر.',sv:'Resursen är redan bokad den tiden. Välj en annan tid.'}[language];
  const interval={en:'Booking end must be after start.',ar:'يجب أن يكون انتهاء الحجز بعد بدايته.',sv:'Bokningens slut måste vara efter starten.'}[language];
  await bookingIdle();bookingButton(copy.add).click();let bookingForm=bookingRoot.querySelector('.editor form');
  await wait(()=>bookingForm.elements.resource_id.options.length===21&&!bookingForm.elements.resource_id.disabled);
  check(bookingForm.elements.resource_id.options[1].textContent==='Room 0','reference picker uses real resource names');
  check(!bookingRoot.querySelector('.editor img')&&!window.referenceXss,'related labels render as text');
  const refControls=bookingRoot.querySelector('.editor .toolbar');
  const refButton=text=>[...refControls.querySelectorAll('button')].find(button=>button.textContent===text);
  refButton(copy.next).click();await wait(()=>!bookingForm.elements.resource_id.disabled&&bookingForm.elements.resource_id.options.length===6);
  refButton(copies[language].next==='Next'?'Previous':language==='ar'?'السابق':'Föregående').click();await wait(()=>!bookingForm.elements.resource_id.disabled&&bookingForm.elements.resource_id.options.length===21);
  bookingForm.elements.resource_id.value=ids[1];bookingForm.elements.starts_at.value='2026-10-09T10:00';bookingForm.elements.ends_at.value='2026-10-09T09:00';bookingForm.requestSubmit();await bookingIdle();
  check(bookingWrites===0&&bookingRoot.querySelector('[role=status]').textContent===interval,'invalid interval rejected locally with translated message');
  bookingForm.elements.ends_at.value='2026-10-09T11:00';bookingForm.requestSubmit();await bookingIdle();
  check(bookingWrites===1&&bookingRoot.querySelector('[role=status]').textContent===conflict,'database conflict message');
  bookingForm.elements.starts_at.value='2026-10-09T12:00';bookingForm.elements.ends_at.value='2026-10-09T13:00';bookingForm.requestSubmit();await bookingIdle();
  check(bookings.length===1&&bookingWrites===2,'corrected rejected booking saves once');
  bookings[0].resource_id=roomRows[24].id;
  bookingButton(copy.edit).click();bookingForm=bookingRoot.querySelector('.editor form');
  await wait(()=>!bookingForm.elements.resource_id.disabled);
  check(bookingForm.elements.resource_id.value===roomRows[24].id,'saved out-of-page relationship stays selected');
  const editControls=bookingRoot.querySelector('.editor .toolbar'),referenceSearch=editControls.querySelector('input[type=search]');
  referenceSearch.value='Room 24';referenceSearch.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  await wait(()=>!bookingForm.elements.resource_id.disabled&&bookingForm.elements.resource_id.options.length===2);
  check(bookingWrites===2&&bookingForm.elements.resource_id.value===roomRows[24].id&&bookingForm.elements.resource_id.options[1].textContent==='Room 24','search preserves selected ID without submitting booking');
  bookingForm.requestSubmit();await bookingIdle();
  check(bookingRoot.querySelector('[role=status]').textContent===conflict&&bookings.length===1,'edit conflict retains editor without success');
  lookupUser='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  [...editControls.querySelectorAll('button')].find(button=>button.textContent===copy.refresh).click();
  await wait(()=>!bookingRoot.querySelector('.editor form'));
  check(bookingRoot.querySelectorAll('tbody tr').length===0,'relationship lookup account switch clears private UI');
  stopBooking();bookingHost.remove();
  const counterApp={...app,roles:[],tables:[{id:'stock_items',key:'stock_items',name:'Stock items',fields:[{id:'item_name',key:'name',name:'Name',type:'text',required:true},{id:'item_stock',key:'quantity',name:'Quantity',type:'number',required:true,defaultValue:0}],permissions:['read','update'].map(operation=>({operation,access:'owner'})),counter:{fieldId:'item_stock',minimum:0,maximum:100,integer:true}}]};
  let quantity=10,adjustments=0;const counterRequests=new Set();
  const counterRuntime={auth:{currentUser:async()=>({id:owner,is_anonymous:false}),currentRoles:async()=>[]},list:async()=>[{id:ids[0],name:'Generic product',quantity}],adjustCounter:async(_table,id,delta,requestId)=>{if(counterRequests.has(requestId))return 'already-created';if(quantity+delta<0||quantity+delta>100)throw new ApplicationCounterRejected();quantity+=delta;adjustments++;counterRequests.add(requestId);return 'created'},createOnce:async()=>{throw Error('unexpected create')},update:async()=>{},remove:async()=>{}};
  const counterHost=document.createElement('div');document.body.append(counterHost);const stopCounter=mountApplicationDataView(counterHost,counterApp,{tableId:'stock_items',columns:['item_name','item_stock'],actions:['update','adjust'],pageSize:10},counterRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'stock',sectionId:'counter'});
  const counterRoot=counterHost.shadowRoot,counterIdle=()=>wait(()=>counterRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const counterButton=text=>[...counterRoot.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  await counterIdle();counterButton(copy.edit).click();check(counterRoot.querySelector('[name=quantity]').readOnly,'protected quantity cannot be overwritten by normal edit');
  const adjustLabel={en:'Adjust quantity',ar:'تغيير الكمية',sv:'Ändra antal'}[language];counterButton(adjustLabel).click();let counterForm=counterRoot.querySelector('.editor form');
  counterForm.elements.adjustment.value='-11';counterForm.requestSubmit();await counterIdle();
  const boundsCopy={en:'The change exceeds the allowed limits. Choose another amount.',ar:'التغيير يتجاوز الحدود المسموحة. اختر كمية أخرى.',sv:'Ändringen överskrider tillåtna gränser. Välj ett annat antal.'}[language];
  check(quantity===10&&adjustments===0&&counterRoot.querySelector('[role=status]').textContent===boundsCopy,'rejected underflow has localized message');
  counterForm.elements.adjustment.value='-3';counterForm.requestSubmit();await counterIdle();check(quantity===7&&adjustments===1,'corrected generic stock adjustment persists');
  stopCounter();counterHost.remove();
  const transactionProducts={id:'transaction_products',key:'transaction_products',name:'Products',fields:[{id:'transaction_name',key:'name',name:'Name',type:'text',required:true},{id:'transaction_stock',key:'quantity',name:'Stock',type:'number',required:true,defaultValue:0}],permissions:[{operation:'read',access:'authenticated'},{operation:'update',access:'authenticated'}],counter:{fieldId:'transaction_stock',minimum:0,maximum:100,integer:true}};
  const transactionOrders={id:'transaction_orders',key:'transaction_orders',name:'Orders',fields:[{id:'transaction_note',key:'note',name:'Note',type:'text',required:true}],permissions:[{operation:'read',access:'owner'},{operation:'create',access:'owner'}],transaction:{itemTableId:'transaction_products',lineTableId:'transaction_lines',lineTransactionFieldId:'transaction_line_order',lineItemFieldId:'transaction_line_item',lineQuantityFieldId:'transaction_line_quantity',counterDirection:'decrement'}};
  const transactionLines={id:'transaction_lines',key:'transaction_lines',name:'Lines',fields:[{id:'transaction_line_order',key:'order_id',name:'Order',type:'reference',required:true,referenceTableId:'transaction_orders'},{id:'transaction_line_item',key:'product_id',name:'Product',type:'reference',required:true,referenceTableId:'transaction_products'},{id:'transaction_line_quantity',key:'quantity',name:'Quantity',type:'number',required:true}],permissions:[{operation:'read',access:'owner'}]};
  const transactionApp={...app,roles:[],tables:[transactionProducts,transactionOrders,transactionLines]};
  let transactionRows=[],transactionCalls=0;const transactionItems=[{id:ids[0],name:'Product A',quantity:5},{id:ids[1],name:'<img src=x onerror="window.transactionXss=true">',quantity:4}],transactionReceipts=new Map();
  const transactionRuntime={auth:{currentUser:async()=>({id:owner,is_anonymous:false}),currentRoles:async()=>[]},list:async(tableId,options)=>tableId==='transaction_products'?transactionItems.slice(options.offset,options.offset+options.limit):transactionRows,
    createTransaction:async(_table,values,lines,requestId)=>{transactionCalls++;if(transactionReceipts.has(requestId))return transactionReceipts.get(requestId);if(lines.some(line=>transactionItems.find(item=>item.id===line.itemId).quantity<line.quantity))throw new ApplicationTransactionRejected('bounds');for(const line of lines)transactionItems.find(item=>item.id===line.itemId).quantity-=line.quantity;const result={status:'created',id:crypto.randomUUID()};transactionReceipts.set(requestId,{...result,status:'already-created'});transactionRows.push({...values,id:result.id});return result},createOnce:async()=>{},update:async()=>{},remove:async()=>{},adjustCounter:async()=>{}};
  const transactionHost=document.createElement('div');document.body.append(transactionHost);const stopTransaction=mountApplicationDataView(transactionHost,transactionApp,{tableId:'transaction_orders',columns:['transaction_note'],actions:['transact'],pageSize:10},transactionRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'orders',sectionId:'transactions'});
  const transactionRoot=transactionHost.shadowRoot,transactionIdle=()=>wait(()=>transactionRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const transactionCopy={en:{open:'Create transaction',add:'Add item'},ar:{open:'إنشاء معاملة',add:'إضافة عنصر'},sv:{open:'Skapa transaktion',add:'Lägg till post'}}[language];
  const transactionButton=text=>[...transactionRoot.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  await transactionIdle();transactionButton(transactionCopy.open).click();let transactionForm=transactionRoot.querySelector('.editor form');await wait(()=>transactionForm.querySelector('fieldset select').options.length===2);
  check(!transactionRoot.querySelector('.editor img')&&!window.transactionXss,'transaction item labels render as text');transactionForm.elements.note.value='Order one';
  const itemSelect=transactionForm.querySelector('fieldset select'),itemQuantity=transactionForm.querySelector('fieldset input[type=number]');itemSelect.value=ids[0];itemQuantity.value='2';transactionButton(transactionCopy.add).click();transactionForm.requestSubmit();await transactionIdle();
  check(transactionCalls===1&&transactionItems[0].quantity===3&&transactionRows.length===1,'multi-item transaction persists atomically');
  transactionButton(transactionCopy.open).click();transactionForm=transactionRoot.querySelector('.editor form');await wait(()=>transactionForm.querySelector('fieldset select').options.length===2);transactionForm.elements.note.value='Too much';transactionForm.querySelector('fieldset select').value=ids[1];transactionForm.querySelector('fieldset input[type=number]').value='9';transactionButton(transactionCopy.add).click();transactionForm.requestSubmit();await transactionIdle();
  const transactionBounds={en:'The change exceeds the allowed limits. Choose another amount.',ar:'التغيير يتجاوز الحدود المسموحة. اختر كمية أخرى.',sv:'Ändringen överskrider tillåtna gränser. Välj ett annat antal.'}[language];
  check(transactionCalls===2&&transactionItems[1].quantity===4&&transactionRows.length===1&&transactionRoot.querySelector('[role=status]').textContent===transactionBounds,'multi-item underflow rolls back with localized message');
  stopTransaction();transactionHost.remove();


 }
}
run().then(()=>document.querySelector('#result').textContent='PASS application data view browser CRUD / search / pagination / role controls / XSS / datetime / booking conflicts / reference selectors / generic counters / atomic transactions / account switch in en-ar-sv').catch(error=>document.querySelector('#result').textContent='FAIL '+error.stack);`;
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
