import { Readable } from 'node:stream';

/** Node transport preserves raw bytes and trusts only the configured application origin. */
export function createSocialHubNodeHandler({ kind, origin, deployment }) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const configured = new URL(origin);
      if (configured.protocol !== 'https:' || configured.origin !== origin || configured.username || configured.password) throw Error();
      const url = new URL(req.url || '/', origin);
      if (url.origin !== origin || String(req.headers.host || '').toLowerCase() !== configured.host) throw Error();
      const paths = kind === 'connect' ? ['/api/social-connect', '/api/social-connect-callback'] : ['/api/social-webhook'];
      if (!paths.includes(url.pathname)) { res.statusCode = 404; res.end(); return; }
      if (!['GET', 'POST'].includes(req.method)) { res.statusCode = 405; res.end(); return; }
      if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') { res.statusCode = 415; res.end(); return; }
      const headers = new Headers();
      for (const name of ['authorization','origin','sec-fetch-site','content-type','content-length','x-hub-signature-256','x-telegram-bot-api-secret-token']) {
        if (typeof req.headers[name] === 'string') headers.set(name, req.headers[name]);
      }
      const limit = kind === 'connect' ? 16384 : 262144;
      if (Number(headers.get('content-length') || 0) > limit) { res.statusCode = 413; res.end(); return; }
      const request = new Request(url, { method: req.method, headers,
        ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      let result;
      if (kind === 'connect') result = await deployment.connect(request);
      else {
        const ids = url.searchParams.getAll('id');
        if (ids.length !== 1 || !/^[A-Za-z0-9_-]{32,128}$/.test(ids[0])
          || [...url.searchParams.keys()].some(key => !['id','hub.mode','hub.verify_token','hub.challenge'].includes(key))) {
          res.statusCode = 400; res.end(); return;
        }
        result = await deployment.webhook(request, ids[0]);
      }
      result.headers.forEach((value, name) => res.setHeader(name, value));
      res.statusCode = result.status;
      res.end(Buffer.from(await result.arrayBuffer()));
    } catch { res.statusCode = 503; res.end(); }
  };
}
