import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`[media-studio-max] ${message}`);
};

const operationIds = [
  'video-to-images',
  'video-to-gif',
  'gif-to-video',
  'images-to-video',
  'audio-image-to-video',
  'trim-video',
  'split-video',
  'merge-videos',
  'compress-video',
  'convert-video',
  'remove-audio',
  'extract-audio',
  'add-audio',
  'replace-audio',
  'change-volume',
  'fade-audio',
  'change-speed',
  'reverse-video',
  'rotate-video',
  'flip-video',
  'resize-video',
  'crop-video',
  'change-aspect-ratio',
  'change-fps',
  'add-subtitles',
  'burn-subtitles',
  'add-text-watermark',
  'add-image-watermark',
  'create-thumbnail',
  'loop-video',
  'freeze-frame',
  'remove-metadata',
];

const types = read('src/modules/media-studio-max/types.ts');
const catalog = read('src/modules/media-studio-max/catalog.ts');
const planner = read('src/modules/media-studio-max/command-planner.ts');
const engine = read('src/modules/media-studio-max/media-engine.ts');
const translations = read('src/modules/media-studio-max/i18n.ts');
const operationTranslations = read('src/modules/media-studio-max/operation-i18n.ts');
const moduleIndex = read('src/modules/media-studio-max/index.ts');
const globalModuleIndex = read('src/modules/index.ts');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));

for (const id of operationIds) {
  assert(types.includes(`| '${id}'`), `types are missing ${id}`);
  assert(catalog.includes(`id: '${id}'`), `catalog is missing ${id}`);
  assert(planner.includes(`case '${id}'`), `command planner is missing ${id}`);
}

assert(moduleIndex.includes("id: 'media-studio-max'"), 'tool module id is not registered');
assert(globalModuleIndex.includes("import './media-studio-max';"), 'global module index does not load Media Studio MAX');
assert(translations.includes('en: {') && translations.includes('ar: {') && translations.includes('sv: {'), 'generic EN/AR/SV translations are incomplete');
assert(operationTranslations.includes('const ar:') && operationTranslations.includes('const sv:'), 'operation translations are incomplete');
assert(engine.includes('.ffprobe('), 'engine does not probe input media streams');
assert(engine.includes("operation === 'add-text-watermark'"), 'text watermark rendering path is missing');
assert(engine.includes('ffmpeg.deleteFile'), 'virtual file-system cleanup is missing');
assert(packageJson.dependencies?.['@ffmpeg/ffmpeg'], '@ffmpeg/ffmpeg is missing from package.json');
assert(packageJson.dependencies?.['@ffmpeg/util'], '@ffmpeg/util is missing from package.json');
assert(packageLock.packages?.['node_modules/@ffmpeg/ffmpeg'], '@ffmpeg/ffmpeg is missing from package-lock.json');
assert(packageLock.packages?.['node_modules/@ffmpeg/util'], '@ffmpeg/util is missing from package-lock.json');

console.log(`[media-studio-max] OK — ${operationIds.length} operations, EN/AR/SV localization, FFmpeg engine and lockfile wiring verified.`);
