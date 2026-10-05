import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const revoked = [];
let nextUrl = 0;
const urls = { createObjectURL: () => `blob:${++nextUrl}`, revokeObjectURL: u => revoked.push(u) };

function engineHarness() {
  const workers = [];
  let fetchGate = null;
  class FFmpeg {
    loaded = false;
    handlers = {};
    writes = 0;
    terminated = false;
    constructor() { workers.push(this); }
    on(name, fn) { this.handlers[name] = fn; }
    async load() { if (this.bootGate) await this.bootGate.promise; this.loaded = true; }
    terminate() { this.terminated = true; this.loaded = false; }
    async writeFile() { this.writes++; }
    async exec() { return 0; }
    async listDir() { return [{ name: 'frame_00001.png' }, { name: 'frame_00002.png' }]; }
    async readFile(name) { if (name === this.failRead) throw new Error('read failed'); return new Uint8Array([1]); }
    async deleteFile() {}
  }
  let code = read('src/modules/media-studio-max/media-engine.ts').replace(/^import .*;\n/gm, '').replace('export const mediaEngine:', 'const mediaEngine:');
  code = stripTypeScriptTypes(code.replace(/export interface/g, 'interface')) + '\nglobalThis.engine = mediaEngine;';
  const context = vm.createContext({ FFmpeg, ffmpegClassWorkerURL: 'worker',
    createMediaInputNames: () => ['input.png'],
    createMediaJobPlan: () => ({ args: [], outputName: 'frame_%05d.png', outputMimeType: 'image/png' }),
    URL: urls, Blob, File, AbortController, AbortSignal, TextDecoder, Uint8Array,
    window: { setTimeout, clearTimeout },
    fetch: async (_url, options) => {
      if (fetchGate) await Promise.race([fetchGate.promise, new Promise((_, reject) => {
        if (options.signal.aborted) reject(new Error('aborted'));
        else options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      })]);
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) };
    },
  });
  vm.runInContext(code, context);
  return { engine: context.engine, workers, gate: value => { fetchGate = value; } };
}
const source = { kind: 'image', file: new File(['x'], 'x.png') };

{
  const h = engineHarness(), gate = deferred(); h.gate(gate);
  const loading = h.engine.load(); const rejection = assert.rejects(loading, /CANCELLED|aborted/);
  h.engine.cancel();
  await rejection;
  gate.resolve(); await tick();
  assert.equal(h.engine.isLoaded(), false, 'cancelled download must not revive the engine');
  assert.equal(h.workers[0].terminated, true);
  h.gate(null); await h.engine.load();
  assert.equal(h.engine.isLoaded(), true, 'retry after cancellation must load a fresh worker');
}
{
  const h = engineHarness(); const gate = deferred();
  const loading = h.engine.load(); h.workers[0].bootGate = gate;
  const rejection = assert.rejects(loading, /CANCELLED/);
  await tick(); h.engine.cancel();
  const retry = h.engine.load(); await retry;
  gate.resolve(); await rejection;
  assert.equal(h.workers[0].terminated, true);
  assert.equal(h.engine.isLoaded(), true, 'old boot completion must not clear the retry worker');
  assert.equal(h.engine.loading, null);
}
{
  const h = engineHarness();
  h.engine.load = async () => { throw new Error('download failed'); };
  await assert.rejects(h.engine.process('video-to-images', [source], {}, { onLog() {}, onProgress() {} }), /download failed/);
  assert.equal(h.engine.logCallbacks.size, 0, 'load failure must remove job log callbacks');
  assert.equal(h.engine.progressCallbacks.size, 0);
}
{
  const h = engineHarness(); await h.engine.load();
  const gate = deferred();
  const processing = h.engine.process('video-to-images', [{ ...source, file: { arrayBuffer: () => gate.promise } }]);
  const rejection = assert.rejects(processing, /CANCELLED/);
  await tick(); h.engine.cancel(); gate.resolve(new ArrayBuffer(1)); await rejection;
  assert.equal(h.workers[0].writes, 0, 'cancel during file read must not write to the terminated worker');
}
{
  const h = engineHarness(); await h.engine.load(); h.workers[0].failRead = 'frame_00002.png';
  const before = revoked.length;
  await assert.rejects(h.engine.process('video-to-images', [source]), /read failed/);
  assert.equal(revoked.length, before + 1, 'partial output previews must be revoked on failure');
}

// Execute the actual component handlers with deterministic hook state; no JSX/render or FFmpeg download is needed.
function studioHarness() {
  const state = [], refs = [], effects = [];
  let cursor = 0, refCursor = 0, effectCursor = 0;
  const pendingFiles = [], loads = [], jobs = [];
  let cancellations = 0;
  const dispose = sources => sources.forEach(s => urls.revokeObjectURL(s.objectUrl));
  let code = read('src/modules/media-studio-max/MediaStudioMax.tsx');
  code = code.slice(code.indexOf('interface Props'), code.indexOf('  const card ='));
  code = code.replace('export default function MediaStudioMax', 'function MediaStudioMax');
  code += '\n return { addFiles, chooseOperation, clearSources, processMedia, cancelProcessing };\n}\nglobalThis.render = () => MediaStudioMax({ darkMode: true });';
  const context = vm.createContext({
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef: initial => refs[refCursor++] ||= { current: initial },
    useEffect: fn => { const i = effectCursor++; if (i < 2) fn(); else if (!effects[i]) effects[i] = fn(); },
    useMemo: fn => fn(), usePreferences: () => ({ prefs: { language: 'en' } }),
    MEDIA_OPERATIONS: [], getMediaOperation: () => ({ input: ['video'], acceptsMultiple: false }),
    getLocalizedOperation: () => ({}), mediaStudioText: (_, key) => key,
    createMediaSource: () => { const gate = deferred(); pendingFiles.push(gate); return gate.promise; },
    disposeSources: dispose, URL: urls,
    mediaEngine: { isLoaded: () => false, cancel: () => { cancellations++; },
      load: () => { const gate = deferred(); loads.push(gate); return gate.promise; },
      process: () => { const gate = deferred(); jobs.push(gate); return gate.promise; } },
  });
  vm.runInContext(stripTypeScriptTypes(code), context);
  return { state, loads, jobs, pendingFiles, cancellations: () => cancellations,
    render() { cursor = refCursor = effectCursor = 0; return context.render(); },
    unmount() { effects.filter(Boolean).forEach(fn => fn()); } };
}
{
  const h = studioHarness(); let ui = h.render();
  const upload = ui.addFiles([{}]); ui.chooseOperation('trim-video');
  const before = revoked.length; h.pendingFiles[0].resolve({ objectUrl: 'blob:stale', kind: 'video' });
  await upload; assert.equal(h.state[3].length, 0); assert.equal(revoked.length, before + 1);
}
{
  const h = studioHarness(); let ui = h.render();
  const upload = ui.addFiles([{}]); h.pendingFiles[0].resolve({ objectUrl: 'blob:input', kind: 'video' }); await upload;
  ui = h.render(); const old = ui.processMedia(); ui.cancelProcessing();
  const current = ui.processMedia();
  h.loads[0].resolve(); await old;
  assert.equal(h.jobs.length, 0, 'cancelled load must not start processing');
  assert.equal(h.state[6], true, 'old finally must not reset a new job');
  h.loads[1].resolve(); await tick(); h.jobs[0].resolve([]); await current;
  assert.equal(h.state[6], false);
}
{
  const h = studioHarness(); let ui = h.render();
  const upload = ui.addFiles([{}]); h.pendingFiles[0].resolve({ objectUrl: 'blob:input', kind: 'video' }); await upload;
  ui = h.render(); const job = ui.processMedia(); h.loads[0].resolve(); await tick();
  ui.cancelProcessing(); const before = revoked.length;
  h.jobs[0].resolve([{ previewUrl: 'blob:late-result' }]); await job;
  assert.equal(h.state[5].length, 0); assert.equal(revoked.length, before + 1);
}
{
  const h = studioHarness(); let ui = h.render();
  const upload = ui.addFiles([{}]); h.unmount();
  const before = revoked.length; h.pendingFiles[0].resolve({ objectUrl: 'blob:unmounted', kind: 'video' }); await upload;
  assert.equal(h.state[3].length, 0); assert.equal(revoked.length, before + 1);
}
{
  const h = studioHarness(); let ui = h.render();
  const upload = ui.addFiles([{}]); h.pendingFiles[0].resolve({ objectUrl: 'blob:input', kind: 'video' }); await upload;
  ui = h.render(); const job = ui.processMedia(); h.unmount();
  h.loads[0].resolve(); await job;
  assert.equal(h.cancellations(), 1, 'unmount must cancel the active worker');
  assert.equal(h.jobs.length, 0);
}
console.log('Media Studio lifecycle regression: 10 targeted cases passed.');
