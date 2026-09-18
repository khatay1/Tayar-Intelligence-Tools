import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOST = '127.0.0.1';
const VITE_PORT = 4173;
const CDP_PORT = 9222;
const FIXTURE_URL = `http://${HOST}:${VITE_PORT}/test-fixtures/website-builder-regression.html`;
const TEST_TIMEOUT_MS = 30_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(a, b, tolerance = 3) {
  return Math.abs(a - b) <= tolerance;
}

function resolveChromeBinary() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;

  const directCandidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const lookup = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], { encoding: 'utf8' });
    const resolved = lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/)[0] : '';
    if (resolved) return resolved;
  }

  throw new Error('Chrome/Chromium was not found. Set CHROME_BIN to a Chrome-compatible browser.');
}

async function waitForHttp(url, timeoutMs = 15_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function waitForJson(url, timeoutMs = 15_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function startProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  const output = [];
  const collect = (chunk) => {
    const text = String(chunk);
    output.push(text);
    if (output.length > 120) output.shift();
  };
  child.stdout?.on('data', collect);
  child.stderr?.on('data', collect);
  return { child, output };
}

async function stopProcess(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    sleep(1_500),
  ]);
  if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
}

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
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
      const callbacks = this.listeners.get(message.method) || [];
      callbacks.forEach((callback) => callback(message.params || {}));
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error(`CDP socket closed during ${pending.method}`));
      this.pending.clear();
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) || [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function runBrowserRegression() {
  const chromeBinary = resolveChromeBinary();
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const vite = startProcess(npmCommand, ['run', 'dev', '--', '--host', HOST, '--port', String(VITE_PORT), '--strictPort'], {
    env: {
      ...process.env,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://browser-regression.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'browser-regression-anon-key',
    },
  });

  let chrome;
  let cdp;
  const runtimeErrors = [];
  const browserConsoleErrors = [];

  try {
    await waitForHttp(FIXTURE_URL);

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tayar-builder-browser-'));
    chrome = startProcess(chromeBinary, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--window-size=1600,1000',
      'about:blank',
    ]);

    await waitForJson(`http://${HOST}:${CDP_PORT}/json/version`);
    const created = await fetch(`http://${HOST}:${CDP_PORT}/json/new?${encodeURIComponent(FIXTURE_URL)}`, { method: 'PUT' });
    assert(created.ok, `Chrome could not create a test target: ${created.status}`);
    const target = await created.json();
    assert(target.webSocketDebuggerUrl, 'Chrome test target did not expose a debugger WebSocket.');

    cdp = new CdpSession(target.webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      runtimeErrors.push(exceptionDetails?.exception?.description || exceptionDetails?.text || 'Unknown browser exception');
    });
    cdp.on('Runtime.consoleAPICalled', ({ type, args = [] }) => {
      if (type !== 'error') return;
      browserConsoleErrors.push(args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1600,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send('Page.navigate', { url: FIXTURE_URL });

    const evaluate = async (expression) => {
      const response = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || `Evaluation failed: ${expression}`);
      }
      return response.result?.value;
    };

    const waitFor = async (label, expression, timeoutMs = 10_000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (await evaluate(expression)) return;
        await sleep(100);
      }
      throw new Error(`Timed out waiting for ${label}.`);
    };

    const rectFor = async (selector, index = 0) => await evaluate(`(() => {
      const node = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
      if (!node) return null;
      node.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    })()`);

    const clickPoint = async (x, y, modifiers = 0, clickCount = 1) => {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, modifiers });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount, modifiers });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount, modifiers });
    };

    const clickSelector = async (selector, index = 0, modifiers = 0) => {
      const rect = await rectFor(selector, index);
      assert(rect && rect.width > 0 && rect.height > 0, `Missing or hidden browser target: ${selector}[${index}]`);
      await clickPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, modifiers);
      await sleep(80);
    };

    const doubleClickSelector = async (selector, index = 0) => {
      const rect = await rectFor(selector, index);
      assert(rect && rect.width > 0 && rect.height > 0, `Missing inline-edit target: ${selector}[${index}]`);
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      await clickPoint(x, y, 0, 1);
      await clickPoint(x, y, 0, 2);
      await sleep(80);
    };

    const dragSelector = async (selector, index, deltaX, deltaY) => {
      const rect = await rectFor(selector, index);
      assert(rect && rect.width > 4 && rect.height > 4, `Missing drag target: ${selector}[${index}]`);
      const startX = rect.left + Math.min(rect.width * 0.55, rect.width - 4);
      const startY = rect.top + Math.min(rect.height * 0.65, rect.height - 4);
      const steps = 6;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: startX, y: startY });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: startX, y: startY, button: 'left', buttons: 1, clickCount: 1 });
      for (let step = 1; step <= steps; step += 1) {
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: startX + (deltaX * step / steps),
          y: startY + (deltaY * step / steps),
          button: 'none',
          buttons: 1,
        });
        await sleep(20);
      }
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: startX + deltaX,
        y: startY + deltaY,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      });
      await sleep(120);
    };

    const canvasElementSnapshot = async (index) => await evaluate(`(() => {
      const node = document.querySelectorAll('[data-tayar-canvas-element-id]')[${index}];
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        id: node.dataset.tayarCanvasElementId,
        text: (node.textContent || '').trim(),
        transform: getComputedStyle(node).transform,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    })()`);

    const selectedCanvasIds = async () => await evaluate(`Array.from(document.querySelectorAll('[data-tayar-canvas-element-id]'))
      .filter((node) => String(node.className).includes('ring-violet-400/90'))
      .map((node) => node.dataset.tayarCanvasElementId)`);

    const pressCtrlKey = async (key, code, windowsVirtualKeyCode) => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: 2 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers: 2 });
    };

    await waitFor('Website Builder shell', `document.querySelector('.tayar-v2-shell') && document.querySelectorAll('[data-tayar-canvas-element-id]').length >= 2 && document.documentElement.dir === 'ltr'`);
    await sleep(250);

    const layout = await evaluate(`(() => {
      const read = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      return {
        shell: read('.tayar-v2-shell'),
        left: read('.tayar-v2-left-sidebar'),
        canvas: read('.tayar-v2-canvas'),
        inspector: read('.tayar-v2-inspector'),
      };
    })()`);
    assert(layout.shell?.width >= 1500, 'Desktop regression viewport did not initialize at desktop width.');
    assert(layout.left?.width > 0 && layout.canvas?.width > 0 && layout.inspector?.width > 0, 'Desktop Builder panels are not all visible.');
    assert(layout.left.right <= layout.canvas.left + 1, 'Left tools panel overlaps the canvas on desktop.');
    assert(layout.canvas.right <= layout.inspector.left + 1, 'Inspector overlaps the canvas on desktop.');
    console.log('[browser] PASS desktop panels do not overlap');

    const initialFirst = await canvasElementSnapshot(0);
    const initialSecond = await canvasElementSnapshot(1);
    assert(initialFirst?.id && initialSecond?.id, 'Default canvas elements were not rendered.');

    await clickSelector('[data-tayar-canvas-element-id]', 0);
    const dragBaseline = await canvasElementSnapshot(0);
    await dragSelector('[data-tayar-canvas-element-id]', 0, 64, 40);
    const draggedFirst = await canvasElementSnapshot(0);
    assert(
      Math.abs(draggedFirst.x - dragBaseline.x) >= 6 || Math.abs(draggedFirst.y - dragBaseline.y) >= 6,
      'Direct pointer drag did not change element position.',
    );
    console.log('[browser] PASS direct pointer drag changes X/Y');

    await waitFor('Undo after drag', `!document.querySelector('.tayar-v2-topbar__history button:first-child')?.disabled`);
    await clickSelector('.tayar-v2-topbar__history button', 0);
    const undoFirst = await canvasElementSnapshot(0);
    assert(
      nearlyEqual(undoFirst.x, dragBaseline.x, 4) && nearlyEqual(undoFirst.y, dragBaseline.y, 4),
      `Undo did not restore dragged element geometry. baseline=${JSON.stringify(dragBaseline)} undo=${JSON.stringify(undoFirst)}`,
    );

    await waitFor('Redo after drag', `!document.querySelector('.tayar-v2-topbar__history button:nth-child(2)')?.disabled`);
    await clickSelector('.tayar-v2-topbar__history button', 1);
    const redoFirst = await canvasElementSnapshot(0);
    assert(
      nearlyEqual(redoFirst.x, draggedFirst.x, 4) && nearlyEqual(redoFirst.y, draggedFirst.y, 4),
      `Redo did not restore dragged geometry. dragged=${JSON.stringify(draggedFirst)} redo=${JSON.stringify(redoFirst)}`,
    );
    console.log('[browser] PASS undo/redo restores real drag geometry');

    const beforeResize = await canvasElementSnapshot(0);
    const resizeHandles = await evaluate(`document.querySelectorAll('button[aria-label="Resize element"]').length`);
    assert(resizeHandles === 2, `Expected two resize handles for the selected element, found ${resizeHandles}.`);
    const rightHandle = await rectFor('button[aria-label="Resize element"]', 1);
    assert(rightHandle, 'Right resize handle is missing.');
    const resizeX = rightHandle.left + rightHandle.width / 2;
    const resizeY = rightHandle.top + rightHandle.height / 2;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: resizeX, y: resizeY });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: resizeX, y: resizeY, button: 'left', buttons: 1, clickCount: 1 });
    for (let step = 1; step <= 5; step += 1) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: resizeX - (80 * step / 5), y: resizeY, button: 'none', buttons: 1 });
      await sleep(20);
    }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: resizeX - 80, y: resizeY, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(120);
    const afterResize = await canvasElementSnapshot(0);
    assert(afterResize.width < beforeResize.width - 8, 'Pointer resize did not reduce selected element width.');
    console.log('[browser] PASS pointer resize changes element width');

    await doubleClickSelector('[data-tayar-canvas-element-id]', 0);
    await waitFor('inline content editing', `document.querySelectorAll('[data-tayar-canvas-element-id]')[0]?.isContentEditable === true`);
    await pressCtrlKey('a', 'KeyA', 65);
    await cdp.send('Input.insertText', { text: 'Browser regression edit' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await waitFor('inline edit commit', `document.querySelectorAll('[data-tayar-canvas-element-id]')[0]?.textContent?.trim() === 'Browser regression edit'`);
    console.log('[browser] PASS inline text editing commits through keyboard input');

    await clickSelector('[data-panel-id="layers"]');
    await waitFor('Layers panel', `document.querySelector('.tayar-v2-left-sidebar__panel[data-panel="layers"]') && document.querySelectorAll('.tayar-v2-layer-element').length >= 2`);
    await clickSelector('.tayar-v2-layer-element', 1);
    await sleep(80);
    let selectedIds = await selectedCanvasIds();
    assert(selectedIds.length === 1 && selectedIds[0] === initialSecond.id, 'Selecting an element in Layers did not synchronize canvas selection.');
    assert(await evaluate(`document.querySelector('.tayar-v2-inspector')?.dataset.target === 'element'`), 'Inspector did not synchronize to the element selected in Layers.');
    console.log('[browser] PASS Layers → canvas → inspector selection synchronization');

    await clickSelector('[data-tayar-canvas-element-id]', 0, 2);
    await sleep(100);
    selectedIds = await selectedCanvasIds();
    assert(selectedIds.includes(initialFirst.id) && selectedIds.includes(initialSecond.id) && selectedIds.length === 2, 'Ctrl-click did not create a two-element selection.');
    const selectedLayerCount = await evaluate(`document.querySelectorAll('.tayar-v2-layer-element-wrap[data-selected="true"] > .tayar-v2-layer-element').length`);
    assert(selectedLayerCount === 2, `Layers did not reflect multi-selection; expected 2 selected rows, found ${selectedLayerCount}.`);
    console.log('[browser] PASS canvas multi-select synchronizes with Layers');

    const startingZoom = await evaluate(`Number(document.querySelector('.tayar-v2-canvas')?.dataset.zoom)`);
    assert(startingZoom === 100, `Expected initial zoom 100, found ${startingZoom}.`);
    await clickSelector('button[aria-label="Zoom In"]');
    await waitFor('125% canvas zoom', `document.querySelector('.tayar-v2-canvas')?.dataset.zoom === '125'`);
    await clickSelector('button[aria-label^="Reset"]');
    await waitFor('100% canvas zoom reset', `document.querySelector('.tayar-v2-canvas')?.dataset.zoom === '100'`);
    console.log('[browser] PASS zoom control and reset');

    const viewportRect = await rectFor('.tayar-v2-canvas__viewport');
    if (viewportRect) {
      const centerX = viewportRect.left + viewportRect.width / 2;
      const centerY = viewportRect.top + Math.min(viewportRect.height / 2, 260);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centerX, y: centerY });
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await waitFor('canvas pan-ready mode', `document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panReady === 'true'`);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: centerX, y: centerY, button: 'left', buttons: 1, clickCount: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centerX - 30, y: centerY - 20, button: 'none', buttons: 1 });
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: centerX - 30, y: centerY - 20, button: 'left', buttons: 0, clickCount: 1 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
      await waitFor('canvas pan mode release', `document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panReady === 'false' && document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panning === 'false'`);
      console.log('[browser] PASS Space + pointer canvas pan lifecycle');
    }

    await sleep(100);
    assert(runtimeErrors.length === 0, `Browser runtime exceptions:\n${runtimeErrors.join('\n')}`);
    const relevantConsoleErrors = browserConsoleErrors.filter((message) => message && !message.includes('favicon.ico'));
    assert(relevantConsoleErrors.length === 0, `Browser console errors:\n${relevantConsoleErrors.join('\n')}`);
    console.log('[browser] PASS no runtime or console errors');
    console.log('[website-builder-browser-regression] PASS 9 desktop browser regressions');
  } catch (error) {
    const viteTail = vite.output.join('').split(/\r?\n/).slice(-30).join('\n');
    const chromeTail = chrome?.output.join('').split(/\r?\n/).slice(-30).join('\n') || '';
    console.error('[website-builder-browser-regression] FAIL');
    console.error(error instanceof Error ? error.stack : error);
    if (viteTail) console.error(`\n--- Vite tail ---\n${viteTail}`);
    if (chromeTail) console.error(`\n--- Chrome tail ---\n${chromeTail}`);
    throw error;
  } finally {
    cdp?.close();
    await stopProcess(chrome?.child);
    await stopProcess(vite.child);
  }
}

await Promise.race([
  runBrowserRegression(),
  sleep(TEST_TIMEOUT_MS).then(() => {
    throw new Error(`Website Builder browser regression exceeded ${TEST_TIMEOUT_MS / 1000}s.`);
  }),
]);
