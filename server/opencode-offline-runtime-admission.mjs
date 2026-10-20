/**
 * Host-side artifact admission for the disabled OpenCode/Ollama pilot.
 * This module performs local file verification only. It does not download,
 * extract, launch, expose, or pay for any runtime or model.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';

const SHA256 = /^[a-f0-9]{64}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const WORKSPACE = /^\/workspace\/[A-Za-z0-9_-]{3,60}$/;
const RUNTIME_ROOT = '/opt/tayar-opencode-runtime';
const MODEL_ROOT = '/opt/tayar-opencode-models';
const ALLOWED_ENVIRONMENT_KEYS = new Set([
  'HOME', 'PATH', 'OPENCODE_SERVER_PASSWORD', 'OLLAMA_HOST',
  'OLLAMA_MODELS', 'OLLAMA_NO_CLOUD', 'NO_PROXY',
]);

// GitHub's immutable release asset digests, inspected from the release API.
// Pin archives before extraction; a version string alone is not provenance.
export const OFFLINE_RUNTIME_RELEASES = Object.freeze({
  opencode: Object.freeze({
    version: 'v1.19.3',
    assets: Object.freeze({
      'linux-x64-baseline': Object.freeze({
        name: 'opencode-linux-x64-baseline.tar.gz', size: 60_716_645,
        sha256: '531cff2441129c30f0edd5878af494108ad07f5feb46d7ee29a2a5b830a5765d',
      }),
      'linux-arm64': Object.freeze({
        name: 'opencode-linux-arm64.tar.gz', size: 60_519_745,
        sha256: '7900818a6a98881edbbadab4b7525940eff3b9750040c200481f9f56cacee405',
      }),
    }),
  }),
  ollama: Object.freeze({
    version: 'v0.40.6',
    assets: Object.freeze({
      'linux-amd64': Object.freeze({
        name: 'ollama-linux-amd64.tar.zst', size: 1_438_364_593,
        sha256: 'c164ab8b1b28e2a247c29719b8e404c423c5b83ae64c3ab4e59d50c7ff7fc5e0',
      }),
      'linux-arm64': Object.freeze({
        name: 'ollama-linux-arm64.tar.zst', size: 1_560_414_226,
        sha256: '0a279d9428ad17b06fdb7dddf3b059b2c148433585fa3b30676a102fc459bb9f',
      }),
    }),
  }),
});

export class OfflineRuntimeAdmissionError extends Error {
  constructor(code) { super(code); this.code = code; this.name = 'OfflineRuntimeAdmissionError'; }
}

function fail(code) { throw new OfflineRuntimeAdmissionError(code); }

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

async function containedRegularFile(path, root, errorCode) {
  let rootPath, filePath, stat;
  try { [rootPath,filePath,stat]=await Promise.all([realpath(root),realpath(path),lstat(path)]); }
  catch { fail(errorCode); }
  if (!inside(rootPath,filePath) || stat.isSymbolicLink() || !stat.isFile() ||
      (stat.mode & 0o022) !== 0) fail(errorCode);
  return { filePath, stat };
}

async function sha256File(path, maximumBytes) {
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of createReadStream(path)) {
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) fail('artifact-too-large');
      hash.update(chunk);
    }
  } catch (error) {
    if (error instanceof OfflineRuntimeAdmissionError) throw error;
    fail('artifact-unreadable');
  }
  return { bytes, sha256: hash.digest('hex') };
}

/** Verify one already-downloaded immutable artifact without following links. */
export async function verifyOfflineArtifact({ path, root, expected }) {
  if (typeof path !== 'string' || typeof root !== 'string' ||
      !isAbsolute(path) || !isAbsolute(root) || resolve(path) !== path ||
      typeof expected?.name !== 'string' || !Number.isSafeInteger(expected?.size) ||
      expected.size < 1 || !SHA256.test(expected?.sha256 ?? '')) fail('invalid-artifact-policy');
  const {filePath:artifactPath,stat}=await containedRegularFile(path,root,'artifact-mismatch');
  if (stat.size !== expected.size) fail('artifact-mismatch');
  const observed = await sha256File(artifactPath, expected.size);
  if (observed.bytes !== expected.size || observed.sha256 !== expected.sha256) {
    fail('artifact-mismatch');
  }
  return Object.freeze({ name: expected.name, size: observed.bytes, sha256: observed.sha256 });
}

function releaseAsset(product, platform) {
  const release = OFFLINE_RUNTIME_RELEASES[product];
  const asset = release?.assets?.[platform];
  if (!asset) fail('unsupported-runtime-platform');
  return { release, asset };
}

function verifyEnvironmentKeys(keys) {
  if (!Array.isArray(keys) || keys.length !== new Set(keys).size ||
      keys.some(key => typeof key !== 'string' || !ALLOWED_ENVIRONMENT_KEYS.has(key))) {
    fail('unsafe-runtime-environment');
  }
  for (const required of ['HOME', 'PATH', 'OPENCODE_SERVER_PASSWORD', 'OLLAMA_HOST',
    'OLLAMA_MODELS', 'OLLAMA_NO_CLOUD']) {
    if (!keys.includes(required)) fail('unsafe-runtime-environment');
  }
}

export async function verifyOfflineModel({ manifestPath, expectedManifestSha256, modelRoot, modelID }) {
  if (!SHA256.test(expectedManifestSha256 ?? '') || typeof manifestPath !== 'string' ||
      !isAbsolute(manifestPath) || resolve(manifestPath) !== manifestPath) {
    fail('invalid-model-policy');
  }
  const {filePath}=await containedRegularFile(manifestPath,modelRoot,'model-manifest-unreadable');
  let bytes;
  try { bytes = await readFile(filePath); } catch { fail('model-manifest-unreadable'); }
  if (bytes.byteLength < 2 || bytes.byteLength > 16_384 ||
      createHash('sha256').update(bytes).digest('hex') !== expectedManifestSha256) {
    fail('model-manifest-mismatch');
  }
  let manifest;
  try { manifest = JSON.parse(bytes.toString('utf8')); } catch { fail('model-manifest-invalid'); }
  if (manifest?.schema !== 'tayar-local-model/v1' || manifest.providerID !== 'ollama' ||
      manifest.modelID !== modelID || !MODEL_ID.test(modelID ?? '') ||
      /cloud|online|remote/i.test(modelID) || !SHA256.test(manifest.blobSha256 ?? '') ||
      !Number.isSafeInteger(manifest.blobSize) || manifest.blobSize < 1 ||
      manifest.blobSize > 20_000_000_000 ||
      manifest.blobPath !== `blobs/sha256-${manifest.blobSha256}`) {
    fail('model-manifest-invalid');
  }
  const blob = await verifyOfflineArtifact({
    path: resolve(modelRoot, manifest.blobPath), root: modelRoot,
    expected: { name: manifest.modelID, size: manifest.blobSize, sha256: manifest.blobSha256 },
  });
  return Object.freeze({ modelID, manifestSha256: expectedManifestSha256,
    blobSha256: blob.sha256, blobSize: blob.size });
}

/**
 * Verify artifacts that a trusted isolated supervisor has already downloaded.
 * The returned receipt is safe metadata; it is not proof of confinement or inference.
 */
export async function admitOpenCodeOfflineRuntime({
  platform, opencodeArchivePath, ollamaArchivePath, modelManifestPath,
  expectedModelManifestSha256, modelID, workspaceDirectory,
  forwardedEnvironmentKeys, runtimeRoot = RUNTIME_ROOT, modelRoot = MODEL_ROOT,
}) {
  if (!WORKSPACE.test(workspaceDirectory ?? '')) fail('invalid-workspace');
  verifyEnvironmentKeys(forwardedEnvironmentKeys);
  const opencodePin = releaseAsset('opencode', platform);
  const ollamaPlatform = platform === 'linux-x64-baseline' ? 'linux-amd64' : platform;
  const ollamaPin = releaseAsset('ollama', ollamaPlatform);
  if (basename(opencodeArchivePath ?? '') !== opencodePin.asset.name ||
      basename(ollamaArchivePath ?? '') !== ollamaPin.asset.name) fail('artifact-mismatch');
  const [opencode, ollama, model] = await Promise.all([
    verifyOfflineArtifact({ path: opencodeArchivePath, root: runtimeRoot, expected: opencodePin.asset }),
    verifyOfflineArtifact({ path: ollamaArchivePath, root: runtimeRoot, expected: ollamaPin.asset }),
    verifyOfflineModel({ manifestPath: modelManifestPath, expectedManifestSha256,
      modelRoot, modelID }),
  ]);
  return Object.freeze({
    schema: 'tayar-opencode-offline-admission/v1', workspaceDirectory,
    opencode: Object.freeze({ version: opencodePin.release.version, ...opencode }),
    ollama: Object.freeze({ version: ollamaPin.release.version, ...ollama }), model,
    commercialModelApiFees: false, inferenceExecuted: false,
  });
}
