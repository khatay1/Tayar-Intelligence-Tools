const PLATFORM_HOSTS = new Set(['tayar.se', 'www.tayar.se', 'localhost', '127.0.0.1']);

function hostnameOf(request) {
  let urlHostname = '';
  try { urlHostname = new URL(request.url).hostname; } catch { /* invalid requests are ignored below */ }
  return String(request.headers.get('x-forwarded-host') || request.headers.get('host') || urlHostname)
    .split(',')[0].trim().split(':')[0].toLowerCase().replace(/\.$/, '');
}

export default async function middleware(request) {
  const hostname = hostnameOf(request);
  if (!hostname || PLATFORM_HOSTS.has(hostname) || hostname.endsWith('.vercel.app') || hostname.endsWith('.tayar.se')) return;
  const source = new URL(request.url);
  if (source.pathname.startsWith('/api/')) return;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const canonical = String(process.env.TAYAR_CANONICAL_ORIGIN || 'https://tayar.se').replace(/\/+$/, '');
  const target = new URL('/api/published-site', canonical);
  target.searchParams.set('hostname', hostname);
  let file = 'index.html';
  try { file = decodeURIComponent(source.pathname).replace(/^\/+/, '') || 'index.html'; } catch { return new Response('Invalid path', { status: 400 }); }
  target.searchParams.set('file', file);
  return fetch(target, { method: request.method, headers: { Accept: request.headers.get('accept') || '*/*' }, redirect: 'manual' });
}

export const config = { matcher: '/(.*)' };
