import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OFFLINE_RUNTIME_RELEASES, OfflineRuntimeAdmissionError,
  admitOpenCodeOfflineRuntime, verifyOfflineArtifact, verifyOfflineModel,
} from '../server/opencode-offline-runtime-admission.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const root = await mkdtemp(join(tmpdir(), 'tayar-opencode-runtime-admission-'));
try {
  const good = join(root, 'artifact.bin');
  const content = Buffer.from('reviewed immutable fixture');
  await writeFile(good, content, { mode: 0o400 });
  const policy = { name:'fixture', size:content.length, sha256:sha(content) };
  assert.deepEqual(await verifyOfflineArtifact({path:good,root,expected:policy}), policy);
  await assert.rejects(verifyOfflineArtifact({path:good,root,expected:{...policy,sha256:'0'.repeat(64)}}),
    {code:'artifact-mismatch'});
  await chmod(good,0o620);
  await assert.rejects(verifyOfflineArtifact({path:good,root,expected:policy}),
    {code:'artifact-mismatch'});
  await chmod(good,0o400);
  const outside = await mkdtemp(join(tmpdir(),'tayar-opencode-outside-'));
  try {
    const target=join(outside,'target'); await writeFile(target,content,{mode:0o400});
    const link=join(root,'link'); await symlink(target,link);
    await assert.rejects(verifyOfflineArtifact({path:link,root,expected:policy}),
      {code:'artifact-mismatch'});
  } finally { await rm(outside,{recursive:true,force:true}); }

  assert.equal(OFFLINE_RUNTIME_RELEASES.opencode.version,'v1.19.3');
  assert.equal(OFFLINE_RUNTIME_RELEASES.ollama.version,'v0.40.6');
  assert.equal(OFFLINE_RUNTIME_RELEASES.opencode.assets['linux-x64-baseline'].sha256,
    '531cff2441129c30f0edd5878af494108ad07f5feb46d7ee29a2a5b830a5765d');
  assert.equal(OFFLINE_RUNTIME_RELEASES.ollama.assets['linux-amd64'].sha256,
    'c164ab8b1b28e2a247c29719b8e404c423c5b83ae64c3ab4e59d50c7ff7fc5e0');

  const blobContent=Buffer.from('offline local model fixture');
  const blobHash=sha(blobContent);
  await mkdir(join(root,'blobs'));
  await writeFile(join(root,'blobs','sha256-'+blobHash),blobContent,{mode:0o400});
  const modelID='qwen2.5-coder:7b';
  const modelManifest=Buffer.from(JSON.stringify({
    schema:'tayar-local-model/v1',providerID:'ollama',modelID,
    blobSha256:blobHash,blobSize:blobContent.length,blobPath:'blobs/sha256-'+blobHash,
  }));
  const modelManifestPath=join(root,'model-manifest.json');
  await writeFile(modelManifestPath,modelManifest,{mode:0o400});
  assert.deepEqual(await verifyOfflineModel({manifestPath:modelManifestPath,
    expectedManifestSha256:sha(modelManifest),modelRoot:root,modelID}),{
    modelID,manifestSha256:sha(modelManifest),blobSha256:blobHash,blobSize:blobContent.length,
  });
  await assert.rejects(verifyOfflineModel({manifestPath:modelManifestPath,
    expectedManifestSha256:'0'.repeat(64),modelRoot:root,modelID}),
    {code:'model-manifest-mismatch'});

  const base = {
    platform:'linux-x64-baseline', workspaceDirectory:'/workspace/test-tenant-123',
    opencodeArchivePath:good, ollamaArchivePath:good, modelManifestPath:good,
    expectedModelManifestSha256:sha(modelManifest), modelID,
    runtimeRoot:root, modelRoot:root,
    forwardedEnvironment:{HOME:'/tmp',PATH:'/usr/local/bin:/usr/bin:/bin',
      OPENCODE_SERVER_PASSWORD:'fixture-password-123',OLLAMA_HOST:'127.0.0.1:11434',
      OLLAMA_MODELS:root,OLLAMA_NO_CLOUD:'1',NO_PROXY:'127.0.0.1,localhost'},
  };
  for (const [change, code] of [
    [{platform:'linux-x64'},'unsupported-runtime-platform'],
    [{workspaceDirectory:'/workspace/../customer'},'invalid-workspace'],
    [{forwardedEnvironment:{...base.forwardedEnvironment,OPENAI_API_KEY:'forbidden'}},
      'unsafe-runtime-environment'],
    [{forwardedEnvironment:{...base.forwardedEnvironment,OLLAMA_NO_CLOUD:undefined}},
      'unsafe-runtime-environment'],
    [{forwardedEnvironment:{...base.forwardedEnvironment,OLLAMA_HOST:'0.0.0.0:11434'}},
      'unsafe-runtime-environment'],
  ]) await assert.rejects(admitOpenCodeOfflineRuntime({...base,...change}),
    error => error instanceof OfflineRuntimeAdmissionError && error.code===code);
  // Real release pins deliberately cannot pass using tiny fixture bytes.
  await assert.rejects(admitOpenCodeOfflineRuntime(base), {code:'artifact-mismatch'});
  console.log('OpenCode offline runtime artifact admission regression passed (no download/inference).');
} finally { await rm(root,{recursive:true,force:true}); }
