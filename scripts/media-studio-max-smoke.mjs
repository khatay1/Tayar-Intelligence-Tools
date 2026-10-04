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
const studio = read('src/modules/media-studio-max/MediaStudioMax.tsx');
const moduleIndex = read('src/modules/media-studio-max/index.ts');
const globalModuleIndex = read('src/modules/index.ts');
const browserHarness = read('src/test/media-studio-max-browser-regression.tsx');
const browserFixture = read('test-fixtures/media-studio-max-regression.html');
const browserRegression = read('scripts/media-studio-max-browser-regression.mjs');
const ffmpegWorkerEntry = read('src/modules/media-studio-max/ffmpeg-class-worker.js');
const viteConfig = read('vite.config.ts');
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
assert(translations.includes('engineTimeout:') && translations.includes('engineDownloadFailed:'), 'engine timeout/download translations are missing');
assert(operationTranslations.includes('const ar:') && operationTranslations.includes('const sv:'), 'operation translations are incomplete');

assert(engine.includes('.ffprobe('), 'engine does not probe input media streams');
assert(engine.includes("operation === 'add-text-watermark'"), 'text watermark rendering path is missing');
assert(engine.includes('ffmpeg.deleteFile'), 'virtual file-system cleanup is missing');
assert(engine.includes('AbortController'), 'FFmpeg core download has no abort/timeout protection');
assert(engine.includes('cdn.jsdelivr.net') && engine.includes('unpkg.com'), 'FFmpeg core mirror fallback is missing');
assert(engine.includes('MEDIA_ENGINE_LOAD_TIMEOUT') && engine.includes('MEDIA_ENGINE_DOWNLOAD_FAILED'), 'engine failure codes are missing');
assert(engine.includes('PROBE_TIMEOUT_MS'), 'FFprobe timeout protection is missing');
assert(engine.includes('classWorkerURL: ffmpegClassWorkerURL'), 'explicit FFmpeg class worker wiring is missing');
assert(engine.includes('jobLogs.slice(-10)'), 'FFmpeg failure diagnostics are missing');
assert(ffmpegWorkerEntry.includes("@ffmpeg/ffmpeg/worker"), 'Vite FFmpeg worker entry is missing');
assert(viteConfig.includes("'@ffmpeg/ffmpeg'") && viteConfig.includes("'@ffmpeg/util'"), 'Vite FFmpeg optimizer exclusions are missing');

assert(planner.includes('anullsrc=channel_layout=stereo'), 'silent-video merge fallback is missing');
assert(planner.includes("input-audio-unconfirmed"), 'safe audio-operation fallback is missing');
assert(planner.includes('source.hasAudio !== true'), 'merge fallback does not protect unconfirmed audio tracks');
assert(planner.includes("sources[0]?.hasAudio !== true"), 'audio filters do not protect unconfirmed input audio');
assert(planner.includes("'-c:s', 'mov_text'"), 'soft subtitle MP4 codec wiring is missing');
assert(planner.includes('`subtitles=${inputs[1]}`'), 'burned subtitle filter is missing');
assert(planner.includes('colorchannelmixer=aa=${opacity}'), 'watermark opacity pipeline is missing');
assert(planner.includes("'-stream_loop'"), 'video loop command is missing');
assert(planner.includes('tpad=stop_mode=clone'), 'freeze-frame command is missing');
assert(planner.includes("'-map_metadata', '-1'"), 'metadata removal command is missing');

assert(studio.includes('data-testid="media-studio-max"'), 'Media Studio browser QA root hook is missing');
assert(studio.includes('data-testid="media-file-input"'), 'Media Studio file-input QA hook is missing');
assert(studio.includes('data-testid="media-process"'), 'Media Studio process QA hook is missing');
assert(studio.includes('data-testid="media-result"'), 'Media Studio result QA hook is missing');
assert(studio.includes("t('engineTimeout')") && studio.includes("t('engineDownloadFailed')"), 'localized engine failure mapping is missing');

assert(browserHarness.includes('<MediaStudioMax darkMode />'), 'real-browser harness does not mount Media Studio MAX');
assert(browserFixture.includes('media-studio-max-browser-regression.tsx'), 'browser fixture does not load the Media Studio harness');
assert(browserRegression.includes('MediaRecorder'), 'browser regression does not generate real video fixtures');
assert(browserRegression.includes('video-to-gif'), 'browser regression does not cover video-to-GIF');
assert(browserRegression.includes('images-to-video'), 'browser regression does not cover images-to-video');
assert(browserRegression.includes("add-audio"), 'browser regression does not cover adding audio');
assert(browserRegression.includes("extract-audio"), 'browser regression does not cover extracting audio');
assert(browserRegression.includes("silent change-speed"), 'browser regression does not cover silent speed changes');
assert(browserRegression.includes('silent merge-videos'), 'browser regression does not cover silent video merging');
assert(browserRegression.includes("?lang=ar") && browserRegression.includes("?lang=sv"), 'browser regression does not cover Arabic and Swedish');

assert(packageJson.dependencies?.['@ffmpeg/ffmpeg'], '@ffmpeg/ffmpeg is missing from package.json');
assert(packageJson.dependencies?.['@ffmpeg/util'], '@ffmpeg/util is missing from package.json');
assert(packageJson.scripts?.['smoke:media-studio'], 'Media Studio smoke npm script is missing');
assert(packageJson.scripts?.['smoke:media-studio:browser'], 'Media Studio browser npm script is missing');
assert(packageLock.packages?.['node_modules/@ffmpeg/ffmpeg'], '@ffmpeg/ffmpeg is missing from package-lock.json');
assert(packageLock.packages?.['node_modules/@ffmpeg/util'], '@ffmpeg/util is missing from package-lock.json');

console.log(`[media-studio-max] OK — ${operationIds.length} operations, EN/AR/SV localization, resilient FFmpeg loading, silent-video handling and browser QA wiring verified.`);
