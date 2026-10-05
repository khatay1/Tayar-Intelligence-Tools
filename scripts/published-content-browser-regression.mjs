// Requires externally supplied Playwright and Chromium; installs no project dependencies.
// TAYAR_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_BIN=/path/to/chromium node scripts/published-content-browser-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

const { chromium } = await import(process.env.TAYAR_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.TAYAR_AUDIT_ROOT || path.resolve(new URL('..', import.meta.url).pathname);
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tayar-isolation-browser-'));
let browser;
let server;
const previous = process.env.SUPABASE_URL;
try {
  const payload = '<p id="safe-content">Custom HTML preview</p><iframe srcdoc="&lt;script&gt;parent.parent.__escaped=1&lt;/script&gt;"></iframe><style>body{background:rgb(255,0,0)}</style>';
  const fixture = `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ElementPreview} from './src/modules/website-builder/components/ElementPreview';
    window.__escaped=0; window.__selected=0; window.__dragged=0;
    const noop=()=>{};
    createRoot(document.getElementById('root')).render(<ElementPreview element={{id:'custom',type:'code',content:${JSON.stringify(payload)},style:{width:100}}} selected={false} dragging={false} dragOver={false} device="desktop" onSelect={()=>window.__selected++} onPointerDragStart={()=>window.__dragged++} onDragStart={noop} onDragMove={noop} onDragOver={noop} onDrop={noop} onDragEnd={noop} onInlineContentChange={noop} onInlineSourceChange={noop}/>);`;
  const bundle = await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',plugins:[{
    name:'localizer-fixture',setup(b){ b.onResolve({filter:/^@\/lib\/ui-localization$/},()=>({path:'localizer',namespace:'fixture'})); b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useLocalizer=()=>text=>text;',loader:'js'})); }
  }]});
  const component = await fs.readFile(path.join(root,'src/modules/website-builder/components/ElementPreview.tsx'),'utf8');
  const css = (await postcss([tailwindcss({content:[{raw:component,extension:'tsx'}]})]).process('@tailwind utilities;', {from:undefined})).css;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>window.__ran=true;try{localStorage.getItem("sentinel");window.__storage="accessible"}catch(e){window.__storage=e.name}</script><text y="20">isolated SVG</text></svg>';
  const context=vm.createContext({URL,Headers,Request,Response,Buffer,process,tryServePublishedApplication:async()=>null,fetch:async()=>new Response(svg,{status:200})});
  const api=(await fs.readFile(path.join(root,'api/published-site.js'),'utf8')).replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
  vm.runInContext(api+'\nglobalThis.handler=handler;',context);
  process.env.SUPABASE_URL='https://fixture.supabase.co';
  server=http.createServer((req,res)=>{
    if(req.url.startsWith('/site/')||req.url.startsWith('/preview/')){void context.handler(req,res).catch(e=>res.destroy(e));return;}
    if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return;}
    if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    res.setHeader('Content-Type','text/html');res.end(`<html><head><style>${css} body{background:rgb(255,255,255);margin:20px} #root{width:100%}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-software-rasterizer']});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:720}); await page.goto(base); await page.locator('#root > div').waitFor();
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)', 'Custom HTML styles must not affect the editor');
    await page.locator('#root > div > iframe').waitFor({timeout:5000});
    const frame=page.frameLocator('#root > div > iframe'); await frame.locator('#safe-content').waitFor();
    assert.equal(await page.evaluate(()=>window.__escaped),0);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(255, 255, 255)');
    const state=await page.locator('#root > div > iframe').evaluate(f=>({sandbox:f.getAttribute('sandbox'),tabIndex:f.tabIndex,pointerEvents:getComputedStyle(f).pointerEvents,width:f.getBoundingClientRect().width,height:f.getBoundingClientRect().height,opaque:f.contentDocument===null}));
    assert.equal(state.sandbox,'');assert.equal(state.tabIndex,-1);assert.equal(state.pointerEvents,'none');assert.equal(state.opaque,true);assert.ok(state.width>0&&state.width<=width);assert.ok(state.height>=128);
    await page.mouse.click(80,50); assert.ok(await page.evaluate(()=>window.__selected>0&&window.__dragged>0),'selection and pointer drag must reach the outer canvas wrapper');
    console.log(`PASS Custom HTML: isolation, rendered content, dimensions, selection and pointer drag at ${width}px`);
  }
  assert.deepEqual(errors,[],'fixture must not throw runtime errors');
  for(const route of ['/site/owner/project/assets/probe.svg','/preview/owner/project/token/assets/probe.svg']){
    const response=await page.goto(base+route);assert.equal(response.status(),200);assert.match(response.headers()['content-security-policy'],/sandbox/);
    assert.deepEqual(await page.evaluate(()=>({ran:window.__ran,storage:window.__storage})),{ran:true,storage:'SecurityError'});
    console.log(`PASS ${route}: script executes in isolated origin; platform localStorage is inaccessible`);
  }
} finally {
  await browser?.close();if(server) await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});
  if(previous===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=previous;
}
