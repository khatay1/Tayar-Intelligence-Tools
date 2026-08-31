const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,160}$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,500}$/;

function queryValue(url, name) {
  const value = url.searchParams.get(name);
  return value ? value.trim() : '';
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return '';
  }
}

function safeFilePath(value) {
  const file = String(value || 'index.html').replace(/^\/+/, '');
  if (!SAFE_FILE.test(file)) return '';
  const parts = file.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return '';
  return file;
}

function encodeStoragePath(path) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function routeFromPath(pathname) {
  const clean = String(pathname || '').split('?')[0];
  const parts = clean
    .split('/')
    .filter(Boolean)
    .map(safeDecode);

  if (parts[0] === 'site' && parts[1] && parts[2]) {
    return {
      ownerId: parts[1],
      projectId: parts[2],
      previewToken: '',
      file: parts.slice(3).join('/') || 'index.html',
    };
  }

  if (parts[0] === 'preview' && parts[1] && parts[2] && parts[3]) {
    return {
      ownerId: parts[1],
      projectId: parts[2],
      previewToken: parts[3],
      file: parts.slice(4).join('/') || 'index.html',
    };
  }

  return null;
}

function firstHeader(req, name) {
  const raw = req?.headers?.[name];
  if (Array.isArray(raw)) return raw[0] || '';
  return typeof raw === 'string' ? raw : '';
}

function resolveRoute(req, url) {
  const queryRoute = {
    ownerId: queryValue(url, 'ownerId'),
    projectId: queryValue(url, 'projectId'),
    previewToken: queryValue(url, 'previewToken'),
    file: queryValue(url, 'file'),
  };

  const pathCandidates = [
    firstHeader(req, 'x-vercel-original-url'),
    firstHeader(req, 'x-original-url'),
    firstHeader(req, 'x-invoke-path'),
    firstHeader(req, 'x-matched-path'),
    url.pathname,
  ];

  let pathRoute = null;
  for (const candidate of pathCandidates) {
    if (!candidate) continue;
    let pathname = candidate;
    try {
      pathname = new URL(candidate, 'https://tayar.local').pathname;
    } catch {
      pathname = String(candidate).split('?')[0];
    }
    pathRoute = routeFromPath(pathname);
    if (pathRoute) break;
  }

  return {
    ownerId: queryRoute.ownerId || pathRoute?.ownerId || '',
    projectId: queryRoute.projectId || pathRoute?.projectId || '',
    previewToken: queryRoute.previewToken || pathRoute?.previewToken || '',
    file: queryRoute.file || pathRoute?.file || 'index.html',
  };
}

function contentTypeFor(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function setCommonHeaders(res, file, isPreview = false) {
  res.setHeader('Content-Type', contentTypeFor(file));
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Tayar-Published-Site', '1');

  if (isPreview) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  if (/\.html?$/i.test(file)) {
    // Customer HTML is intentionally sandboxed without allow-same-origin so it
    // cannot read Tayar cookies/localStorage even when served from tayar.se.
    res.setHeader(
      'Content-Security-Policy',
      "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation; default-src 'self' https: data: blob:; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action https:;"
    );
  }
}

async function fetchStorageFile(supabaseUrl, storagePath) {
  return fetch(
    `${supabaseUrl}/storage/v1/object/public/published-sites/${encodeStoragePath(storagePath)}`,
    {
      method: 'GET',
      headers: { Accept: '*/*' },
      cache: 'no-store',
    },
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  const supabaseUrl = String(
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).replace(/\/+$/, '');

  if (!supabaseUrl) {
    res.statusCode = 503;
    res.end('Published-site storage is not configured');
    return;
  }

  const url = new URL(req.url || '/', `https://${req.headers.host || 'tayar.local'}`);
  const route = resolveRoute(req, url);
  const ownerId = route.ownerId;
  const projectId = route.projectId;
  const previewToken = route.previewToken;
  const file = safeFilePath(route.file || 'index.html');

  if (
    !SAFE_SEGMENT.test(ownerId) ||
    !SAFE_SEGMENT.test(projectId) ||
    (previewToken && !SAFE_SEGMENT.test(previewToken)) ||
    !file
  ) {
    res.statusCode = 400;
    res.end('Invalid published-site path');
    return;
  }

  if (!previewToken && /^(?:versions|previews)(?:\/|$)/i.test(file)) {
    res.statusCode = 404;
    res.end('Published page not found');
    return;
  }

  const root = previewToken
    ? `${ownerId}/${projectId}/previews/${previewToken}`
    : `${ownerId}/${projectId}`;

  let upstream;
  try {
    upstream = await fetchStorageFile(supabaseUrl, `${root}/${file}`);
  } catch {
    res.statusCode = 502;
    res.end('Published-site storage is temporarily unavailable');
    return;
  }

  let responseFile = file;
  let status = upstream.status;

  if (!upstream.ok && /\.html?$/i.test(file) && file !== '404.html') {
    try {
      const fallback = await fetchStorageFile(supabaseUrl, `${root}/404.html`);
      if (fallback.ok) {
        upstream = fallback;
        responseFile = '404.html';
        status = 404;
      }
    } catch {
      // Keep the original upstream response below.
    }
  }

  if (!upstream.ok) {
    res.statusCode = upstream.status === 404 ? 404 : 502;
    res.end(upstream.status === 404 ? 'Published page not found' : 'Could not load published page');
    return;
  }

  setCommonHeaders(res, responseFile, Boolean(previewToken));
  res.statusCode = status === 404 ? 404 : 200;

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const body = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Length', String(body.byteLength));
  res.end(body);
}
