const COOKIE = '__Secure-tayar-media';
const COOKIE_PATH = '/api/website-media';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;

function bearer(req) {
  const value = req.headers.authorization;
  if (typeof value === 'string' && value.startsWith('Bearer ')) return value.slice(7);
  const cookies = String(req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  return cookies.length === 1 ? cookies[0].slice(COOKIE.length + 1) : '';
}
function clearCookie(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`); }
function trustedOrigin(req) {
  const host = String(req.headers.host || '').toLowerCase();
  return /^[a-z0-9.-]+$/.test(host) && req.headers.origin === `https://${host}` && req.headers['sec-fetch-site'] !== 'cross-site';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  const fail = (status, message) => { res.statusCode = status; res.end(message); };
  if (!['GET', 'HEAD', 'POST', 'DELETE'].includes(req.method)) return fail(405, 'Method not allowed');
  if (['POST', 'DELETE'].includes(req.method) && !trustedOrigin(req)) return fail(403, 'Forbidden');
  if (req.method === 'DELETE') { clearCookie(res); res.statusCode = 204; res.end(); return; }
  try {
    // Cookies never carry a refresh token and never receive a persistent lifetime.
    const token = bearer(req);
    if (token.length > 16000 || !tokenPattern.test(token)) return fail(401, 'Sign in to view media');
    const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    const key = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
    if (!base || !key) return fail(503, 'Media is unavailable');
    const headers = { apikey: key, Authorization: `Bearer ${token}` };
    const options = { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) };
    const auth = await fetch(`${base}/auth/v1/user`, options);
    if (!auth.ok) return fail(401, 'Sign in to view media');
    const user = await auth.json();
    if (!UUID.test(user.id || '')) return fail(401, 'Sign in to view media');
    const profile = await fetch(`${base}/rest/v1/profiles?id=eq.${user.id}&select=suspended&limit=1`, options);
    if (!profile.ok) return fail(503, 'Media is unavailable');
    const rows = await profile.json();
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].suspended === true) return fail(403, 'Media access denied');
    if (req.method === 'POST') {
      // POST must prove the browser session with an explicit bearer header.
      if (!String(req.headers.authorization || '').startsWith('Bearer ')) return fail(401, 'Sign in to view media');
      res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=${COOKIE_PATH}; HttpOnly; Secure; SameSite=Strict`);
      res.statusCode = 204; res.end(); return;
    }
    const url = new URL(req.url, 'https://media.local');
    const path = url.searchParams.get('path') || '';
    const parts = path.split('/');
    if (url.searchParams.getAll('path').length !== 1 || path.length > 1024 || !UUID.test(parts[0])
      || parts.length < 2 || parts.some(part => !part || part === '.' || part === '..' || !/^[a-zA-Z0-9._-]+$/.test(part))) return fail(404, 'Media not found');
    if (parts[0] !== user.id) {
      const access = await fetch(`${base}/rest/v1/rpc/can_read_website_media`, {
        ...options, method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_path: path }),
      });
      if (!access.ok || await access.json() !== true) return fail(404, 'Media not found');
    }
    // Download with the caller's JWT: storage RLS is enforced independently.
    const object = await fetch(`${base}/storage/v1/object/authenticated/website-media/${parts.map(encodeURIComponent).join('/')}`, options);
    if (!object.ok) return fail(object.status === 404 || object.status === 403 ? 404 : 502, 'Media not found');
    if (Number(object.headers.get('content-length') || 0) > 5 * 1024 * 1024) return fail(413, 'Media is too large');
    const bytes = await object.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024) return fail(413, 'Media is too large');
    const type = object.headers.get('content-type') || 'application/octet-stream';
    if (!/^image\/(?:png|jpeg|webp|gif|avif|svg\+xml)(?:;|$)/i.test(type)) return fail(415, 'Unsupported media');
    res.setHeader('Content-Type', type);
    res.statusCode = 200; res.end(req.method === 'HEAD' ? undefined : Buffer.from(bytes));
  } catch { return fail(503, 'Media is unavailable'); }
}
