import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const target = resolve(appRoot, 'assets/models/u2netp_d0_320_fp16.tflite');
const temp = `${target}.download`;

const MODEL = {
  url: 'https://huggingface.co/thetechgeekko/latent-android-models/resolve/main/u2netp_d0_320_fp16.tflite?download=true',
  bytes: 2_378_688,
  sha256: '357bd5214d6725efd88dc1578de5308f8a80c6df63ac3f35c2021e955f4a4bc5',
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function validExistingFile() {
  try {
    const bytes = await readFile(target);
    return bytes.byteLength === MODEL.bytes && sha256(bytes) === MODEL.sha256;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(dirname(target), { recursive: true });
  if (await validExistingFile()) {
    console.log('U2Netp mobile model already verified.');
    return;
  }

  await rm(temp, { force: true });
  const response = await fetch(MODEL.url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Tayar-Tools-Mobile-Build/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Model download failed with HTTP ${response.status}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== MODEL.bytes) {
    throw new Error(`Model byte length mismatch: expected ${MODEL.bytes}, received ${bytes.byteLength}.`);
  }
  const digest = sha256(bytes);
  if (digest !== MODEL.sha256) {
    throw new Error(`Model SHA-256 mismatch: expected ${MODEL.sha256}, received ${digest}.`);
  }

  await writeFile(temp, bytes);
  await rename(temp, target);
  console.log(`Verified U2Netp model written to ${target}.`);
}

main().catch(async (error) => {
  await rm(temp, { force: true }).catch(() => undefined);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
