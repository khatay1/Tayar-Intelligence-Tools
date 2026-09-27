import { serveApplicationBrowserSession } from '../server/generated/website-application-runtime.js';

/** No body or credentials are forwarded except the explicit bearer/cookie headers. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin, Authorization, Cookie');
  try {
    if (!['POST', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'POST, DELETE'); res.statusCode = 405; res.end('Method not allowed.'); return;
    }
    const host = String(req.headers.host || '');
    if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error();
    const url = new URL(req.url || '/', `https://${host}`);
    if (url.origin !== `https://${host.toLowerCase()}`) throw new Error();
    const ownerId = url.searchParams.get('ownerId') ?? '';
    const projectId = url.searchParams.get('projectId') ?? '';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(ownerId) || !uuid.test(projectId)) { res.statusCode = 400; res.end('Invalid application identity.'); return; }
    const headers = new Headers();
    for (const name of ['authorization', 'cookie', 'origin', 'sec-fetch-site']) {
      const value = req.headers[name];
      if (typeof value === 'string') headers.set(name, value);
    }
    const result = await serveApplicationBrowserSession({ request: new Request(url.href, { method: req.method, headers }), ownerId, projectId,
      platformUrl: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
    });
    result.headers.forEach((value, name) => res.setHeader(name, value));
    res.statusCode = result.status;
    res.end(await result.text());
  } catch { res.statusCode = 503; res.end('Application session is unavailable.'); }
}
