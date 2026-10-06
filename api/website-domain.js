const HOSTNAME = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function bearer(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function normalizeHostname(value) {
  const hostname = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME.test(hostname)) return '';
  if (hostname === 'tayar.se' || hostname.endsWith('.tayar.se') || hostname.endsWith('.vercel.app')) return '';
  return hostname;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    const raw = String(req.body);
    if (raw.length > 16_384) throw new Error('Request body is too large.');
    return JSON.parse(raw || '{}');
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 16_384) throw new Error('Request body is too large.');
  }
  return JSON.parse(body || '{}');
}

function supabaseConfig() {
  const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const publicKey = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
  if (!base || !publicKey) throw new Error('Supabase server configuration is missing.');
  return { base, publicKey };
}

async function authenticatedUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const { base, publicKey } = supabaseConfig();
  const response = await fetch(`${base}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

async function userSupabaseRequest(req, path, options = {}) {
  const token = bearer(req);
  const { base, publicKey } = supabaseConfig();
  return fetch(`${base}${path}`, {
    ...options,
    headers: { apikey: publicKey, Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    redirect: 'error',
    cache: 'no-store',
  });
}

async function ownedProject(req, projectId, userId) {
  const query = new URLSearchParams({ id: `eq.${projectId}`, user_id: `eq.${userId}`, type: 'eq.website-builder', deleted_at: 'is.null', select: 'id,user_id', limit: '1' });
  const response = await userSupabaseRequest(req, `/rest/v1/projects?${query}`);
  if (!response.ok) throw new Error('Could not verify project ownership.');
  return (await response.json())[0] || null;
}

function vercelUrl(path) {
  const teamId = String(process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '').trim();
  return `https://api.vercel.com${path}${teamId ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}` : ''}`;
}

async function vercelRequest(path, options = {}, allowedStatuses = []) {
  const token = String(process.env.VERCEL_TOKEN || '').trim();
  if (!token) throw new Error('Vercel domain management is not configured.');
  const response = await fetch(vercelUrl(path), {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    const error = new Error(payload?.error?.message || payload?.message || 'Vercel domain request failed.');
    error.statusCode = response.status === 409 ? 409 : 502;
    throw error;
  }
  return { response, payload };
}

function domainState(hostname, payload, config) {
  const verified = payload?.verified === true && config?.misconfigured === false;
  return {
    hostname,
    status: verified ? 'verified' : config?.misconfigured === true ? 'misconfigured' : 'pending',
    verification: Array.isArray(payload?.verification) ? payload.verification.slice(0, 10) : [],
  };
}

async function rpc(req, name, body) {
  const controlSecret = String(process.env.TAYAR_DOMAIN_CONTROL_SECRET || '');
  if (!controlSecret) throw new Error('Domain control is not configured.');
  const response = await userSupabaseRequest(req, `/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, p_control_secret: controlSecret }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const error = new Error(String(failure?.message || 'Custom domain state changed.'));
    error.statusCode = response.status === 409 ? 409 : 500;
    throw error;
  }
  return response.json();
}

async function saveDomain(req, projectId, state, existing) {
  return rpc(req, 'website_custom_domain_server_save', {
    p_project_id: projectId,
    p_hostname: state.hostname,
    p_status: state.status,
    p_verification: state.verification,
    p_expected_hostname: existing?.hostname ?? null,
    p_expected_updated_at: existing?.updated_at ?? null,
  });
}

async function currentDomain(req, projectId, userId) {
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, user_id: `eq.${userId}`, select: '*', limit: '1' });
  const response = await userSupabaseRequest(req, `/rest/v1/website_custom_domains?${query}`);
  if (!response.ok) throw new Error('Could not load the custom domain.');
  return (await response.json())[0] || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  try {
    const user = await authenticatedUser(req);
    if (!user?.id) return json(res, 401, { error: 'Authentication required.' });
    const body = await readBody(req);
    if (!body || Array.isArray(body) || typeof body !== 'object') return json(res, 400, { error: 'A JSON object is required.' });
    const action = String(body.action || 'get');
    if (!['get', 'connect', 'check', 'remove'].includes(action)) return json(res, 400, { error: 'Unknown domain action.' });
    const projectId = String(body.projectId || '');
    if (!PROJECT_ID.test(projectId) || !(await ownedProject(req, projectId, user.id))) return json(res, 403, { error: 'Project owner access required.' });
    const vercelProject = encodeURIComponent(String(process.env.VERCEL_PROJECT_ID || '').trim());
    if (!vercelProject && action !== 'get') throw new Error('VERCEL_PROJECT_ID is not configured.');

    const existing = await currentDomain(req, projectId, user.id);
    if (action === 'get') return json(res, 200, { domain: existing });

    if (action === 'remove') {
      if (existing?.hostname) await vercelRequest(`/v9/projects/${vercelProject}/domains/${encodeURIComponent(existing.hostname)}`, { method: 'DELETE' }, [404]);
      if (existing) {
        await rpc(req, 'website_custom_domain_server_delete', {
          p_project_id: projectId,
          p_expected_hostname: existing.hostname,
          p_expected_updated_at: existing.updated_at,
        });
      }
      return json(res, 200, { domain: null });
    }

    const hostname = normalizeHostname(body.hostname || existing?.hostname);
    if (!hostname) return json(res, 400, { error: 'Enter a valid custom hostname outside tayar.se and vercel.app.' });
    if (action === 'check' && (!existing || existing.hostname !== hostname)) return json(res, 400, { error: 'Check the domain already connected to this project.' });
    const creating = action === 'connect' && existing?.hostname !== hostname;
    const domainPath = `/v9/projects/${vercelProject}/domains/${encodeURIComponent(hostname)}`;
    let result = creating
      ? await vercelRequest(`/v10/projects/${vercelProject}/domains`, { method: 'POST', body: JSON.stringify({ name: hostname }) })
      : await vercelRequest(domainPath);
    // A conflict is never permission to adopt an unrelated Vercel alias.
    let saved;
    try {
      if (action === 'check' && result.payload.verified === false) {
        const verification = await vercelRequest(`${domainPath}/verify`, { method: 'POST' }, [400]);
        if (verification.response.ok) result = verification;
      }
      const config = await vercelRequest(`/v6/domains/${encodeURIComponent(hostname)}/config?projectIdOrName=${vercelProject}`);
      saved = await saveDomain(req, projectId, domainState(hostname, result.payload, config.payload), existing);
    } catch (error) {
      if (creating) {
        try { await vercelRequest(domainPath, { method: 'DELETE' }, [404]); }
        catch { throw new Error(`${error.message} The new domain registration could not be cleaned up; contact support before retrying.`); }
      }
      throw error;
    }
    if (existing?.hostname && existing.hostname !== hostname) {
      try {
        await vercelRequest(`/v9/projects/${vercelProject}/domains/${encodeURIComponent(existing.hostname)}`, { method: 'DELETE' }, [404]);
      } catch {
        return json(res, 200, { domain: saved, warning: 'The new domain is connected, but the old registration needs support cleanup.' });
      }
    }
    return json(res, 200, { domain: saved });
  } catch (error) {
    return json(res, error instanceof SyntaxError ? 400 : error.statusCode || 500, { error: error instanceof Error ? error.message : 'Custom domain request failed.' });
  }
}
