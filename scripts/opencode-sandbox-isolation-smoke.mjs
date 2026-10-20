/**
 * Disposable Docker confinement probe. Not an OpenCode runtime or public tool.
 * CLI: node scripts/opencode-sandbox-isolation-smoke.mjs [--docker-image sha256:<image-id>]
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const WORKSPACE='/workspace/test-tenant-123';
const IMAGE=/^sha256:[a-f0-9]{64}$/;
const NAME=/^tayar-opencode-proof-[a-f0-9]{12}$/;
const MARKER='TAYAR_OFFLINE_SANDBOX_PROOF=';
const probeSource="import {writeFileSync,existsSync} from 'node:fs';\nimport net from 'node:net';\nfunction refuses(path){try{writeFileSync(path,'overwrite');return false}catch(e){return e?.code==='EROFS'||e?.code==='EACCES'}}\nconst blocked=await new Promise(resolve=>{const s=net.connect({host:'1.1.1.1',port:443});const t=setTimeout(()=>{s.destroy();resolve(true)},1600);s.once('connect',()=>{clearTimeout(t);s.destroy();resolve(false)});s.once('error',()=>{clearTimeout(t);resolve(true)})});\nconsole.log('TAYAR_OFFLINE_SANDBOX_PROOF='+JSON.stringify({uid:process.getuid(),networkDenied:blocked,sourceReadonly:refuses('/workspace/test-tenant-123/input.txt'),rootReadonly:refuses('/root/should-not-write'),dockerSocketAbsent:!existsSync('/var/run/docker.sock'),sourceReadable:existsSync('/workspace/test-tenant-123/input.txt')}));";

export function createIsolationCommand({image,source,name}){
  if(typeof image!=='string'||!IMAGE.test(image))throw Error('image must be a local digest');
  if(typeof name!=='string'||!NAME.test(name))throw Error('invalid container identity');
  if(typeof source!=='string'||!source.startsWith('/tmp/tayar-opencode-proof-')||
     !/^[a-zA-Z0-9_./-]+$/.test(source)||resolve(source)!==source||
     source.includes('/../')||source.includes('/./'))throw Error('invalid disposable fixture');
  return {executable:'docker',args:[
    'run','--rm','--name',name,'--pull=never',
    '--network=none','--ipc=none','--read-only','--user=10001:10001',
    '--cap-drop=ALL','--security-opt=no-new-privileges',
    '--pids-limit=64','--memory=256m','--cpus=1',
    '--tmpfs=/tmp:rw,nosuid,nodev,size=64m',
    '--mount','type=bind,src='+source+',dst='+WORKSPACE+',readonly',
    '--workdir='+WORKSPACE,'--env=HOME=/tmp',
    image,'node','--input-type=module','--eval',probeSource
  ]};
}
export function verifyIsolationOutput(output){
  if(typeof output!=='string'||output.length>65536)throw Error('invalid proof output');
  const matches=output.split('\n').filter(line=>line.startsWith(MARKER));
  if(matches.length!==1)throw Error('missing/duplicate proof');
  let p;
  try{p=JSON.parse(matches[0].slice(MARKER.length))}catch{throw Error('malformed proof')}
  if(!p||p.uid!==10001||p.networkDenied!==true||
     p.sourceReadonly!==true||p.rootReadonly!==true||
     p.dockerSocketAbsent!==true||p.sourceReadable!==true)throw Error('unsafe sandbox');
  return p;
}
async function main(){
  const dir=await mkdtemp(join(tmpdir(),'tayar-opencode-proof-'));
  const name='tayar-opencode-proof-'+randomUUID().replaceAll('-','').slice(0,12);
  const data='immutable:'+name;
  try{
    await writeFile(join(dir,'input.txt'),data);
    assert.equal((await lstat(dir)).isDirectory(),true);
    assert.equal(await realpath(dir),dir);
    const dummy='sha256:'+'a'.repeat(64);
    const cmd=createIsolationCommand({image:dummy,source:dir,name});
    for(const flag of ['--network=none','--read-only','--cap-drop=ALL','--pull=never','--user=10001:10001'])
      assert.ok(cmd.args.includes(flag),'missing '+flag);
    assert.equal(cmd.args.filter(x=>x.startsWith('--env=')).length,1);
    assert.equal(cmd.args.filter(x=>x==='--mount').length,1);
    assert.ok(cmd.args.includes('type=bind,src='+dir+',dst='+WORKSPACE+',readonly'));
    assert.deepEqual(cmd.args.filter(x=>x.startsWith('type=bind,')),
      ['type=bind,src='+dir+',dst='+WORKSPACE+',readonly']);
    for(const image of ['node:22-alpine','sha256:bad','sha256:'+'G'.repeat(64),'http://external'])
      assert.throws(()=>createIsolationCommand({image,source:dir,name}));
    for(const source of ['/','/workspace/demo','/tmp/../etc','/tmp/tayar-opencode-proof-X,other'])
      assert.throws(()=>createIsolationCommand({image:dummy,source,name}));
    assert.throws(()=>createIsolationCommand({image:dummy,source:dir,name:'random'}));
    const ok={uid:10001,networkDenied:true,sourceReadonly:true,rootReadonly:true,dockerSocketAbsent:true,sourceReadable:true};
    assert.deepEqual(verifyIsolationOutput(MARKER+JSON.stringify(ok)+'\n'),ok);
    assert.throws(()=>verifyIsolationOutput(MARKER+JSON.stringify({...ok,networkDenied:false})));
    assert.throws(()=>verifyIsolationOutput(''));
    console.log('PASS OpenCode offline sandbox contract (no Docker or network needed)');
    const cli=process.argv.slice(2);
    if(cli.length===0)return;
    if(cli.length!==2||cli[0]!=='--docker-image'||!IMAGE.test(cli[1]))
      throw Error('pass --docker-image sha256:<locally inspected image ID>');
    let output;
    try{
      const invocation=createIsolationCommand({image:cli[1],source:dir,name});
      output=execFileSync(invocation.executable,invocation.args,{
        encoding:'utf8',timeout:25000,maxBuffer:65536,stdio:['ignore','pipe','pipe']
      });
    }finally{
      try{execFileSync('docker',['rm','--force',name],{timeout:5000,stdio:'ignore'})}
      catch{ /* already removed by --rm */ }
    }
    verifyIsolationOutput(output);
    assert.equal(await readFile(join(dir,'input.txt'),'utf8'),data);
    console.log('PASS REAL Docker network/readonly/uid/socket confinement');
  }finally{await rm(dir,{recursive:true,force:true})}
}
await main();