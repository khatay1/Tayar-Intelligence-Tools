import { FFmpeg } from '@ffmpeg/ffmpeg';
import ffmpegClassWorkerURL from './ffmpeg-class-worker.js?worker&url';
import { createMediaInputNames, createMediaJobPlan } from './command-planner';
import type { MediaOperationId, MediaOperationSettings, MediaResult, MediaSourceFile } from './types';

const CORE_VERSION = '0.12.10';
const CORE_SOURCES = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];
const CORE_FETCH_TIMEOUT_MS = 20_000;
const CORE_BOOT_TIMEOUT_MS = 90_000;
const PROBE_TIMEOUT_MS = 12_000;

export interface MediaEngineEvents {
  onProgress?: (progress: number) => void;
  onLog?: (message: string) => void;
}

export interface MediaEngine {
  load(events?: MediaEngineEvents): Promise<void>;
  process(operation: MediaOperationId, sources: MediaSourceFile[], settings?: MediaOperationSettings, events?: MediaEngineEvents): Promise<MediaResult[]>;
  cancel(): void;
  isLoaded(): boolean;
}

function asBlob(data: Uint8Array | string, mimeType: string) {
  if (typeof data === 'string') return new Blob([data], { type: mimeType });
  const copied = Uint8Array.from(data);
  return new Blob([copied.buffer], { type: mimeType });
}

function asText(data: Uint8Array | string) {
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

function outputMatcher(pattern: string) {
  if (!pattern.includes('%')) return (name: string) => name === pattern;
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = escaped.replace(/%0?\d*d/g, '\\d+');
  const regex = new RegExp(`^${expression}$`);
  return (name: string) => regex.test(name);
}

async function fetchCoreBytes(url: string, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timeout = window.setTimeout(abort, CORE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'force-cache',
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.arrayBuffer();
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

async function loadCoreBlobUrls(signal: AbortSignal) {
  let lastError: unknown;
  for (const baseUrl of CORE_SOURCES) {
    try {
      const [coreBytes, wasmBytes] = await Promise.all([
        fetchCoreBytes(`${baseUrl}/ffmpeg-core.js`, signal),
        fetchCoreBytes(`${baseUrl}/ffmpeg-core.wasm`, signal),
      ]);
      return {
        coreURL: URL.createObjectURL(new Blob([coreBytes], { type: 'text/javascript' })),
        wasmURL: URL.createObjectURL(new Blob([wasmBytes], { type: 'application/wasm' })),
      };
    } catch (error) {
      if (signal.aborted) throw new Error('MEDIA_ENGINE_CANCELLED');
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError || 'unknown error');
  throw new Error(`MEDIA_ENGINE_DOWNLOAD_FAILED:${reason}`);
}

async function bootFFmpeg(ffmpeg: FFmpeg, urls: { coreURL: string; wasmURL: string }) {
  let timeout: number | undefined;
  try {
    await Promise.race([
      ffmpeg.load({ ...urls, classWorkerURL: ffmpegClassWorkerURL }),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => {
          try { ffmpeg.terminate(); } catch { /* worker may already be stopped */ }
          reject(new Error('MEDIA_ENGINE_LOAD_TIMEOUT'));
        }, CORE_BOOT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not render text watermark.')), 'image/png');
  });
}

async function createTextWatermarkSource(text: string): Promise<MediaSourceFile> {
  const value = text.trim() || 'Tayar';
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable in this browser.');

  const fontSize = 48;
  const paddingX = 24;
  const paddingY = 16;
  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  const measured = Math.ceil(context.measureText(value).width);
  canvas.width = Math.min(1400, Math.max(180, measured + paddingX * 2));
  canvas.height = fontSize + paddingY * 2;

  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  context.textBaseline = 'middle';
  context.direction = /[\u0590-\u08ff]/.test(value) ? 'rtl' : 'ltr';
  context.textAlign = context.direction === 'rtl' ? 'right' : 'left';
  context.fillStyle = 'rgba(0, 0, 0, 0.48)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  const x = context.direction === 'rtl' ? canvas.width - paddingX : paddingX;
  context.fillText(value, x, canvas.height / 2, canvas.width - paddingX * 2);

  const blob = await canvasToBlob(canvas);
  const file = new File([blob], 'tayar-text-watermark.png', { type: 'image/png' });
  return {
    id: `text-watermark-${Date.now()}`,
    file,
    objectUrl: '',
    kind: 'image',
    width: canvas.width,
    height: canvas.height,
  };
}

async function probeVideoSource(ffmpeg: FFmpeg, inputName: string, source: MediaSourceFile, index: number, cleanup: Set<string>) {
  if (source.kind !== 'video') return source;
  const probeName = `probe_${index}.json`;
  cleanup.add(probeName);

  try {
    const exitCode = await ffmpeg.ffprobe([
      '-v', 'error',
      '-show_entries', 'stream=codec_type:format=duration',
      '-of', 'json',
      inputName,
      '-o', probeName,
    ], PROBE_TIMEOUT_MS);
    if (exitCode !== 0) return source;
    const probeData = await ffmpeg.readFile(probeName, 'utf8');
    const parsed = JSON.parse(asText(probeData)) as {
      streams?: Array<{ codec_type?: string }>;
      format?: { duration?: string };
    };
    const probedDuration = Number(parsed.format?.duration);
    return {
      ...source,
      hasAudio: Boolean(parsed.streams?.some((stream) => stream.codec_type === 'audio')),
      duration: Number.isFinite(probedDuration) && probedDuration > 0 ? probedDuration : source.duration,
    };
  } catch {
    return source;
  }
}

class FFmpegWasmMediaEngine implements MediaEngine {
  private ffmpeg: FFmpeg | null = null;
  private loading: Promise<void> | null = null;
  private generation = 0;
  private loadController: AbortController | null = null;
  private logCallbacks = new Set<(message: string) => void>();
  private progressCallbacks = new Set<(progress: number) => void>();

  isLoaded() {
    return Boolean(this.ffmpeg?.loaded);
  }

  async load(events: MediaEngineEvents = {}) {
    const logCallback = events.onLog;
    const progressCallback = events.onProgress;
    if (logCallback) this.logCallbacks.add(logCallback);
    if (progressCallback) this.progressCallbacks.add(progressCallback);

    try {
      if (this.ffmpeg?.loaded) return;
      if (this.loading) return await this.loading;

      const generation = this.generation;
      const controller = new AbortController();
      this.loadController = controller;
      const ffmpeg = new FFmpeg();
      this.ffmpeg = ffmpeg;
      const loading = (async () => {
        ffmpeg.on('log', ({ message }) => {
          this.logCallbacks.forEach((callback) => callback(message));
        });
        ffmpeg.on('progress', ({ progress }) => {
          const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
          this.progressCallbacks.forEach((callback) => callback(normalized));
        });

        const urls = await loadCoreBlobUrls(controller.signal);
        try {
          if (generation !== this.generation) throw new Error('MEDIA_ENGINE_CANCELLED');
          await bootFFmpeg(ffmpeg, urls);
          if (generation !== this.generation) throw new Error('MEDIA_ENGINE_CANCELLED');
        } finally {
          URL.revokeObjectURL(urls.coreURL);
          URL.revokeObjectURL(urls.wasmURL);
        }
      })().catch((error) => {
        try { ffmpeg.terminate(); } catch { /* worker may already be stopped */ }
        if (this.ffmpeg === ffmpeg) this.ffmpeg = null;
        throw error;
      }).finally(() => {
        if (this.loading === loading) {
          this.loading = null;
          this.loadController = null;
        }
      });
      this.loading = loading;

      await loading;
    } finally {
      if (logCallback) this.logCallbacks.delete(logCallback);
      if (progressCallback) this.progressCallbacks.delete(progressCallback);
    }
  }

  cancel() {
    this.generation += 1;
    this.loadController?.abort();
    this.loadController = null;
    this.ffmpeg?.terminate();
    this.ffmpeg = null;
    this.loading = null;
  }

  async process(operation: MediaOperationId, sources: MediaSourceFile[], settings: MediaOperationSettings = {}, events: MediaEngineEvents = {}) {
    if (!sources.length) throw new Error('No media input selected.');
    if (events.onLog) this.logCallbacks.add(events.onLog);
    if (events.onProgress) this.progressCallbacks.add(events.onProgress);
    const jobLogs: string[] = [];
    const captureJobLog = (message: string) => {
      const normalized = message.trim();
      if (!normalized) return;
      jobLogs.push(normalized);
      if (jobLogs.length > 24) jobLogs.shift();
    };
    this.logCallbacks.add(captureJobLog);

    const generation = this.generation;
    const assertCurrent = () => {
      if (generation !== this.generation) throw new Error('MEDIA_ENGINE_CANCELLED');
    };
    let ffmpeg: FFmpeg | null = null;
    const cleanup = new Set<string>();
    const results: MediaResult[] = [];

    try {
      await this.load();
      assertCurrent();
      ffmpeg = this.ffmpeg;
      if (!ffmpeg) throw new Error('Media engine did not initialize.');

      const workingSources = operation === 'add-text-watermark'
        ? [...sources, await createTextWatermarkSource(settings.text || 'Tayar')]
        : [...sources];
      const inputNames = createMediaInputNames(workingSources);
      assertCurrent();

      for (let index = 0; index < workingSources.length; index += 1) {
        const source = workingSources[index];
        const virtualName = inputNames[index];
        cleanup.add(virtualName);
        const bytes = new Uint8Array(await source.file.arrayBuffer());
        assertCurrent();
        await ffmpeg.writeFile(virtualName, bytes);
        assertCurrent();
      }

      const enrichedSources = await Promise.all(
        workingSources.map((source, index) => probeVideoSource(ffmpeg!, inputNames[index], source, index, cleanup)),
      );
      assertCurrent();
      const plan = createMediaJobPlan(operation, enrichedSources, settings);
      const exitCode = await ffmpeg.exec(plan.args);
      assertCurrent();
      if (exitCode !== 0) {
        const detail = jobLogs.slice(-10).join(' | ');
        throw new Error(`FFmpeg exited with code ${exitCode}.${detail ? ` ${detail}` : ''}`);
      }

      const matches = outputMatcher(plan.outputName);
      const entries = await ffmpeg.listDir('/');
      assertCurrent();
      const outputNames = entries
        .filter((entry) => !entry.isDir && matches(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!outputNames.length && !plan.outputName.includes('%')) outputNames.push(plan.outputName);
      if (!outputNames.length) throw new Error('The media engine produced no output files.');

      for (const outputName of outputNames) {
        cleanup.add(outputName);
        const data = await ffmpeg.readFile(outputName);
        assertCurrent();
        const blob = asBlob(data, plan.outputMimeType);
        results.push({
          name: outputName,
          blob,
          mimeType: plan.outputMimeType,
          previewUrl: URL.createObjectURL(blob),
        });
      }
      return results;
    } catch (error) {
      results.forEach(result => URL.revokeObjectURL(result.previewUrl));
      throw error;
    } finally {
      await Promise.allSettled(Array.from(cleanup).map(async (name) => {
        try { await ffmpeg?.deleteFile(name); } catch { /* ignore virtual FS cleanup failures */ }
      }));
      this.logCallbacks.delete(captureJobLog);
      if (events.onLog) this.logCallbacks.delete(events.onLog);
      if (events.onProgress) this.progressCallbacks.delete(events.onProgress);
    }
  }
}

export const mediaEngine: MediaEngine = new FFmpegWasmMediaEngine();

