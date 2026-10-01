import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOST = '127.0.0.1';
const VITE_PORT = 4174;
const CDP_PORT = 9224;
const FIXTURE = `http://${HOST}:${VITE_PORT}/test-fixtures/media-studio-max-regression.html`;
const TIMEOUT_MS = 240_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const EXPECTED_OPERATIONS = [
  'Video to Images', 'Video to GIF', 'GIF to Video', 'Images to Video', 'Audio + Image to Video',
  'Trim Video', 'Split Video', 'Merge Videos', 'Change Speed', 'Reverse Video', 'Loop Video', 'Freeze Frame',
  'Remove Audio', 'Extract Audio', 'Add Audio', 'Replace Audio', 'Change Volume', 'Audio Fade',
  'Rotate Video', 'Flip Video', 'Resize Video', 'Crop Video', 'Change Aspect Ratio', 'Change FPS',
  'Add Subtitle Track', 'Burn Subtitles', 'Text Watermark', 'Image Watermark', 'Create Thumbnail',
  'Compress Video', 'Convert Video Format', 'Remove Metadata',
];

function chromeBinary() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = [
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Chrome/Chromium was not found. Set CHROME_BIN.');
}

function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  const output = [];
  const capture = (chunk) => { output.push(String(chunk)); if (output.length > 160) output.shift(); };
  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);
  return { child, output };
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(1200)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function waitHttp(url, timeout = 20_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) { lastError = error; }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result || {});
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    });
  }

  on(method, listener) {
    const current = this.listeners.get(method) || [];
    current.push(listener);
    this.listeners.set(method, current);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.id++;
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.socket.close(); }
}

async function regression() {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const vite = start(npm, ['run', 'dev', '--', '--host', HOST, '--port', String(VITE_PORT), '--strictPort'], {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://media-regression.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'media-regression-anon-key',
    },
  });
  let chrome;
  let cdp;
  const chromeAttempts = [];
  const userDataDirs = [];
  const runtimeErrors = [];
  const consoleErrors = [];

  try {
    await waitHttp(FIXTURE);
    const launchChrome = async (headlessFlag) => {
      const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tayar-media-browser-'));
      userDataDirs.push(userDataDir);
      const attempt = start(chromeBinary(), [
        headlessFlag, '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
        '--disable-background-networking', '--disable-component-update', '--disable-sync', '--metrics-recording-only',
        '--mute-audio', '--no-sandbox', '--autoplay-policy=no-user-gesture-required',
        `--remote-debugging-address=${HOST}`, `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`, '--window-size=1500,1100', 'about:blank',
      ]);
      chromeAttempts.push(attempt);
      try {
        await waitHttp(`http://${HOST}:${CDP_PORT}/json/version`, 12_000);
        return attempt;
      } catch {
        await stop(attempt.child);
        return null;
      }
    };

    chrome = await launchChrome('--headless=new') || await launchChrome('--headless');
    assert(chrome, 'Chrome did not expose the debugging endpoint.');
    const targetResponse = await fetch(`http://${HOST}:${CDP_PORT}/json/new?${encodeURIComponent(FIXTURE)}`, { method: 'PUT' });
    assert(targetResponse.ok, `Chrome could not create the test target: ${targetResponse.status}`);
    const target = await targetResponse.json();
    assert(target.webSocketDebuggerUrl, 'Chrome did not expose a debugger WebSocket.');

    cdp = new CDP(target.webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => runtimeErrors.push(
      exceptionDetails?.exception?.description || exceptionDetails?.text || 'Unknown browser exception',
    ));
    cdp.on('Runtime.consoleAPICalled', ({ type, args = [] }) => {
      if (type === 'error') consoleErrors.push(args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
    });
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: FIXTURE });

    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed.');
      return result.result?.value;
    };
    const waitFor = async (label, expression, timeout = 20_000) => {
      const started = Date.now();
      let lastValue;
      while (Date.now() - started < timeout) {
        lastValue = await evaluate(expression);
        if (lastValue) return lastValue;
        await sleep(120);
      }
      throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
    };
    const bodyText = async () => await evaluate('document.body.innerText');
    const clickOperation = async (name) => {
      const clicked = await evaluate(`(() => {
        const target = Array.from(document.querySelectorAll('button')).find((button) => (button.textContent || '').includes(${JSON.stringify(name)}));
        if (!target) return false;
        target.click();
        return true;
      })()`);
      assert(clicked, `Could not find operation button: ${name}`);
      await sleep(120);
    };
    const upload = async (keys) => {
      const uploaded = await evaluate(`(() => {
        const input = document.querySelector('[data-testid="media-file-input"]');
        if (!input || !window.__tayarMediaFiles) return false;
        const transfer = new DataTransfer();
        for (const key of ${JSON.stringify(keys)}) {
          const file = window.__tayarMediaFiles[key];
          if (!file) return false;
          transfer.items.add(file);
        }
        Object.defineProperty(input, 'files', { configurable: true, value: transfer.files });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      assert(uploaded, `Could not upload generated media files: ${keys.join(', ')}`);
      await waitFor('selected files', `document.body.innerText.includes('Selected files')`);
    };
    const setNumber = async (labelText, value) => {
      const changed = await evaluate(`(() => {
        const label = Array.from(document.querySelectorAll('label')).find((node) => (node.textContent || '').includes(${JSON.stringify(labelText)}));
        const input = label?.querySelector('input[type="number"], input[type="range"]');
        if (!input) return false;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        descriptor?.set?.call(input, ${JSON.stringify(String(value))});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      assert(changed, `Could not set ${labelText} to ${value}.`);
      await sleep(80);
    };
    const setSelect = async (labelText, value) => {
      const changed = await evaluate(`(() => {
        const label = Array.from(document.querySelectorAll('label')).find((node) => (node.textContent || '').includes(${JSON.stringify(labelText)}));
        const select = label?.querySelector('select');
        if (!select) return false;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
        descriptor?.set?.call(select, ${JSON.stringify(String(value))});
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`);
      assert(changed, `Could not set ${labelText} to ${value}.`);
      await sleep(80);
    };
    const process = async (label, timeout = 90_000) => {
      await waitFor(`${label} process button`, `(() => {
        const button = document.querySelector('[data-testid="media-process"]');
        return Boolean(button && !button.disabled);
      })()`);
      const clicked = await evaluate(`(() => {
        const button = document.querySelector('[data-testid="media-process"]');
        if (!button || button.disabled) return false;
        button.click();
        return true;
      })()`);
      assert(clicked, `Could not start ${label}.`);
      await waitFor(`${label} output`, `document.querySelectorAll('[data-testid="media-result"]').length > 0 || Boolean(document.querySelector('[data-testid="media-error"]'))`, timeout);
      const resultCount = await evaluate(`document.querySelectorAll('[data-testid="media-result"]').length`);
      if (!resultCount) throw new Error(`${label} produced no result. Page tail: ${(await bodyText()).slice(-1800)}`);
      return resultCount;
    };
    const resultBlob = async (selector) => await evaluate(`(async () => {
      const media = document.querySelector(${JSON.stringify(selector)});
      if (!media?.src) return null;
      const blob = await fetch(media.src).then((response) => response.blob());
      const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
      return { size: blob.size, type: blob.type, signature: Array.from(bytes) };
    })()`);

    await waitFor('Media Studio MAX title', `document.body.innerText.includes('Media Studio MAX')`);
    assert(await evaluate(`document.documentElement.dir === 'ltr'`), 'English fixture must be LTR.');
    for (const name of EXPECTED_OPERATIONS) {
      assert(await evaluate(`document.body.innerText.includes(${JSON.stringify(name)})`), `Missing operation in browser UI: ${name}`);
    }
    console.log(`[media-browser] PASS catalog renders ${EXPECTED_OPERATIONS.length} operations`);

    const generated = await evaluate(`(async () => {
      const makeVideo = async (name, hue) => {
        if (typeof MediaRecorder === 'undefined') throw new Error('MediaRecorder is unavailable.');
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(12);
        const type = ['video/webm;codecs=vp8', 'video/webm'].find((value) => MediaRecorder.isTypeSupported(value));
        if (!type) throw new Error('No supported WebM MediaRecorder codec.');
        const chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 180000 });
        recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
        const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));
        let frame = 0;
        const draw = () => {
          ctx.fillStyle = 'hsl(' + ((hue + frame * 8) % 360) + ' 70% 42%)';
          ctx.fillRect(0, 0, 160, 90);
          ctx.fillStyle = '#fff';
          ctx.font = '20px sans-serif';
          ctx.fillText('T' + frame, 12, 32);
          ctx.fillStyle = '#111827';
          ctx.fillRect((frame * 9) % 130, 55, 28, 20);
          frame += 1;
        };
        draw();
        const timer = setInterval(draw, 70);
        recorder.start(100);
        await new Promise((resolve) => setTimeout(resolve, 1150));
        clearInterval(timer);
        recorder.stop();
        await stopped;
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type });
        return new File([blob], name, { type });
      };

      const makeWav = () => {
        const sampleRate = 16000;
        const seconds = 1.2;
        const sampleCount = Math.floor(sampleRate * seconds);
        const buffer = new ArrayBuffer(44 + sampleCount * 2);
        const view = new DataView(buffer);
        const text = (offset, value) => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
        text(0, 'RIFF'); view.setUint32(4, 36 + sampleCount * 2, true); text(8, 'WAVE');
        text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        text(36, 'data'); view.setUint32(40, sampleCount * 2, true);
        for (let i = 0; i < sampleCount; i += 1) {
          const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.28;
          view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
        }
        return new File([buffer], 'tone.wav', { type: 'audio/wav' });
      };

      const makePng = async (name, color, text) => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color; ctx.fillRect(0, 0, 160, 90);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(text, 18, 50);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('PNG fixture generation failed.');
        return new File([blob], name, { type: 'image/png' });
      };

      window.__tayarMediaFiles = {
        silentA: await makeVideo('silent-a.webm', 260),
        silentB: await makeVideo('silent-b.webm', 190),
        tone: makeWav(),
        imageA: await makePng('image-a.png', '#7c3aed', 'TAYAR A'),
        imageB: await makePng('image-b.png', '#0891b2', 'TAYAR B'),
      };
      return Object.fromEntries(Object.entries(window.__tayarMediaFiles).map(([key, file]) => [key, { size: file.size, type: file.type }]));
    })()`);
    assert(generated?.silentA?.size > 1000 && generated?.tone?.size > 1000, 'Generated browser media fixtures are unexpectedly small.');
    console.log('[media-browser] PASS generated real video/audio/image fixtures in Chromium');

    await clickOperation('Video to GIF');
    await upload(['silentA']);
    await setNumber('Width', 240);
    await setNumber('FPS', 8);
    await process('video-to-gif');
    const gif = await resultBlob('article img');
    assert(gif?.size > 500, 'GIF output is empty.');
    const gifMagic = String.fromCharCode(...gif.signature.slice(0, 6));
    assert(gifMagic === 'GIF87a' || gifMagic === 'GIF89a', `Unexpected GIF signature: ${gifMagic}`);
    console.log(`[media-browser] PASS video-to-gif (${gif.size} bytes)`);

    await clickOperation('Video to Images');
    await upload(['silentA']);
    await setNumber('Frame interval', 0.25);
    const frameCount = await process('video-to-images');
    assert(frameCount >= 3, `Expected at least 3 extracted frames, received ${frameCount}.`);
    const firstFrame = await resultBlob('article img');
    assert(firstFrame?.signature?.[0] === 137 && firstFrame?.signature?.[1] === 80, 'Extracted frame is not PNG data.');
    assert(await evaluate(`Array.from(document.querySelectorAll('button')).some((button) => (button.textContent || '').includes('Download all'))`), 'Multi-result Download all action is missing.');
    console.log(`[media-browser] PASS video-to-images (${frameCount} frames + ZIP action)`);

    await clickOperation('Images to Video');
    await upload(['imageA', 'imageB']);
    await setNumber('Duration', 0.35);
    await setNumber('FPS', 10);
    await setNumber('Width', 320);
    await setNumber('Height', 180);
    await process('images-to-video');
    const imageVideo = await resultBlob('article video');
    assert(imageVideo?.size > 1000, 'Images-to-video output is empty.');
    console.log(`[media-browser] PASS images-to-video (${imageVideo.size} bytes)`);

    await clickOperation('Add Audio');
    await upload(['silentA', 'tone']);
    await setSelect('Output format', 'mp4');
    await process('add-audio');
    const audioVideo = await resultBlob('article video');
    assert(audioVideo?.size > 1000, 'Add-audio output is empty.');
    const capturedAudioVideo = await evaluate(`(async () => {
      const video = document.querySelector('article video');
      if (!video?.src) return false;
      const blob = await fetch(video.src).then((response) => response.blob());
      window.__tayarMediaFiles.withAudio = new File([blob], 'with-audio.mp4', { type: 'video/mp4' });
      return blob.size;
    })()`);
    assert(capturedAudioVideo > 1000, 'Could not retain add-audio output for follow-up checks.');
    console.log(`[media-browser] PASS add-audio (${capturedAudioVideo} bytes)`);

    await clickOperation('Extract Audio');
    await upload(['withAudio']);
    await setSelect('Output format', 'wav');
    await process('extract-audio');
    const extractedAudio = await resultBlob('article audio');
    assert(extractedAudio?.size > 500, 'Extract-audio output is empty.');
    console.log(`[media-browser] PASS extract-audio (${extractedAudio.size} bytes)`);

    await clickOperation('Change Speed');
    await upload(['silentA']);
    await setSelect('Speed', '1.5');
    await process('silent change-speed');
    const speedVideo = await resultBlob('article video');
    assert(speedVideo?.size > 1000, 'Silent change-speed output is empty.');
    console.log('[media-browser] PASS silent-video change-speed path');

    await clickOperation('Merge Videos');
    await upload(['silentA', 'silentB']);
    await setNumber('Width', 160);
    await setNumber('Height', 90);
    await process('silent merge-videos');
    const mergedVideo = await resultBlob('article video');
    assert(mergedVideo?.size > 1000, 'Silent merge output is empty.');
    console.log('[media-browser] PASS silent-video merge path');

    await cdp.send('Page.navigate', { url: `${FIXTURE}?lang=ar` });
    await waitFor('Arabic Media Studio', `document.body.innerText.includes('استوديو الوسائط MAX') && document.body.innerText.includes('فيديو إلى GIF')`);
    assert(await evaluate(`document.documentElement.dir === 'rtl' && document.querySelector('#root > div')?.getAttribute('dir') === 'rtl'`), 'Arabic Media Studio must render RTL.');
    console.log('[media-browser] PASS Arabic localization + RTL');

    await cdp.send('Page.navigate', { url: `${FIXTURE}?lang=sv` });
    await waitFor('Swedish Media Studio', `document.body.innerText.includes('Video till GIF') && document.body.innerText.includes('Bearbeta media')`);
    assert(await evaluate(`document.documentElement.dir === 'ltr'`), 'Swedish Media Studio must render LTR.');
    console.log('[media-browser] PASS Swedish localization');

    await sleep(300);
    const relevantConsoleErrors = consoleErrors.filter((line) => !line.includes('favicon'));
    assert(runtimeErrors.length === 0, `Runtime exceptions detected:\n${runtimeErrors.join('\n')}`);
    assert(relevantConsoleErrors.length === 0, `Console errors detected:\n${relevantConsoleErrors.join('\n')}`);
    console.log('[media-studio-browser-regression] PASS real Chromium media scenarios');
  } finally {
    cdp?.close();
    await stop(chrome?.child);
    for (const attempt of chromeAttempts) await stop(attempt.child);
    await stop(vite.child);
    for (const dir of userDataDirs) fs.rmSync(dir, { recursive: true, force: true });
  }
}

const hardTimeout = setTimeout(() => {
  console.error(`[media-studio-browser-regression] FAIL hard timeout after ${TIMEOUT_MS / 1000}s`);
  process.exit(1);
}, TIMEOUT_MS);

regression()
  .catch((error) => {
    console.error('[media-studio-browser-regression] FAIL');
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(hardTimeout));
