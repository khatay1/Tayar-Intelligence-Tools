import assert from'node:assert/strict';import{mkdtemp,rm}from'node:fs/promises';import{join}from'node:path';import{createRequire}from'node:module';import{build}from'esbuild';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const dir=await mkdtemp(join(process.cwd(),'node_modules','.tayar-publish-panel-'));
try{const out=join(dir,'panel.cjs');await build({entryPoints:['src/modules/website-builder/v2-ui/BuilderByoPublishPanel.tsx'],bundle:true,platform:'node',format:'cjs',outfile:out,external:['react','react/jsx-runtime'],jsx:'automatic',plugins:[{name:'localizer',setup(builder){builder.onResolve({filter:/^@\/lib\/ui-localization-cms$/},()=>({path:'localizer',namespace:'test'}));builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const useLocalizer=()=>text=>text;',loader:'js'}));}}]});
const{BuilderByoPublishPanel:Panel}=require(out),controller={start:async()=>{},poll:async()=>null};const render=props=>renderToStaticMarkup(React.createElement(Panel,{projectSaved:true,...props}));
const unavailable=render({});assert.match(unavailable,/Publishing endpoint is not available yet/);assert.match(unavailable,/button type="button" disabled/);
const preview={status:'ready',operationId:'11111111-1111-4111-8111-111111111111',environment:'preview',stage:'ready',version:4,liveUrl:'https://preview.vercel.app'};
const ready=render({controller,initialPreview:preview});assert.match(ready,/Publish verified preview/);assert.doesNotMatch(ready,/Create and verify a preview first/);assert.match(ready,/https:\/\/preview.vercel.app/);
const pending=render({controller,initialPreview:{...preview,status:'pending',stage:'observing',liveUrl:null}});assert.match(pending,/pending/);assert.match(pending,/Create and verify a preview first/);
assert.match(render({controller,projectSaved:false}),/button type="button" disabled/);
const source=await import('node:fs/promises').then(fs=>fs.readFile('src/modules/website-builder/v2-ui/BuilderByoPublishPanel.tsx','utf8'));assert.match(source,/preview[?][.]status==='pending'&&failed!=='preview'/);assert.match(source,/window[.]clearTimeout/);
console.log('PASS BYO publish panel: unavailable disabled, explicit states, preview-before-production and pending-only polling cleanup');
}finally{await rm(dir,{recursive:true,force:true});}
