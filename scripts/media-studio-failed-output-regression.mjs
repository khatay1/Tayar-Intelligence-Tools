import assert from 'node:assert/strict';
import {build} from 'esbuild';
const fixture={files:new Map(),fail:true,readFailure:false};
globalThis.__tayarMediaFixture=fixture;
const nativeFetch=globalThis.fetch,nativeWindow=globalThis.window;
globalThis.window={setTimeout,clearTimeout};globalThis.fetch=async()=>new Response(new Uint8Array([1]));
try{
 const result=await build({entryPoints:[new URL('../src/modules/media-studio-max/media-engine.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'ffmpeg-fixture',setup(b){b.onResolve({filter:/^@ffmpeg\/ffmpeg$|ffmpeg-class-worker\.js\?worker&url$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path.startsWith('@ffmpeg')?`export class FFmpeg{loaded=false;on(){}async load(){this.loaded=true}terminate(){this.loaded=false}async writeFile(n,b){globalThis.__tayarMediaFixture.files.set(n,b)}async ffprobe(){return 1}async exec(){const f=globalThis.__tayarMediaFixture;for(let n=1;n<=(f.fail?3:1);n++)f.files.set('frame_'+String(n).padStart(5,'0')+'.png',new Uint8Array([n]));return f.fail?1:0}async listDir(){return Array.from(globalThis.__tayarMediaFixture.files.keys()).map(name=>({name,isDir:false}))}async readFile(n){if(globalThis.__tayarMediaFixture.readFailure)throw new Error('fixture read failure');return globalThis.__tayarMediaFixture.files.get(n)}async deleteFile(n){globalThis.__tayarMediaFixture.files.delete(n)}}`:`export default 'fixture-worker.js'`}));}}]});
 const {mediaEngine}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
 const source={id:'fixture',file:new File([new Uint8Array([1])],'sample.mp4',{type:'video/mp4'}),kind:'video',objectUrl:''};
 await assert.rejects(mediaEngine.process('video-to-images',[source]),/FFmpeg exited with code 1/);
 assert.deepEqual([...fixture.files.keys()],[],'failed conversion must remove all partially produced frames');
 fixture.fail=false;const outputs=await mediaEngine.process('video-to-images',[source]);assert.deepEqual(outputs.map(o=>o.name),['frame_00001.png'],'retry exports only new output');outputs.forEach(o=>URL.revokeObjectURL(o.previewUrl));
 fixture.readFailure=true;await assert.rejects(mediaEngine.process('video-to-images',[source]),/fixture read failure/);assert.deepEqual([...fixture.files.keys()],[],'failed output read must also remove all output files');
 mediaEngine.cancel();console.log('PASS failed FFmpeg and failed output read leave no partial files; retry exports only new frames');
}finally{globalThis.fetch=nativeFetch;globalThis.window=nativeWindow;delete globalThis.__tayarMediaFixture;}
