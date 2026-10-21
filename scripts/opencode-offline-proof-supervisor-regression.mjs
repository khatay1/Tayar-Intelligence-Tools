import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OfflineProofError, createOfflineOpenCodeProofSupervisor, snapshotOfflineWorkspace,
} from '../server/opencode-offline-proof-supervisor.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const root = await mkdtemp(join(tmpdir(),'tayar-opencode-proof-'));
try {
  const workspace=join(root,'tenant-task-123');await mkdir(workspace);await mkdir(join(workspace,'src'));
  await writeFile(join(workspace,'src','index.ts'),'export const safe = true;\n');
  const snapshot=await snapshotOfflineWorkspace({workspaceDirectory:workspace,workspaceRoot:root});
  assert.match(snapshot.sha256,/^[a-f0-9]{64}$/);assert.equal(snapshot.files,1);
  const outside=join(root,'outside');await writeFile(outside,'secret');
  await symlink(outside,join(workspace,'escape'));
  await assert.rejects(snapshotOfflineWorkspace({workspaceDirectory:workspace,workspaceRoot:root}),
    error=>error instanceof OfflineProofError&&error.code==='unsafe-workspace-entry');
  await rm(join(workspace,'escape'));

  const taskId='tenant-task-123',workspaceDirectory='/workspace/'+taskId,modelID='qwen2.5-coder:7b';
  const admission={schema:'tayar-opencode-offline-admission/v1',workspaceDirectory,
    opencode:{version:'v1.19.3',sha256:'1'.repeat(64)},ollama:{version:'v0.40.6',sha256:'2'.repeat(64)},
    model:{modelID,manifestSha256:'3'.repeat(64),blobSha256:'4'.repeat(64),blobSize:42},
    commercialModelApiFees:false,inferenceExecuted:false};
  let snapshots=[snapshot,snapshot],stopped=0,destroyed=0,plannerCalls=0;
  const confinement={schema:'tayar-opencode-confinement/v1',sandboxId:'sandbox_fixture_123',taskId,
    workspaceDirectory,uid:10001,networkMode:'none',rootFilesystemReadonly:true,workspaceReadonly:true,
    dockerSocketMounted:false,credentialsPresent:false,externalTcpDenied:true,externalDnsDenied:true,
    pidNamespaceIsolated:true};
  const createSandbox=async()=>({verifyConfinement:async()=>confinement,
    startRuntime:async()=>({origin:'http://127.0.0.1:4096',opencodeVersion:'v1.19.3',
      ollamaVersion:'v0.40.6',providerID:'ollama',modelID,serverPassword:'fixture-password-123',fetcher:async()=>{}}),
    stopRuntime:async()=>{stopped++;},destroy:async()=>{destroyed++;return{destroyed:true,sandboxId:confinement.sandboxId};}});
  const supervisor=createOfflineOpenCodeProofSupervisor({admitRuntime:async()=>admission,
    snapshotWorkspace:async()=>snapshots.shift()??snapshot,planner:async input=>{plannerCalls++;
      assert.equal(input.config.baseUrl,'http://127.0.0.1:4096');
      return{mode:'read-only',providerID:'ollama',modelID,plan:'Review src/index.ts; no changes proposed.'};},
    createSandbox});
  const request={taskId,prompt:'Review this project.',admissionInput:{workspaceDirectory}};
  const receipt=await supervisor(request);assert.equal(receipt.inferenceExecuted,true);
  assert.equal(receipt.workspaceUnchanged,true);assert.equal(receipt.runtimeStopped,true);
  assert.equal(receipt.sandboxDestroyed,true);assert.equal(plannerCalls,1);assert.equal(stopped,1);assert.equal(destroyed,1);
  assert.doesNotMatch(JSON.stringify(receipt),/fixture-password/);

  snapshots=[snapshot,{...snapshot,sha256:sha('mutated')}];
  await assert.rejects(supervisor(request),error=>error instanceof OfflineProofError&&error.code==='workspace-mutated');
  assert.equal(stopped,2);assert.equal(destroyed,2);
  snapshots=[snapshot];
  const unsafeSandbox=async()=>({...await createSandbox(),verifyConfinement:async()=>({...confinement,networkMode:'bridge'})});
  const unsafeSupervisor=createOfflineOpenCodeProofSupervisor({admitRuntime:async()=>admission,
    snapshotWorkspace:async()=>snapshots.shift()??snapshot,planner:async()=>{throw Error('must not run');},
    createSandbox:unsafeSandbox});
  await assert.rejects(unsafeSupervisor(request),
    error=>error instanceof OfflineProofError&&error.code==='unsafe-confinement');
  assert.equal(stopped,2);assert.equal(destroyed,3);
  console.log('OpenCode offline proof supervisor lifecycle regression passed (fixture only; no inference).');
}finally{await rm(root,{recursive:true,force:true});}
