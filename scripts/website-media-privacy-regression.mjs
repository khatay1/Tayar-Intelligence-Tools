import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import handler from '../api/website-media.js';

const dir = await mkdtemp(join(tmpdir(), 'tayar-private-media-'));
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const path = `${owner}/image.png`, token = 'header.payload.signature';
const originalFetch = globalThis.fetch;
const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
try {
  const outfile = join(dir, 'subject.mjs');
  await build({ stdin: { contents: "export * from './src/lib/website-media-reference'; export * from './src/lib/website-media-session'; export * from './src/modules/website-builder/services/websiteMediaPublication';", resolveDir: process.cwd() }, outfile, platform: 'node', format: 'esm', bundle: true, tsconfig: 'tsconfig.app.json' });
  const subject = await import(pathToFileURL(outfile));
  const canonical = subject.websiteMediaUrl(path);
  const old = `https://pnbllxdlskljcakyaylt.supabase.co/storage/v1/object/public/website-media/${path}`;
  assert.equal(subject.websiteMediaPath(canonical), path);
  assert.equal(subject.websiteMediaPath(old), path);
  for (const url of [`${canonical}&token=secret`, old + '?token=secret', old.replace('pnbllxdlskljcakyaylt', 'other'), old.replace('/image.png', '/../private.png'), 'https://evil.test/image.png']) assert.equal(subject.websiteMediaPath(url), null);
  assert.equal(subject.normalizeWebsiteMediaReferences({ html: `<img src="${old}">` }).html, `<img src="${canonical}">`);
  let downloads = 0, writes = 0;
  const storage = { from(bucket) { return {
    async download(p) { assert.equal(bucket, 'website-media'); assert.equal(p, path); downloads++; return { data: new Blob(['private-image'], { type: 'image/png' }), error: null }; },
    async upload(p, body) { assert.equal(bucket, 'website-published-media'); assert.match(p, new RegExp(`^${owner}/[a-f0-9]{64}\\.png$`)); assert.equal(await body.text(), 'private-image'); writes++; return { error: null }; },
    getPublicUrl(p) { return { data: { publicUrl: `https://cdn.test/${p}` } }; },
  }; } };
  const input = [{ content: `<img src="${old}"><img src="${canonical}"><img src="https://external.test/a.png">` }];
  const published = await subject.materializeWebsiteMedia(input, storage, 'publish');
  assert.equal(downloads, 1); assert.equal(writes, 1);
  assert.ok(!published[0].content.includes('/api/website-media') && !published[0].content.includes('/public/website-media/'));
  assert.ok(published[0].content.includes('https://external.test/a.png'));
  const inline = await subject.materializeWebsiteMedia(input, storage, 'inline');
  assert.ok(inline[0].content.includes('data:image/png;base64,')); assert.equal(writes, 1, 'Preview/ZIP must not publish drafts');
  assert.ok(input[0].content.includes(canonical), 'Snapshots stay unchanged');
  await assert.rejects(subject.materializeWebsiteMedia(input, { from: () => ({ download: async () => ({ data: null, error: Error('denied') }) }) }, 'publish'), /private website media/);

  process.env.SUPABASE_URL = 'https://storage.test'; process.env.SUPABASE_ANON_KEY = 'public-key';
  let network = [], invalidUser = false, suspended = false, teamAllowed = false;
  globalThis.fetch = async (url, options) => {
    network.push(String(url));
    assert.equal(options.headers.Authorization, `Bearer ${token}`); assert.equal(options.headers.apikey, 'public-key');
    if (String(url).endsWith('/user')) return invalidUser ? new Response(null, { status: 401 }) : Response.json({ id: owner });
    if (String(url).includes('/profiles?')) return Response.json([{ suspended }]);
    if (String(url).includes('/rpc/can_read_website_media')) return Response.json(teamAllowed);
    assert.ok(String(url).includes('/object/authenticated/website-media/'));
    return new Response('private-image', { headers: { 'Content-Type': 'image/png' } });
  };
  async function request(method, headers = {}, p = path) {
    const response = { headers: {}, statusCode: null, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(body) { this.body = body; } };
    await handler({ method, url: `/api/website-media?path=${encodeURIComponent(p)}`, headers: { host: 'www.tayar.se', ...headers } }, response);
    return response;
  }
  assert.equal((await request('GET')).statusCode, 401);
  const login = await request('POST', { origin: 'https://www.tayar.se', authorization: `Bearer ${token}` });
  assert.equal(login.statusCode, 204); assert.match(login.headers['set-cookie'], /HttpOnly; Secure; SameSite=Strict$/);
  assert.ok(!login.headers['set-cookie'].includes('Max-Age='), 'Media cookie is never remembered independently');
  assert.equal((await request('POST', { origin: 'https://evil.test', authorization: `Bearer ${token}` })).statusCode, 403);
  const cookie = login.headers['set-cookie'].split(';')[0];
  const own = await request('GET', { cookie });
  assert.equal(own.statusCode, 200); assert.equal(own.headers['cache-control'], 'private, no-store');
  const before = network.length;
  assert.equal((await request('GET', { cookie }, `${other}/image.png`)).statusCode, 404);
  assert.equal(network.length - before, 3, 'Foreign media never reaches storage');
  teamAllowed = true;
  assert.equal((await request('GET', { cookie }, `${other}/image.png`)).statusCode, 200, 'Authorized team media still reaches caller RLS');
  teamAllowed = false;
  assert.equal((await request('GET', { cookie: `${cookie}; ${cookie}` })).statusCode, 401);
  suspended = true; assert.equal((await request('GET', { cookie })).statusCode, 403); suspended = false;
  invalidUser = true; assert.equal((await request('GET', { cookie })).statusCode, 401); invalidUser = false;
  const logout = await request('DELETE', { origin: 'https://www.tayar.se' });
  assert.equal(logout.statusCode, 204); assert.match(logout.headers['set-cookie'], /Max-Age=0/);
  assert.equal((await request('DELETE', { origin: 'https://evil.test' })).statusCode, 403);

  let resolvePost;
  const events = [];
  const bridge = subject.createWebsiteMediaSession(async (_url, options) => {
    if (options.method === 'POST') { events.push('post-start'); await new Promise(resolve => { resolvePost = resolve; }); events.push('post-end'); }
    else events.push('delete');
    return new Response(null, { status: 204 });
  });
  const signIn = bridge.sync(token); await new Promise(resolve => setTimeout(resolve, 0));
  const signOut = bridge.sync(null); resolvePost(); await Promise.all([signIn, signOut]);
  assert.deepEqual(events, ['post-start', 'post-end', 'delete'], 'Logout follows uncertain/slow login cookie writes');
  console.log('PASS private media: owner/team fresh Auth/RLS, no cache, CSRF/cookie/logout guards, immutable publish copies, portable private exports and unchanged snapshots');
} finally {
  globalThis.fetch = originalFetch;
  if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
  if (previous.key === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.key;
  await rm(dir, { recursive: true, force: true });
}
