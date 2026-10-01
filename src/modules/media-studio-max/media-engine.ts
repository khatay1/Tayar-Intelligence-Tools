import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { createMediaJobPlan } from './command-planner';
import type { MediaOperationId, MediaOperationSettings, MediaResult, MediaSourceFile } from './types';

const CORE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

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

function outputMatcher(pattern: string) {
  if (!pattern.includes('%')) return (name: string) => name === pattern;
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = escaped.replace(/%0?\d*d/g, '\\d+');
  const regex = new RegExp(`^${expression}$`);
  return (name: string) => regex.test(name);
}

class FFmpegWasmMediaEngine implements MediaEngine {
  private ffmpeg: FFmpeg | null = null;
  private loading: Promise<void> | null = null;
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

      this.loading = (async () => {
        const ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
          this.logCallbacks.forEach((callback) => callback(message));
        });
        ffmpeg.on('progress', ({ progress }) => {
          const normalized = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
          this.progressCallbacks.forEach((callback) => callback(normalized));
        });

        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
          toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
        ]);
        await ffmpeg.load({ coreURL, wasmURL });
        this.ffmpeg = ffmpeg;
      })().finally(() => {
        this.loading = null;
      });

      await this.loading;
    } finally {
      if (logCallback) this.logCallbacks.delete(logCallback);
      if (progressCallback) this.progressCallbacks.delete(progressCallback);
    }
  }

  cancel() {
    if (!this.ffmpeg) return;
    this.ffmpeg.terminate();
    this.ffmpeg = null;
    this.loading = null;
  }

  async process(operation: MediaOperationId, sources: MediaSourceFile[], settings: MediaOperationSettings = {}, events: MediaEngineEvents = {}) {
    if (!sources.length) throw new Error('No media input selected.');
    if (events.onLog) this.logCallbacks.add(events.onLog);
    if (events.onProgress) this.progressCallbacks.add(events.onProgress);

    await this.load();
    const ffmpeg = this.ffmpeg;
    if (!ffmpeg) throw new Error('Media engine did not initialize.');

    const plan = createMediaJobPlan(operation, sources, settings);
    const cleanup = new Set<string>();

    try {
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        const virtualName = plan.inputNames[index];
        cleanup.add(virtualName);
        await ffmpeg.writeFile(virtualName, new Uint8Array(await source.file.arrayBuffer()));
      }

      const exitCode = await ffmpeg.exec(plan.args);
      if (exitCode !== 0) throw new Error(`FFmpeg exited with code ${exitCode}.`);

      const matches = outputMatcher(plan.outputName);
      const entries = await ffmpeg.listDir('/');
      const outputNames = entries
        .filter((entry) => !entry.isDir && matches(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!outputNames.length && !plan.outputName.includes('%')) outputNames.push(plan.outputName);
      if (!outputNames.length) throw new Error('The media engine produced no output files.');

      const results: MediaResult[] = [];
      for (const outputName of outputNames) {
        cleanup.add(outputName);
        const data = await ffmpeg.readFile(outputName);
        const blob = asBlob(data, plan.outputMimeType);
        results.push({
          name: outputName,
          blob,
          mimeType: plan.outputMimeType,
          previewUrl: URL.createObjectURL(blob),
        });
      }
      return results;
    } finally {
      await Promise.allSettled(Array.from(cleanup).map(async (name) => {
        try { await ffmpeg.deleteFile(name); } catch { /* ignore virtual FS cleanup failures */ }
      }));
      if (events.onLog) this.logCallbacks.delete(events.onLog);
      if (events.onProgress) this.progressCallbacks.delete(events.onProgress);
    }
  }
}

export const mediaEngine: MediaEngine = new FFmpegWasmMediaEngine();
