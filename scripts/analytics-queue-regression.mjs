import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/analytics.ts', import.meta.url), 'utf8').replace("import { supabase } from './supabase';", '');
function setup({ insert = async () => ({ error: null }), session = async () => ({ data: { session: null }, error: null }), blockedSession = false } = {}) {
  const storage = new Map([['tayar-cookie-consent', '{"analytics":true}']]);
  const calls = [];
  const context = { exports: {}, Date, Math, setInterval, clearInterval, localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) }, sessionStorage: { getItem: () => { if (blockedSession) throw Error('blocked'); return null; }, setItem: () => {} }, supabase: { auth: { getSession: session }, from: () => ({ insert: rows => { calls.push(rows); return insert(rows); } }) } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { api: context.exports, storage, calls, seed: n => storage.set('tayar-analytics-queue', JSON.stringify(Array.from({ length: n }, (_, i) => ({ event: `event-${i}`, category: 'user_action' })))), queue: () => JSON.parse(storage.get('tayar-analytics-queue') || '[]') };
}
const a = setup(); a.seed(25);
await a.api.flush(); assert.equal(a.calls[0].length, 10); assert.equal(a.queue().length, 15);
await a.api.flush(); await a.api.flush(); assert.equal(a.queue().length, 0); assert.equal(a.calls.flat().length, 25);
const b = setup({ insert: async () => ({ error: new Error('server failure') }) }); b.seed(15); await b.api.flush(); assert.equal(b.queue().length, 15);
let finish;
const c = setup({ insert: () => new Promise(resolve => { finish = resolve; }) }); c.seed(15);
const pending = c.api.flush(); await Promise.resolve(); await c.api.flush(); c.api.track('new'); assert.equal(c.calls.length, 1);
finish({ error: new Error('offline') }); await pending; assert.equal(c.queue().length, 16); assert.equal(c.queue().at(-1).event, 'new');
let finishSession;
const d = setup({ session: () => new Promise(resolve => { finishSession = resolve; }) }); d.seed(10);
const waiting = d.api.flush(); d.storage.set('tayar-cookie-consent', '{"analytics":false}'); finishSession({ data: { session: null }, error: null }); await waiting; assert.equal(d.calls.length, 0); assert.equal(d.queue().length, 0);
const e = setup({ blockedSession: true }); e.seed(1); await e.api.flush(); assert.equal(e.calls.length, 1);
for (const raw of ['null', '{}', '[null,4,{}]', 'bad json']) { const f = setup(); f.storage.set('tayar-analytics-queue', raw); f.api.track('valid'); assert.equal(f.queue().length, 1); }
const g = setup({ insert: async () => { throw Error('network'); } }); g.seed(12); await g.api.flush(); assert.equal(g.queue().length, 12);
console.log('Analytics queue regressions passed: batching, server/network failures, concurrency, consent, blocked storage, malformed queues.');
