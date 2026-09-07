import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(mobileRoot, 'assets/icon.png.b64');
const outputPath = resolve(mobileRoot, 'assets/icon.png');
const EXPECTED_SHA256 = '31b54a8b70751e16e2900c755fe3b13bca2d00e89c43ce5223538ce6a163301a';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const encoded = (await readFile(sourcePath, 'utf8')).replace(/\s+/g, '');
if (!encoded) throw new Error('Mobile icon source is empty.');

const bytes = Buffer.from(encoded, 'base64');
if (bytes.length < 32 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
  throw new Error('Mobile icon source is not a PNG.');
}

const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width !== 1024 || height !== 1024) {
  throw new Error(`Mobile icon must be 1024x1024, got ${width}x${height}.`);
}

const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== EXPECTED_SHA256) {
  throw new Error(`Mobile icon integrity check failed: ${sha256}.`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
console.log(`Verified Tayar mobile icon written to ${outputPath} (${bytes.length} bytes).`);
