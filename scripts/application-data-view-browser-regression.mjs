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
  const bookingFields=[{id:'resource',key:'resource_id',name:'Resource',type:'reference',referenceTableId:'resources',required:true},{id:'start',key:'starts_at',name:'Start',type:'datetime',required:true},{id:'end',key:'ends_at',name:'End',type:'datetime',required:true},{id:'status',key:'status',name:'State',type:'enum',required:true,options:['confirmed','waiting'],defaultValue:'confirmed'}];
  const bookingApp={...app,roles:[],tables:[{id:'bookings',key:'bookings',name:'Bookings',fields:bookingFields,permissions:['read','create','update'].map(operation=>({operation,access:'owner'})),booking:{resourceFieldId:'resource',startFieldId:'start',endFieldId:'end',statusFieldId:'status',blockingStatuses:['confirmed'],waitlistStatus:'waiting'}}]};
  bookingApp.tables.push({id:'resources',key:'resources',name:'Rooms',fields:[{id:'room_name',key:'name',name:'Room',type:'text',required:true}],permissions:[{operation:'read',access:'authenticated'}]});
  const roomRows=Array.from({length:25},(_,index)=>({id:index===0?ids[1]:String(index).padStart(8,'0')+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:index===1?'<img src=x onerror="window.referenceXss=true">':'Room '+index}));
  let bookingWrites=0,availabilityChecks=0,bookings=[],lookupUser=owner;
  const bookingRuntime={bookingAvailable:async(_id,values,pinned)=>{check(pinned===owner&&values.resource_id===ids[1],'availability uses pinned identity and selected resource');return ++availabilityChecks>1},auth:{currentUser:async()=>({id:lookupUser,is_anonymous:false}),currentRoles:async()=>[]},list:async(tableId,options)=>tableId==='resources'?(options.filters.length?roomRows.filter(row=>row.name==='Room 24'):roomRows).slice(options.offset,options.offset+options.limit):bookings,createOnce:async(_id,values)=>{bookingWrites++;if(bookingWrites===1)throw new ApplicationBookingRejected('conflict');bookings.push({...values,id:ids[0]});return 'created'},update:async()=>{throw new ApplicationBookingRejected('conflict')},remove:async()=>{}};
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
  bookingForm.elements.ends_at.value='2026-10-09T11:00';
  const checkAvailability={en:'Check availability',ar:'فحص الإتاحة',sv:'Kontrollera tillgänglighet'}[language];
  // Use actual localized button copy; no writes while probing or selecting a waiting state.
  const availabilityButton=[...bookingForm.querySelectorAll('button')].find(item=>item.textContent===checkAvailability);
  check(availabilityButton,'localized availability control');availabilityButton.click();await bookingIdle();
  check(availabilityChecks===1&&bookingWrites===0&&bookingForm.textContent.includes({en:'This interval is unavailable.',ar:'الفترة غير متاحة.',sv:'Intervallet är inte ledigt.'}[language]),'hidden occupancy is a boolean, not a row disclosure');
  availabilityButton.click();await bookingIdle();check(availabilityChecks===2&&bookingWrites===0,'availability checks remain read only');
  bookingForm.elements.ends_at.dispatchEvent(new Event('input',{bubbles:true}));check(bookingForm.querySelector('[role=status]').textContent==='','editing clears stale availability');
  const waitText={en:'Join waiting list',ar:'الانضمام لقائمة الانتظار',sv:'Gå med i väntelistan'}[language];
  const waitButton=[...bookingForm.querySelectorAll('button')].find(item=>item.textContent===waitText);
  check(waitButton,'waiting-list control');waitButton.click();check(bookingForm.elements.status.value==='waiting'&&bookingWrites===0,'waiting state must be explicitly saved');
  bookingForm.elements.status.value='confirmed';
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
  const seriesApp=structuredClone(bookingApp);seriesApp.tables[0].booking.recurrence={timeZone:'Europe/Stockholm',maxOccurrences:12};
  let seriesCalls=0,seriesRows=[],seriesUser=owner;
  const seriesRuntime={...bookingRuntime,auth:{currentUser:async()=>({id:seriesUser,is_anonymous:false}),currentRoles:async()=>[]},
    list:async(tableId)=>tableId==='resources'?roomRows:seriesRows,
    createBookingSeries:async(_table,values,repeat,_request,expected)=>{check(expected===owner,'series pins identity');check(repeat.count===3&&repeat.frequency==='weekly'&&repeat.interval===1,'series controls pass recurrence');seriesCalls++;if(seriesCalls===1)throw new ApplicationBookingRejected('conflict');seriesRows=[{...values,id:ids[0]}];return 'created'}};
  const seriesHost=document.createElement('div');document.body.append(seriesHost);
  const stopSeries=mountApplicationDataView(seriesHost,seriesApp,{tableId:'bookings',columns:bookingFields.map(field=>field.id),actions:['create'],pageSize:10},seriesRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'recurrence',sectionId:'series'});
  const seriesRoot=seriesHost.shadowRoot,seriesIdle=()=>wait(()=>seriesRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const seriesButton=text=>[...seriesRoot.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  await seriesIdle();seriesButton(copy.add).click();let seriesForm=seriesRoot.querySelector('.editor form');
  await wait(()=>!seriesForm.elements.resource_id.disabled&&seriesForm.elements.resource_id.options.length>1);
  seriesForm.elements.resource_id.value=ids[1];seriesForm.elements.starts_at.value='2026-10-24T10:00';seriesForm.elements.ends_at.value='2026-10-24T11:00';
  const repeatToggle=seriesForm.querySelector('input[type=checkbox]'),repeatNumbers=seriesForm.querySelectorAll('fieldset input[type=number]');
  repeatToggle.checked=true;repeatToggle.dispatchEvent(new Event('change'));repeatNumbers[0].value='99';
  check(!seriesForm.checkValidity(),'repeat count is bounded');repeatToggle.checked=false;repeatToggle.dispatchEvent(new Event('change'));
  check(seriesForm.checkValidity(),'disabled repeat controls cannot block a single booking');repeatToggle.checked=true;repeatToggle.dispatchEvent(new Event('change'));repeatNumbers[0].value='3';
  seriesForm.requestSubmit();await seriesIdle();check(seriesCalls===1&&seriesRoot.querySelector('[role=status]').textContent===conflict,'series conflict retains localized feedback');
  seriesForm.elements.starts_at.value='2026-10-24T12:00';seriesForm.elements.ends_at.value='2026-10-24T13:00';seriesForm.requestSubmit();await seriesIdle();
  check(seriesCalls===2&&seriesRows.length===1&&!seriesRoot.querySelector('.editor form'),'corrected series saves through series runtime');stopSeries();seriesHost.remove();
  const reportApp=structuredClone(app);reportApp.tables[0].fields.push({id:'amount',key:'amount',name:'Amount',type:'number',required:true});
  reportApp.tables[0].reports=[{id:'total',name:'<img src=x onerror="window.reportXss=true">',operation:'sum',fieldId:'amount',groupByFieldId:'record_state',period:{fieldId:'record_date',unit:'month',timeZone:'Europe/Stockholm',offset:0,comparePrevious:true}}];
  let reportUser=owner,reportFailure=false,reportSwitch=false;
  const reportRuntime={...runtime,auth:{currentUser:async()=>({id:reportUser,is_anonymous:false}),currentRoles:async()=>[]},list:async()=>[{id:ids[0],name:'Report row',active:false,state:'open',amount:1}],
    reports:async(_table,expected)=>{check(expected===owner,'report pins identity');if(reportFailure)throw Error('offline');if(reportSwitch)reportUser=ids[1];return [{id:'total',name:reportApp.tables[0].reports[0].name,value:'9007199254740993.01',previousValue:'0.99',groups:[{key:'<img src=x onerror="window.reportXss=true">',value:'9007199254740993.01',previousValue:'0.99'}],truncated:false}]}};
  const reportHost=document.createElement('div');document.body.append(reportHost);
  const stopReport=mountApplicationDataView(reportHost,reportApp,{...binding,actions:[]},reportRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'reports',sectionId:'totals'});
  const reportRoot=reportHost.shadowRoot,reportIdle=()=>wait(()=>reportRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const refreshReport=()=>[...reportRoot.querySelectorAll('button')].find(button=>button.textContent===copy.refresh).click();
  await reportIdle();check(reportRoot.querySelector('section').textContent.includes('9007199254740993.01'),'large decimal total stays exact');
  refreshReport();await reportIdle();check(reportRoot.querySelector('section').textContent.includes('9007199254740992.02'),'exact period difference');
  check(reportRoot.querySelector('section table td').textContent.includes('<img'),'group label remains text');
  const originalObjectURL=URL.createObjectURL,originalLinkClick=HTMLAnchorElement.prototype.click;let exported;
  URL.createObjectURL=blob=>{exported=blob;return originalObjectURL(blob)};HTMLAnchorElement.prototype.click=function(){check(this.download==='application-report.json','report export filename')};
  const downloadReport=[...reportRoot.querySelectorAll('button')].find(button=>button.textContent.includes('(JSON)'));downloadReport.click();await reportIdle();
  const json=JSON.parse(await exported.text());check(json.reports[0].value==='9007199254740993.01'&&json.definitions[0].period.timeZone==='Europe/Stockholm','authorized JSON keeps exact decimals and period definition');
  URL.createObjectURL=originalObjectURL;HTMLAnchorElement.prototype.click=originalLinkClick;
  check(!reportRoot.querySelector('section img')&&!window.reportXss,'report names render as text');reportFailure=true;refreshReport();await reportIdle();
  check(!reportRoot.querySelector('section').textContent.includes('9007199254740993.01'),'failed refresh clears stale totals');
  reportFailure=false;reportSwitch=true;refreshReport();await reportIdle();check(reportRoot.querySelectorAll('tbody tr').length===0&&reportRoot.querySelector('section').hidden,'account switch during reports clears private rows and totals');stopReport();reportHost.remove();
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
  const stockApp=structuredClone(counterApp);stockApp.tables[0].stockReservations=true;
  let stockActor=owner,stockFailure=false,stockSwitch=false,stockQueries=0;
  const stockRuntime={...counterRuntime,auth:{currentUser:async()=>({id:stockActor,is_anonymous:false}),currentRoles:async()=>[]},
    stockReservations:(tableId,actor)=>{check(tableId==='stock_items'&&actor===owner,'stock UI binds its declared table and permanent actor');return{available:async id=>{check(id===ids[0],'stock query targets the selected row');stockQueries++;if(stockFailure)throw Error('private provider detail');if(stockSwitch)stockActor=ids[1];return quantity-2}}}};
  const stockHost=document.createElement('div');document.body.append(stockHost);
  const stockBinding={tableId:'stock_items',columns:['item_name','item_stock'],actions:['stock-availability'],pageSize:10};
  const stopStock=mountApplicationDataView(stockHost,stockApp,stockBinding,stockRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'stock',sectionId:'availability'});
  const stockRoot=stockHost.shadowRoot,stockIdle=()=>wait(()=>stockRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const stockLabel={en:'Available stock',ar:'المخزون المتاح',sv:'Tillgängligt lager'}[language];
  const stockButton=()=>[...stockRoot.querySelectorAll('button')].find(button=>button.textContent===stockLabel);
  await stockIdle();stockButton().click();await stockIdle();
  check(stockRoot.querySelector('[role=status]').textContent.includes(': 5.')&&stockQueries===1,'availability comes from the stock RPC, not the stocked quantity field');
  stockFailure=true;stockButton().click();await stockIdle();
  check(!stockRoot.querySelector('[role=status]').textContent.includes(': 5.')&&!stockRoot.textContent.includes('private provider detail'),'failed stock query clears stale quantity and hides provider details');
  stockFailure=false;stockSwitch=true;stockButton().click();await stockIdle();
  check(stockRoot.querySelectorAll('tbody tr').length===0,'stock actor switch clears private rows instead of showing a late quantity');
  stopStock();stockHost.remove();
  stockActor=owner;
  let reserveCalls=[],settleCalls=[],lostHold=true,lostFulfill=true;
  const holdRuntime={...stockRuntime,stockReservations:(_table,actor)=>{
    check(actor===owner,'hold controls bind the permanent owner');
    return {available:async()=>5,reserve:async(...args)=>{reserveCalls.push(args);if(lostHold){lostHold=false;throw Error('provider-secret')}return 'already-reserved'},
      settle:async(...args)=>{settleCalls.push(args);if(lostFulfill){lostFulfill=false;throw Error('provider-secret')}return 'already-fulfilled'}}}};
  const holdHost=document.createElement('div');document.body.append(holdHost);
  const holdScope={projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'stock',sectionId:'hold-'+language};
  const holdBinding={...stockBinding,actions:['stock-reservation']};
  let stopHold=mountApplicationDataView(holdHost,stockApp,holdBinding,holdRuntime,language,holdScope);
  let holdRoot=holdHost.shadowRoot;await wait(()=>holdRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const holdLabels={en:['Manage stock hold','Reserve stock','Fulfill hold'],ar:['إدارة حجز المخزون','حجز المخزون','تسليم الحجز'],sv:['Hantera lagerreservation','Reservera lager','Slutför reservation']}[language];
  const holdButton=text=>[...holdRoot.querySelectorAll('button')].find(b=>b.textContent===text&&!b.disabled);
  check(holdButton(holdLabels[0]),'localized reserve control appears only with saved opt-in');
  holdButton(holdLabels[0]).click();await wait(()=>holdRoot.querySelector('.editor form'));let holdForm=holdRoot.querySelector('.editor form');
  holdForm.querySelector('input[pattern]').value=ids[1];holdForm.querySelector('input[type=number]').value='2';holdForm.requestSubmit();
  await wait(()=>holdRoot.querySelector('[role=status]').textContent.includes({en:'Result uncertain',ar:'النتيجة غير مؤكدة',sv:'Resultatet är osäkert'}[language]));
  check(reserveCalls.length===1&&!holdRoot.textContent.includes('provider-secret'),'lost stock response is generic and keeps the pending form');
  stopHold();holdHost.remove();
  const retryHost=document.createElement('div');document.body.append(retryHost);
  stopHold=mountApplicationDataView(retryHost,stockApp,holdBinding,holdRuntime,language,holdScope);
  holdRoot=retryHost.shadowRoot;await wait(()=>holdRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  holdButton(holdLabels[0]).click();await wait(()=>holdRoot.querySelector('.editor form'));holdForm=holdRoot.querySelector('.editor form');
  check(holdForm.querySelector('input[pattern]').value===ids[1]&&holdForm.querySelector('input[type=number]').value==='2','reload restores the immutable pending request');
  holdForm.requestSubmit();await wait(()=>holdRoot.querySelector('.editor').hidden);
  check(reserveCalls.length===2&&reserveCalls[0][2]===reserveCalls[1][2],'retry reuses the exact receipt');
  await wait(()=>holdRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  holdButton(holdLabels[0]).click();await wait(()=>holdButton(holdLabels[2]));holdButton(holdLabels[2]).click();
  await wait(()=>holdRoot.querySelector('[role=status]').textContent.includes({en:'Result uncertain',ar:'النتيجة غير مؤكدة',sv:'Resultatet är osäkert'}[language]));
  check(settleCalls.length===1&&!holdRoot.textContent.includes('provider-secret'),'lost fulfillment remains private');
  stopHold();retryHost.remove();
  const settleHost=document.createElement('div');document.body.append(settleHost);
  stopHold=mountApplicationDataView(settleHost,stockApp,holdBinding,holdRuntime,language,holdScope);
  holdRoot=settleHost.shadowRoot;await wait(()=>holdRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  holdButton(holdLabels[0]).click();
  await wait(()=>holdButton(holdLabels[2]));
  check(!holdButton({en:'Release hold',ar:'تحرير الحجز',sv:'Frisläpp reservation'}[language]),'pending fulfillment cannot turn into release');
  holdButton(holdLabels[2]).click();await wait(()=>holdRoot.querySelector('.editor').hidden);
  await wait(()=>holdRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  check(settleCalls.length===2&&settleCalls[0][0]===settleCalls[1][0]&&settleCalls.every(call=>call[1]==='fulfill'),'settlement retries do not change decision');
  stopHold();settleHost.remove();
  const physicalApp=structuredClone(stockApp);
  physicalApp.tables[0].stockLocations={itemFieldId:'level_product',locationFieldId:'level_warehouse'};
  physicalApp.tables[0].fields.push({id:'level_product',key:'product_id',name:'Product',type:'reference',required:true,referenceTableId:'catalog'},
    {id:'level_warehouse',key:'warehouse_id',name:'Warehouse',type:'reference',required:true,referenceTableId:'warehouses'});
  physicalApp.tables.push({id:'catalog',key:'catalog',name:'Catalog',fields:[{id:'catalog_title',key:'title',name:'Title',type:'text',required:true}],permissions:[{operation:'read',access:'owner'}]},
    {id:'warehouses',key:'warehouses',name:'Warehouses',fields:[{id:'warehouse_title',key:'title',name:'Title',type:'text',required:true}],permissions:[{operation:'read',access:'owner'}]});
  const physicalRow={id:ids[0],owner_id:owner,name:'Product at warehouse B',quantity,product_id:ids[2],warehouse_id:ids[1]};
  const physicalCalls=[];
  const physicalRuntime={...counterRuntime,list:async()=>[physicalRow],stockReservations:(_table,actor)=>{
    check(actor===owner,'physical stock binds owner');return{available:async()=>5,reserve:async(...args)=>{physicalCalls.push(args);return 'reserved'},settle:async()=> 'released'}}};
  const physicalHost=document.createElement('div');document.body.append(physicalHost);
  const stopPhysical=mountApplicationDataView(physicalHost,physicalApp,{tableId:'stock_items',columns:['level_product','level_warehouse','item_stock'],actions:['update','stock-reservation'],pageSize:10},physicalRuntime,language,
    {projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'stock',sectionId:'physical-'+language});
  const physicalRoot=physicalHost.shadowRoot;
  const physicalIdle=()=>wait(()=>physicalRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const physicalButton=text=>[...physicalRoot.querySelectorAll('button')].find(button=>button.textContent===text);
  await physicalIdle();physicalButton(copy.edit).click();
  const editPhysical=physicalRoot.querySelector('.editor form');
  check(editPhysical.elements.product_id.readOnly&&editPhysical.elements.warehouse_id.readOnly,'saved stock dimensions cannot be edited through ordinary record controls');
  check(editPhysical.elements.product_id.value===ids[2]&&editPhysical.elements.warehouse_id.value===ids[1],'immutable fields preserve the actual displayed row identity');
  physicalButton(holdLabels[0]).click();await wait(()=>physicalRoot.querySelector('.editor form input'));
  const physicalForm=physicalRoot.querySelector('.editor form'),physicalInputs=physicalForm.querySelectorAll('input');
  check(physicalInputs[0].readOnly&&physicalInputs[0].value===ids[1],'reservation warehouse is pinned from the actual stock-level row');
  check(physicalForm.textContent.includes({en:'Warehouse reference UUID',ar:'معرّف المستودع UUID',sv:'Lagerreferens UUID'}[language]),'physical location uses a localized warehouse label');
  physicalInputs[1].value='2';physicalForm.requestSubmit();await wait(()=>physicalRoot.querySelector('.editor').hidden);await physicalIdle();
  check(physicalCalls.length===1&&physicalCalls[0][0]===ids[0]&&physicalCalls[0][1]===ids[1]&&physicalCalls[0][3]===2,'physical reservation targets the selected level and its warehouse');
  physicalButton(holdLabels[0]).click();await wait(()=>physicalButton({en:'Release hold',ar:'تحرير الحجز',sv:'Frisläpp reservation'}[language]));
  physicalButton({en:'Release hold',ar:'تحرير الحجز',sv:'Frisläpp reservation'}[language]).click();await wait(()=>physicalRoot.querySelector('.editor').hidden);
  stopPhysical();physicalHost.remove();
  const destinationId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',destinationWarehouse='ffffffff-ffff-4fff-8fff-ffffffffffff';
  let transferActor=owner,lostTransfer=true,switchTransfer=false;const browserTransfers=[];
  const transferRuntime={...physicalRuntime,auth:{currentUser:async()=>({id:transferActor,is_anonymous:false}),currentRoles:async()=>[]},
    list:async(_table,options)=>options?.filters?.length?[{...physicalRow,id:destinationId,warehouse_id:destinationWarehouse,name:'Destination stock'}]:[physicalRow],
    stockReservations:(_table,actor)=>({transfer:async(...args)=>{check(actor===owner,'transfer pins its original owner');browserTransfers.push(args);if(lostTransfer){lostTransfer=false;throw Error('secret transfer detail')}if(switchTransfer)transferActor=ids[2];return 'already-transferred'}})};
  const transferBinding={tableId:'stock_items',columns:['level_product','level_warehouse','item_stock'],actions:['stock-transfer'],pageSize:10};
  const transferScope={projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'stock',sectionId:'transfer-'+language};
  const transferLabels={en:['Transfer stock','Confirm transfer','Stock transfer confirmed.'],ar:['نقل المخزون','تأكيد النقل','تم تأكيد نقل المخزون.'],sv:['Flytta lager','Bekräfta flytt','Lagerflytten bekräftades.']}[language];
  let transferHost=document.createElement('div');document.body.append(transferHost);
  let stopTransfer=mountApplicationDataView(transferHost,physicalApp,transferBinding,transferRuntime,language,transferScope),transferRoot=transferHost.shadowRoot;
  const transferButton=text=>[...transferRoot.querySelectorAll('button')].find(button=>button.textContent===text);
  const transferIdle=()=>wait(()=>transferRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  await transferIdle();transferButton(transferLabels[0]).click();await wait(()=>transferRoot.querySelector('.editor select')?.value===destinationId);
  let transferForm=transferRoot.querySelector('.editor form');transferForm.elements.quantity.value='2';transferForm.requestSubmit();await transferIdle();
  check(browserTransfers.length===1&&browserTransfers[0][0]===ids[0]&&browserTransfers[0][1]===destinationId&&browserTransfers[0][3]===2,'transfer sends the chosen source, destination and quantity');
  check(transferForm.elements.quantity.readOnly&&transferForm.elements.destination.disabled,'uncertain transfer freezes destination and quantity');
  check(!transferRoot.textContent.includes('secret transfer detail'),'transfer errors never expose provider output');
  stopTransfer();transferHost.remove();transferHost=document.createElement('div');document.body.append(transferHost);
  stopTransfer=mountApplicationDataView(transferHost,physicalApp,transferBinding,transferRuntime,language,transferScope);transferRoot=transferHost.shadowRoot;
  await transferIdle();transferButton(transferLabels[0]).click();await wait(()=>transferRoot.querySelector('.editor form'));
  transferForm=transferRoot.querySelector('.editor form');check(transferForm.elements.destination.value===destinationId&&transferForm.elements.quantity.value==='2'&&transferForm.elements.quantity.readOnly,'reload restores the frozen transfer');
  transferForm.requestSubmit();await wait(()=>transferRoot.querySelector('.editor').hidden);await transferIdle();
  await wait(()=>transferRoot.querySelector('[role=status]').textContent===transferLabels[2]);
  check(browserTransfers.length===2&&JSON.stringify(browserTransfers[0])===JSON.stringify(browserTransfers[1]),'lost transfer response retries the same durable request across reload');
  switchTransfer=true;transferButton(transferLabels[0]).click();await wait(()=>transferRoot.querySelector('.editor select')?.value===destinationId);
  transferRoot.querySelector('.editor form').requestSubmit();await transferIdle();
  check(transferRoot.querySelectorAll('tbody tr').length===0,'transfer account switch clears private rows');
  stopTransfer();transferHost.remove();
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
  const itemSelect=transactionForm.querySelector('fieldset select'),itemQuantity=transactionForm.querySelector('fieldset input[type=number]');itemSelect.value=ids[0];itemQuantity.value='2';transactionButton(transactionCopy.add).click();check(transactionForm.checkValidity(),'staged line inputs do not block transaction submission');transactionForm.requestSubmit();await transactionIdle();
  check(transactionCalls===1&&transactionItems[0].quantity===3&&transactionRows.length===1,'multi-item transaction persists atomically');
  transactionButton(transactionCopy.open).click();transactionForm=transactionRoot.querySelector('.editor form');await wait(()=>transactionForm.querySelector('fieldset select').options.length===2);transactionForm.elements.note.value='Too much';transactionForm.querySelector('fieldset select').value=ids[1];transactionForm.querySelector('fieldset input[type=number]').value='9';transactionButton(transactionCopy.add).click();transactionForm.requestSubmit();await transactionIdle();
  const transactionBounds={en:'The change exceeds the allowed limits. Choose another amount.',ar:'التغيير يتجاوز الحدود المسموحة. اختر كمية أخرى.',sv:'Ändringen överskrider tillåtna gränser. Välj ett annat antal.'}[language];
  check(transactionCalls===2&&transactionItems[1].quantity===4&&transactionRows.length===1&&transactionRoot.querySelector('[role=status]').textContent===transactionBounds,'multi-item underflow rolls back with localized message');
  stopTransaction();transactionHost.remove();
  const filesApp={...app,roles:[],tables:[{...app.tables[0],permissions:['read','update'].map(operation=>({operation,access:'owner'})),attachments:{maxBytes:1024,mimeTypes:['application/pdf']}}]};
  let fileUser=owner,fileWrites=0,firstFileId,uncertainFile=true,fileRows=[];
  const fileRuntime={auth:{currentUser:async()=>({id:fileUser,is_anonymous:false}),currentRoles:async()=>[]},list:async()=>[{id:ids[0],name:'Invoice'}],files:{
    list:async()=>({files:fileRows,hasNext:false}),upload:async(_table,_record,id,file)=>{fileWrites++;if(!firstFileId)firstFileId=id;check(firstFileId===id,'file retry identity retained');check(file.type==='application/pdf','selected file type');if(uncertainFile)throw Error('uncertain');fileRows=[{id,size:file.size}]},
    remove:async()=>{fileRows=[]},download:async()=>new Blob(['pdf'],{type:'application/octet-stream'})}};
  const fileHost=document.createElement('div');document.body.append(fileHost);const stopFiles=mountApplicationDataView(fileHost,filesApp,{tableId:'records',columns:['record_name'],actions:['attachments'],pageSize:10},fileRuntime,language,{projectRef:'sgewokeojtzsqjaeluan',projectId:'project',pageId:'files',sectionId:'files'});
  const fileRoot=fileHost.shadowRoot,fileIdle=()=>wait(()=>fileRoot.querySelector('.view')?.getAttribute('aria-busy')==='false');
  const fileButton=text=>[...fileRoot.querySelectorAll('button')].find(button=>button.textContent===text&&!button.hidden&&!button.disabled);
  const fileCopy={en:{open:'Attachments',upload:'Upload file'},ar:{open:'المرفقات',upload:'رفع ملف'},sv:{open:'Bilagor',upload:'Ladda upp fil'}}[language];
  await fileIdle();fileButton(fileCopy.open).click();await wait(()=>fileRoot.querySelector('input[type=file]'));
  const fileInput=fileRoot.querySelector('input[type=file]'),transfer=new DataTransfer();transfer.items.add(new File(['%PDF-fixture'],'invoice.pdf',{type:'application/pdf'}));fileInput.files=transfer.files;fileInput.dispatchEvent(new Event('change'));
  fileButton(fileCopy.upload).click();await fileIdle();check(fileWrites===1&&fileInput.files.length===1,'uncertain upload preserves selected bytes');
  uncertainFile=false;fileButton(fileCopy.upload).click();await fileIdle();check(fileWrites===2&&fileRows.length===1&&fileRoot.querySelector('.editor').textContent.includes(firstFileId),'retry uploads once and lists attachment');
  window.confirm=()=>true;fileButton(copy.remove).click();await fileIdle();check(fileRows.length===0,'attachment deletion');
  fileUser='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';fileButton(copy.refresh).click();await fileIdle();check(!fileRoot.querySelector('input[type=file]')&&!fileRoot.querySelector('tbody tr'),'account switch clears selected private file and records');
  stopFiles();fileHost.remove();



 }
}
run().then(()=>document.querySelector('#result').textContent='PASS application data view browser CRUD / search / pagination / role controls / XSS / datetime / booking conflicts / recurring series / exact reports / reference selectors / generic counters / atomic transactions / private attachments / account switch in en-ar-sv').catch(error=>document.querySelector('#result').textContent='FAIL '+error.stack).then(()=>fetch('/result',{method:'POST',body:document.querySelector('#result').textContent}));`;
  const result = await build({ stdin: { contents: fixture, resolveDir: process.cwd(), sourcefile: 'data-view-fixture.ts' }, bundle: true, write: false,
    platform: 'browser', format: 'iife', target: 'es2020', alias: { '@': resolve('src') } });
  const html = '<!doctype html><html><body><p id="result">RUNNING</p><script src="/fixture.js"></script></body></html>';
  let complete;
  const completion = new Promise(resolve => { complete = resolve; });
  server = createServer((req, res) => {
    if (req.url === '/result' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => { res.end(); complete(body); });
      return;
    }
    res.setHeader('content-type', req.url === '/fixture.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/fixture.js' ? result.outputFiles[0].text : html);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  // dump-dom can finish while asynchronous UI checks are still running. Wait
  // for the real browser's terminal result, with a wall-clock failure deadline.
  const detached = process.platform !== 'win32';
  const child = spawn(chrome, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--user-data-dir=${dir}`, url], { detached, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', timer;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  let marker;
  try {
    marker = await Promise.race([completion, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Data view browser timed out: ${stderr}`)), 35_000);
      child.once('error', reject);
      child.once('exit', code => reject(new Error(`Browser exited before completing checks (${code}): ${stderr}`)));
    })]);
  } finally {
    clearTimeout(timer);
    if (child.pid) {
      const exited = child.exitCode === null && child.signalCode === null
        ? new Promise(resolve => child.once('exit', resolve)) : Promise.resolve();
      // Renderer/network children can keep writing the profile after the parent
      // exits. Stop the entire process group before removing its directory.
      if (detached) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      } else spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      await exited;
    }
  }
  if (!marker?.startsWith('PASS')) throw new Error(marker ?? 'Browser did not return a result');
  console.log(marker);
} finally { server?.closeAllConnections(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
