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
  if (req.body && typeof req.body === 'object') return req.body;
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

async function supabaseRequest(path, options = {}) {
  const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
  if (!base || !serviceKey) throw new Error('Supabase server configuration is missing.');
  return fetch(`${base}${path}`, {
    ...options,
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(options.headers || {}) },
  });
}

async function authenticatedUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const publicKey = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '');
  if (!base || !publicKey) throw new Error('Supabase authentication configuration is missing.');
  const response = await fetch(`${base}/auth/v1/user`, { headers: { apikey: publicKey, Authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

async function ownedProject(projectId, userId) {
  const query = new URLSearchParams({ id: `eq.${projectId}`, user_id: `eq.${userId}`, select: 'id,user_id', limit: '1' });
  const response = await supabaseRequest(`/rest/v1/projects?${query}`);
  if (!response.ok) throw new Error('Could not verify project ownership.');
  return (await response.json())[0] || null;
}

function vercelUrl(path) {
  const teamId = String(process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID || '').trim();
  return `https://api.vercel.com${path}${teamId ? `${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(teamId)}` : ''}`;
}

async function vercelRequest(path, options = {}) {
  const token = String(process.env.VERCEL_TOKEN || '').trim();
  if (!token) throw new Error('Vercel domain management is not configured.');
  const response = await fetch(vercelUrl(path), {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 404 && response.status !== 409) throw new Error(payload?.error?.message || payload?.message || 'Vercel domain request failed.');
  return { response, payload };
}

function domainState(hostname, payload) {
  const verified = payload?.verified === true && payload?.misconfigured !== true;
  return {
    hostname,
    status: verified ? 'verified' : payload?.misconfigured ? 'misconfigured' : 'pending',
    verification: Array.isArray(payload?.verification) ? payload.verification.slice(0, 10) : [],
  };
}

async function saveDomain(projectId, userId, state) {
  const response = await supabaseRequest('/rest/v1/website_custom_domains?on_conflict=project_id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ project_id: projectId, user_id: userId, ...state, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error('Could not save the custom domain. Apply the website_custom_domains database migration first.');
  return (await response.json())[0];
}

async function currentDomain(projectId, userId) {
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, user_id: `eq.${userId}`, select: '*', limit: '1' });
  const response = await supabaseRequest(`/rest/v1/website_custom_domains?${query}`);
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
    const action = String(body.action || 'get');
    const projectId = String(body.projectId || '');
    if (!PROJECT_ID.test(projectId) || !(await ownedProject(projectId, user.id))) return json(res, 403, { error: 'Project owner access required.' });
    const vercelProject = encodeURIComponent(String(process.env.VERCEL_PROJECT_ID || '').trim());
    if (!vercelProject && action !== 'get') throw new Error('VERCEL_PROJECT_ID is not configured.');

    const existing = await currentDomain(projectId, user.id);
    if (action === 'get') return json(res, 200, { domain: existing });

    if (action === 'remove') {
      if (existing?.hostname) await vercelRequest(`/v9/projects/${vercelProject}/domains/${encodeURIComponent(existing.hostname)}`, { method: 'DELETE' });
      const query = new URLSearchParams({ project_id: `eq.${projectId}`, user_id: `eq.${user.id}` });
      const deleted = await supabaseRequest(`/rest/v1/website_custom_domains?${query}`, { method: 'DELETE' });
      if (!deleted.ok) throw new Error('Could not remove the domain mapping.');
      return json(res, 200, { domain: null });
    }

    const hostname = normalizeHostname(body.hostname || existing?.hostname);
    if (!hostname) return json(res, 400, { error: 'Enter a valid custom hostname outside tayar.se and vercel.app.' });
    let result = action === 'connect' && existing?.hostname !== hostname
      ? await vercelRequest(`/v10/projects/${vercelProject}/domains`, { method: 'POST', body: JSON.stringify({ name: hostname }) })
      : await vercelRequest(`/v9/projects/${vercelProject}/domains/${encodeURIComponent(hostname)}`);
    if (result.response.status === 409) result = await vercelRequest(`/v9/projects/${vercelProject}/domains/${encodeURIComponent(hostname)}`);
    const saved = await saveDomain(projectId, user.id, domainState(hostname, result.payload));
    if (existing?.hostname && existing.hostname !== hostname) {
      await vercelRequest(`/v9/projects/${vercelProject}/domains/${encodeURIComponent(existing.hostname)}`, { method: 'DELETE' });
    }
    return json(res, 200, { domain: saved });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Custom domain request failed.' });
  }
}
