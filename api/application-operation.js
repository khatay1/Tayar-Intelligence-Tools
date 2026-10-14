import { Readable } from 'node:stream';
import { serveApplicationCustomOperation } from '../server/generated/website-application-runtime.js';

export const config = { api: { bodyParser: false } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same-origin custom operation endpoint. Request identity comes from the
 * application URL and is revalidated against its active immutable release.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin, Authorization, Cookie');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST'); res.statusCode = 405; res.end(); return;
    }
    const host = String(req.headers.host || '');
    if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error();
    const url = new URL(req.url || '/', `https://${host}`);
    if (url.origin !== `https://${host.toLowerCase()}` || url.pathname !== '/api/application-operation') throw new Error();
    const owners = url.searchParams.getAll('ownerId');
    const projects = url.searchParams.getAll('projectId');
    if (owners.length !== 1 || projects.length !== 1 || [...url.searchParams.keys()].some(key => !['ownerId', 'projectId'].includes(key))
      || !uuid.test(owners[0]) || !uuid.test(projects[0])) {
      res.statusCode = 400; res.end(JSON.stringify({ error: 'invalid_request' })); return;
    }
    const headers = new Headers();
    for (const name of ['authorization', 'origin', 'sec-fetch-site', 'content-type', 'content-length', 'content-encoding']) {
      const value = req.headers[name];
      if (typeof value === 'string') headers.set(name, value);
    }
    const request = new Request(new URL('/api/application-operation', url.origin), {
      method: 'POST', headers, body: Readable.toWeb(req), duplex: 'half',
    });
    const result = await serveApplicationCustomOperation({
      request,
      ownerId: owners[0],
      projectId: projects[0],
      platformUrl: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
    });
    result.headers.forEach((value, name) => res.setHeader(name, value));
    res.statusCode = result.status;
    res.end(await result.text());
  } catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'unavailable' })); }
}
