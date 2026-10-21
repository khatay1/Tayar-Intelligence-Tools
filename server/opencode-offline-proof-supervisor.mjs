/**
 * Trusted host-side lifecycle for Issue #310's offline OpenCode proof.
 *
 * This module does not create a sandbox itself. The operator-owned adapter must
 * enforce the confinement contract below and expose only these bounded methods.
 * No browser/customer input may supply the adapter, runtime paths or secrets.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { admitOpenCodeOfflineRuntime } from './opencode-offline-runtime-admission.mjs';
import { planWithOpenCodeV2 } from './opencode-v2-local-planner.mjs';

const TASK_ID = /^[A-Za-z0-9_-]{3,60}$/;
const SANDBOX_ID = /^[A-Za-z0-9_-]{8,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MAX_FILES = 50_000;
const MAX_BYTES = 512 * 1024 * 1024;

export class OfflineProofError extends Error {
  constructor(code) { super(code); this.code = code; this.name = 'OfflineProofError'; }
}

function fail(code) { throw new OfflineProofError(code); }

function inside(root, candidate) {
  const path = relative(root, candidate);
  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
}

/** Hash a bounded regular-file tree without following links. */
export async function snapshotOfflineWorkspace({
  workspaceDirectory, workspaceRoot = '/workspace',
}) {
  if (typeof workspaceDirectory !== 'string' || typeof workspaceRoot !== 'string' ||
      !isAbsolute(workspaceDirectory) || !isAbsolute(workspaceRoot) ||
      resolve(workspaceDirectory) !== workspaceDirectory || resolve(workspaceRoot) !== workspaceRoot) {
    fail('invalid-workspace');
  }
  let rootPath, workspacePath;
  try { [rootPath, workspacePath] = await Promise.all([realpath(workspaceRoot), realpath(workspaceDirectory)]); }
  catch { fail('workspace-unreadable'); }
  if (!inside(rootPath, workspacePath)) fail('invalid-workspace');

  const entries = [];
  async function visit(directory) {
    let names;
    try { names = await readdir(directory); } catch { fail('workspace-unreadable'); }
    names.sort();
    for (const name of names) {
      const path = resolve(directory, name);
      let stat, canonical;
      try { [stat, canonical] = await Promise.all([lstat(path), realpath(path)]); }
      catch { fail('workspace-unreadable'); }
      if (!inside(workspacePath, canonical) || stat.isSymbolicLink()) fail('unsafe-workspace-entry');
      if (stat.isDirectory()) { await visit(path); continue; }
      if (!stat.isFile()) fail('unsafe-workspace-entry');
      if (entries.length >= MAX_FILES || stat.size > MAX_BYTES) fail('workspace-too-large');
      entries.push({ path, relativePath: relative(workspacePath, path), size: stat.size });
    }
  }
  await visit(workspacePath);

  const hash = createHash('sha256');
  let bytes = 0;
  for (const entry of entries) {
    bytes += entry.size;
    if (bytes > MAX_BYTES) fail('workspace-too-large');
    hash.update(entry.relativePath); hash.update('\0'); hash.update(String(entry.size)); hash.update('\0');
    try { for await (const chunk of createReadStream(entry.path)) hash.update(chunk); }
    catch { fail('workspace-unreadable'); }
    hash.update('\0');
  }
  return Object.freeze({ sha256: hash.digest('hex'), files: entries.length, bytes });
}

function validateAdmission(receipt, taskId) {
  if (receipt?.schema !== 'tayar-opencode-offline-admission/v1' ||
      receipt.workspaceDirectory !== `/workspace/${taskId}` ||
      receipt.opencode?.version !== 'v1.19.3' || receipt.ollama?.version !== 'v0.40.6' ||
      !SHA256.test(receipt.opencode?.sha256 ?? '') || !SHA256.test(receipt.ollama?.sha256 ?? '') ||
      receipt.model?.modelID?.length < 1 || !SHA256.test(receipt.model?.manifestSha256 ?? '') ||
      !SHA256.test(receipt.model?.blobSha256 ?? '') || !Number.isSafeInteger(receipt.model?.blobSize) ||
      receipt.model.blobSize < 1 || receipt.commercialModelApiFees !== false ||
      receipt.inferenceExecuted !== false) fail('invalid-admission');
}

function validateConfinement(receipt, taskId, workspaceDirectory) {
  if (receipt?.schema !== 'tayar-opencode-confinement/v1' ||
      !SANDBOX_ID.test(receipt.sandboxId ?? '') || receipt.taskId !== taskId ||
      receipt.workspaceDirectory !== workspaceDirectory || !Number.isSafeInteger(receipt.uid) ||
      receipt.uid < 1 || receipt.networkMode !== 'none' ||
      receipt.rootFilesystemReadonly !== true || receipt.workspaceReadonly !== true ||
      receipt.dockerSocketMounted !== false || receipt.credentialsPresent !== false ||
      receipt.externalTcpDenied !== true || receipt.externalDnsDenied !== true ||
      receipt.pidNamespaceIsolated !== true) fail('unsafe-confinement');
}

function validateRuntime(runtime, admission) {
  let url;
  try { url = new URL(runtime?.origin); } catch { fail('invalid-runtime'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.pathname !== '/' || url.search || url.hash || runtime.opencodeVersion !== admission.opencode.version ||
      runtime.ollamaVersion !== admission.ollama.version || runtime.providerID !== 'ollama' ||
      runtime.modelID !== admission.model.modelID || typeof runtime.serverPassword !== 'string' ||
      !/^[\x21-\x7e]{16,256}$/.test(runtime.serverPassword) || typeof runtime.fetcher !== 'function') {
    fail('invalid-runtime');
  }
}

/**
 * Compose the real admission/planner with an operator-owned sandbox adapter.
 * Dependency overrides exist only for deterministic server-side regression tests.
 */
export function createOfflineOpenCodeProofSupervisor({
  admitRuntime = admitOpenCodeOfflineRuntime,
  planner = planWithOpenCodeV2,
  snapshotWorkspace = snapshotOfflineWorkspace,
  createSandbox,
} = {}) {
  if (typeof admitRuntime !== 'function' || typeof planner !== 'function' ||
      typeof snapshotWorkspace !== 'function' || typeof createSandbox !== 'function') {
    fail('invalid-supervisor');
  }
  return async function runOfflineOpenCodeProof({ taskId, prompt, admissionInput }) {
    if (!TASK_ID.test(taskId ?? '') || typeof prompt !== 'string' || !prompt.trim()) {
      fail('invalid-proof-request');
    }
    const workspaceDirectory = `/workspace/${taskId}`;
    if (admissionInput?.workspaceDirectory !== workspaceDirectory) fail('invalid-proof-request');
    const admission = await admitRuntime(admissionInput);
    validateAdmission(admission, taskId);
    const before = await snapshotWorkspace({ workspaceDirectory });
    if (!SHA256.test(before?.sha256 ?? '') || !Number.isSafeInteger(before?.files) ||
        !Number.isSafeInteger(before?.bytes)) fail('invalid-workspace-snapshot');

    let sandbox, runtime, runtimeRunning = false, confinement, result, primaryError, cleanupError;
    try {
      sandbox = await createSandbox({ taskId, workspaceDirectory, admission });
      if (!sandbox || typeof sandbox.verifyConfinement !== 'function' ||
          typeof sandbox.startRuntime !== 'function' || typeof sandbox.stopRuntime !== 'function' ||
          typeof sandbox.destroy !== 'function') fail('invalid-sandbox-adapter');
      confinement = await sandbox.verifyConfinement();
      validateConfinement(confinement, taskId, workspaceDirectory);
      runtime = await sandbox.startRuntime({ modelID: admission.model.modelID });
      runtimeRunning = true;
      validateRuntime(runtime, admission);
      const planned = await planner({
        config: { enabled:true, isolated:true, offline:true, readonlyWorktree:true,
          runtimeVersion:admission.opencode.version, providerID:'ollama',
          modelID:admission.model.modelID, baseUrl:runtime.origin,
          workspaceDirectory, serverPassword:runtime.serverPassword },
        prompt, fetcher:runtime.fetcher,
      });
      if (planned?.mode !== 'read-only' || planned.providerID !== 'ollama' ||
          planned.modelID !== admission.model.modelID || typeof planned.plan !== 'string' ||
          !planned.plan.trim()) fail('invalid-proof-result');
      try { await sandbox.stopRuntime(); runtimeRunning = false; }
      catch { fail('runtime-cleanup-failed'); }
      const after = await snapshotWorkspace({ workspaceDirectory });
      if (after.sha256 !== before.sha256 || after.files !== before.files || after.bytes !== before.bytes) {
        fail('workspace-mutated');
      }
      result = { confinement, planned, before };
    } catch (error) { primaryError = error; }
    finally {
      if (sandbox) {
        try { if (runtimeRunning) await sandbox.stopRuntime(); }
        catch { cleanupError = new OfflineProofError('runtime-cleanup-failed'); }
        try {
          const destroyed = await sandbox.destroy();
          if (destroyed?.destroyed !== true || destroyed.sandboxId !== confinement?.sandboxId &&
              destroyed.sandboxId !== undefined) throw new Error();
        } catch { cleanupError ??= new OfflineProofError('sandbox-destroy-failed'); }
      }
    }
    if (cleanupError) throw cleanupError;
    if (primaryError) throw primaryError;
    return Object.freeze({
      schema:'tayar-opencode-offline-proof/v1', taskId,
      sandboxId:result.confinement.sandboxId, workspaceDirectory,
      workspace:Object.freeze(result.before),
      opencode:Object.freeze({version:admission.opencode.version,sha256:admission.opencode.sha256}),
      ollama:Object.freeze({version:admission.ollama.version,sha256:admission.ollama.sha256}),
      model:Object.freeze({...admission.model}),
      providerID:'ollama', mode:'read-only', plan:result.planned.plan,
      commercialModelApiFees:false, inferenceExecuted:true,
      externalTcpDenied:true, externalDnsDenied:true, workspaceUnchanged:true,
      runtimeStopped:true, sandboxDestroyed:true,
    });
  };
}
