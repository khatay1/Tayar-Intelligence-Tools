import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const HOST = '127.0.0.1';
const VITE_PORT = 4173;
const CDP_PORT = 9222;
const URL = `http://${HOST}:${VITE_PORT}/test-fixtures/website-builder-regression.html`;
const TIMEOUT_MS = 40_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const near = (a, b, tolerance = 3) => Math.abs(a - b) <= tolerance;

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
  const capture = (chunk) => { output.push(String(chunk)); if (output.length > 120) output.shift(); };
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

async function waitHttp(url, timeout = 15_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) { lastError = error; }
    await sleep(120);
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
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://browser-regression.supabase.co',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'browser-regression-anon-key',
    },
  });
  let chrome;
  let cdp;
  const runtimeErrors = [];
  const consoleErrors = [];

  try {
    await waitHttp(URL);
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tayar-builder-browser-'));
    chrome = start(chromeBinary(), [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--mute-audio', '--no-sandbox',
      `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${userDataDir}`, '--window-size=1600,1000', 'about:blank',
    ]);
    await waitHttp(`http://${HOST}:${CDP_PORT}/json/version`);
    const targetResponse = await fetch(`http://${HOST}:${CDP_PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' });
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: URL });

    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed.');
      return result.result?.value;
    };
    const waitFor = async (label, expression, timeout = 10_000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        if (await evaluate(expression)) return;
        await sleep(80);
      }
      throw new Error(`Timed out waiting for ${label}.`);
    };
    const rect = async (selector, index = 0, scroll = true) => await evaluate(`(() => {
      const node = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
      if (!node) return null;
      ${scroll ? "node.scrollIntoView({ block: 'center', inline: 'center' });" : ''}
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    })()`);
    const snapshot = async (index) => await evaluate(`(() => {
      const node = document.querySelectorAll('[data-tayar-canvas-element-id]')[${index}];
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { id: node.dataset.tayarCanvasElementId, text: (node.textContent || '').trim(), x: r.x, y: r.y, width: r.width, height: r.height, transform: getComputedStyle(node).transform };
    })()`);
    const mouse = async (type, x, y, buttons = 0, button = 'none', modifiers = 0, clickCount = 1) => {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, buttons, button, modifiers, clickCount, pointerType: 'mouse' });
    };
    const clickPoint = async (x, y, modifiers = 0, count = 1) => {
      await mouse('mouseMoved', x, y, 0, 'none', modifiers, count);
      await mouse('mousePressed', x, y, 1, 'left', modifiers, count);
      await mouse('mouseReleased', x, y, 0, 'left', modifiers, count);
    };
    const click = async (selector, index = 0, modifiers = 0) => {
      const r = await rect(selector, index);
      assert(r?.width > 0 && r?.height > 0, `Missing or hidden target: ${selector}[${index}]`);
      await clickPoint(r.left + r.width / 2, r.top + r.height / 2, modifiers);
      await sleep(70);
    };
    const drag = async (selector, index, deltaX, deltaY, { scroll = true } = {}) => {
      const r = await rect(selector, index, scroll);
      assert(r?.width > 3 && r?.height > 3, `Missing drag target: ${selector}[${index}]`);
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      await mouse('mouseMoved', x, y);
      await mouse('mousePressed', x, y, 1, 'left', 0, 1);
      for (let step = 1; step <= 6; step += 1) {
        await mouse('mouseMoved', x + (deltaX * step / 6), y + (deltaY * step / 6), 1, 'none');
        await sleep(18);
      }
      await mouse('mouseReleased', x + deltaX, y + deltaY, 0, 'left', 0, 1);
      await sleep(100);
    };
    const ctrlKey = async (key, code, vk) => {
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: 2 });
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: 2 });
    };

    await waitFor('Website Builder desktop shell', `document.querySelector('.tayar-v2-shell') && document.querySelectorAll('[data-tayar-canvas-element-id]').length >= 2 && document.documentElement.dir === 'ltr'`);
    await sleep(150);

    const layout = await evaluate(`(() => {
      const box = (selector) => { const node = document.querySelector(selector); if (!node) return null; const r = node.getBoundingClientRect(); return { left:r.left,right:r.right,width:r.width }; };
      return { shell:box('.tayar-v2-shell'), left:box('.tayar-v2-left-sidebar'), canvas:box('.tayar-v2-canvas'), inspector:box('.tayar-v2-inspector') };
    })()`);
    assert(layout.shell?.width >= 1500, 'Desktop viewport did not initialize at desktop width.');
    assert(layout.left?.width > 0 && layout.canvas?.width > 0 && layout.inspector?.width > 0, 'Desktop Builder panels are not all visible.');
    assert(layout.left.right <= layout.canvas.left + 1, 'Left panel overlaps the canvas.');
    assert(layout.canvas.right <= layout.inspector.left + 1, 'Inspector overlaps the canvas.');
    console.log('[browser] PASS desktop panels do not overlap');

    const first = await snapshot(0);
    const second = await snapshot(1);
    assert(first?.id && second?.id, 'Default canvas elements were not rendered.');
    await click('[data-tayar-canvas-element-id]', 0);
    const dragBaseline = await snapshot(0);
    await drag('[data-tayar-canvas-element-id]', 0, 64, 40);
    const dragged = await snapshot(0);
    assert(Math.abs(dragged.x - dragBaseline.x) >= 6 || Math.abs(dragged.y - dragBaseline.y) >= 6, 'Direct pointer drag did not change X/Y.');
    console.log('[browser] PASS direct pointer drag changes X/Y');

    await waitFor('Undo', `!document.querySelector('.tayar-v2-topbar__history button:first-child')?.disabled`);
    await click('.tayar-v2-topbar__history button', 0);
    await waitFor('undo geometry', `(() => { const n=document.querySelectorAll('[data-tayar-canvas-element-id]')[0]; if(!n)return false; const r=n.getBoundingClientRect(); return Math.abs(r.x-${dragBaseline.x})<3 && Math.abs(r.y-${dragBaseline.y})<3; })()`);
    const undone = await snapshot(0);
    assert(near(undone.x, dragBaseline.x) && near(undone.y, dragBaseline.y), 'Undo did not restore drag geometry.');
    await waitFor('Redo', `!document.querySelector('.tayar-v2-topbar__history button:nth-child(2)')?.disabled`);
    await click('.tayar-v2-topbar__history button', 1);
    await waitFor('redo geometry', `(() => { const n=document.querySelectorAll('[data-tayar-canvas-element-id]')[0]; if(!n)return false; const r=n.getBoundingClientRect(); return Math.abs(r.x-${dragged.x})<3 && Math.abs(r.y-${dragged.y})<3; })()`);
    console.log('[browser] PASS undo/redo restores real drag geometry');

    const beforeResize = await snapshot(0);
    const handleCount = await evaluate(`document.querySelectorAll('button[aria-label="Resize element"]').length`);
    assert(handleCount === 2, `Expected two resize handles, found ${handleCount}.`);
    await drag('button[aria-label="Resize element"]', 0, 80, 0, { scroll: false });
    await waitFor('pointer resize width', `(() => { const n=document.querySelectorAll('[data-tayar-canvas-element-id]')[0]; return n && n.getBoundingClientRect().width < ${beforeResize.width - 5}; })()`, 3_000);
    const afterResize = await snapshot(0);
    assert(afterResize.width < beforeResize.width - 5, `Pointer resize did not reduce width: before=${beforeResize.width}, after=${afterResize.width}.`);
    console.log('[browser] PASS pointer resize changes element width');

    const editRect = await rect('[data-tayar-canvas-element-id]', 0);
    assert(editRect, 'Inline-edit target is missing.');
    const editX = editRect.left + editRect.width / 2;
    const editY = editRect.top + editRect.height / 2;
    await clickPoint(editX, editY, 0, 1);
    await clickPoint(editX, editY, 0, 2);
    await waitFor('inline edit mode', `document.querySelectorAll('[data-tayar-canvas-element-id]')[0]?.isContentEditable === true`);
    await ctrlKey('a', 'KeyA', 65);
    await cdp.send('Input.insertText', { text: 'Browser regression edit' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await waitFor('inline edit commit', `document.querySelectorAll('[data-tayar-canvas-element-id]')[0]?.textContent?.trim() === 'Browser regression edit'`);
    console.log('[browser] PASS inline text edit commits through keyboard input');

    await click('[data-panel-id="layers"]');
    await waitFor('Layers panel', `document.querySelector('.tayar-v2-left-sidebar__panel[data-panel="layers"]') && document.querySelectorAll('.tayar-v2-layer-element').length >= 2`);
    await click('.tayar-v2-layer-element', 1);
    const layerSync = await evaluate(`(() => {
      const selected=Array.from(document.querySelectorAll('[data-tayar-canvas-element-id]')).filter((n)=>String(n.className).includes('ring-violet-400/90')).map((n)=>n.dataset.tayarCanvasElementId);
      return { selected, inspector:document.querySelector('.tayar-v2-inspector')?.dataset.target };
    })()`);
    assert(layerSync.selected.length === 1 && layerSync.selected[0] === second.id, 'Layers selection did not synchronize to canvas.');
    assert(layerSync.inspector === 'element', 'Inspector did not synchronize to Layers selection.');
    console.log('[browser] PASS Layers → canvas → inspector synchronization');

    await click('[data-tayar-canvas-element-id]', 0, 2);
    const multi = await evaluate(`(() => ({
      canvas:Array.from(document.querySelectorAll('[data-tayar-canvas-element-id]')).filter((n)=>String(n.className).includes('ring-violet-400/90')).map((n)=>n.dataset.tayarCanvasElementId),
      layers:document.querySelectorAll('.tayar-v2-layer-element-wrap[data-selected="true"] > .tayar-v2-layer-element').length
    }))()`);
    assert(multi.canvas.length === 2 && multi.canvas.includes(first.id) && multi.canvas.includes(second.id), 'Ctrl-click did not create a two-element canvas selection.');
    assert(multi.layers === 2, `Layers did not reflect multi-selection; found ${multi.layers}.`);
    console.log('[browser] PASS multi-select synchronizes with Layers');

    assert(await evaluate(`document.querySelector('.tayar-v2-canvas')?.dataset.zoom === '100'`), 'Initial canvas zoom is not 100%.');
    await click('.tayar-v2-canvas__zoom button', 2);
    await waitFor('125% zoom', `document.querySelector('.tayar-v2-canvas')?.dataset.zoom === '125'`);
    await click('.tayar-v2-canvas__zoom button', 1);
    await waitFor('100% zoom reset', `document.querySelector('.tayar-v2-canvas')?.dataset.zoom === '100'`);
    console.log('[browser] PASS zoom and reset');

    const viewport = await rect('.tayar-v2-canvas__viewport', 0, false);
    assert(viewport, 'Canvas viewport is missing.');
    const panX = viewport.left + viewport.width / 2;
    const panY = viewport.top + Math.min(viewport.height / 2, 260);
    await mouse('mouseMoved', panX, panY);
    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await waitFor('pan-ready state', `document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panReady === 'true'`);
    await mouse('mousePressed', panX, panY, 1, 'left');
    await mouse('mouseMoved', panX - 32, panY - 24, 1, 'none');
    await waitFor('active pan state', `document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panning === 'true'`);
    await mouse('mouseReleased', panX - 32, panY - 24, 0, 'left');
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await waitFor('pan release', `document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panReady === 'false' && document.querySelector('.tayar-v2-canvas__viewport')?.dataset.panning === 'false'`);
    console.log('[browser] PASS Space + pointer pan lifecycle');

    await sleep(100);
    assert(runtimeErrors.length === 0, `Browser runtime exceptions:\n${runtimeErrors.join('\n')}`);
    const relevantConsoleErrors = consoleErrors.filter((message) => message && !message.includes('favicon.ico'));
    assert(relevantConsoleErrors.length === 0, `Browser console errors:\n${relevantConsoleErrors.join('\n')}`);
    console.log('[browser] PASS no runtime or console errors');
    console.log('[website-builder-browser-regression] PASS 9 desktop browser scenarios');
  } catch (error) {
    console.error('[website-builder-browser-regression] FAIL');
    console.error(error instanceof Error ? error.stack : error);
    const viteTail = vite.output.join('').split(/\r?\n/).slice(-20).join('\n');
    const chromeTail = chrome?.output.join('').split(/\r?\n/).slice(-20).join('\n') || '';
    if (viteTail) console.error(`\n--- Vite tail ---\n${viteTail}`);
    if (chromeTail) console.error(`\n--- Chrome tail ---\n${chromeTail}`);
    throw error;
  } finally {
    cdp?.close();
    await stop(chrome?.child);
    await stop(vite.child);
  }
}

await Promise.race([
  regression(),
  sleep(TIMEOUT_MS).then(() => { throw new Error(`Website Builder browser regression exceeded ${TIMEOUT_MS / 1000}s.`); }),
]);
