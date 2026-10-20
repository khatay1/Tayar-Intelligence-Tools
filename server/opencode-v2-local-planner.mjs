/**
 * Source-only OpenCode V2 read-only pilot, pinned to inspected upstream v1.19.3.
 * NOT an execution sandbox or a public route. A trusted caller MUST furnish
 * a disposable, externally isolated no-egress workspace with a read-only worktree.
 */
const SESSION = /^ses_[A-Za-z0-9_-]{1,128}$/;
const MODEL = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const MAX_RESPONSE = 192 * 1024;
const MAX_PROMPT = 10 * 1024;
const MAX_PLAN = 16 * 1024;
const AGENT = 'tayar-readonly';
const ALLOWED_TOOLS = new Set(['read', 'glob', 'grep']);

export class OpenCodeV2Error extends Error {
  constructor(code) { super(code); this.code = code; this.name = 'OpenCodeV2Error'; }
}

export function checkV2Config(config) {
  if (config?.enabled !== true) throw new OpenCodeV2Error('disabled');
  if (config.isolated !== true || config.offline !== true || config.readonlyWorktree !== true) {
    throw new OpenCodeV2Error('external-isolation-required');
  }
  if (config.runtimeVersion !== 'v1.19.3' || config.providerID !== 'ollama') {
    throw new OpenCodeV2Error('unsupported-runtime');
  }
  if (typeof config.modelID !== 'string' || !MODEL.test(config.modelID) ||
      /cloud|online|remote/i.test(config.modelID)) throw new OpenCodeV2Error('invalid-local-model');
  if (typeof config.baseUrl !== 'string' ||
      !/^http:\/\/127\.0\.0\.1:[0-9]{2,5}\/?$/.test(config.baseUrl)) {
    throw new OpenCodeV2Error('invalid-endpoint');
  }
  let url;
  try { url = new URL(config.baseUrl); } catch { throw new OpenCodeV2Error('invalid-endpoint'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.pathname !== '/' || url.search || url.hash || url.username || url.password ||
      Number(url.port) < 1 || Number(url.port) > 65535) {
    throw new OpenCodeV2Error('invalid-endpoint');
  }
  if (typeof config.workspaceDirectory !== 'string' ||
      !/^\/workspace\/[A-Za-z0-9_-]{3,60}$/.test(config.workspaceDirectory)) {
    throw new OpenCodeV2Error('invalid-workspace');
  }
  // v1.19.3 `serve` obtains a private daemon password even on loopback.
  // The supervisor supplies it from the disposable worker's private state;
  // never use a browser field, URL, prompt, or platform/provider credential.
  if (typeof config.serverPassword !== 'string' ||
      !/^[\x21-\x7e]{16,256}$/.test(config.serverPassword)) {
    throw new OpenCodeV2Error('invalid-server-credential');
  }
  return { origin: url.origin, modelID: config.modelID,
    workspaceDirectory: config.workspaceDirectory };
}

/**
 * OpenCode V2 uses ordered permissions. This exact ruleset denies EVERYTHING,
 * then allows only read/glob/grep; it specifically also denies shell,
 * subagents, edits, web, skills, and external_directory.
 * Reject any extra rule because later rules can override deny-all.
 */
export function checkReadOnlyAgent(agent) {
  const rules = agent?.permissions;
  if (agent?.id !== AGENT || !Array.isArray(rules) || rules.length !== 4) {
    throw new OpenCodeV2Error('unsafe-agent-policy');
  }
  const head = rules[0];
  if (!head || head.action !== '*' || head.resource !== '*' || head.effect !== 'deny') {
    throw new OpenCodeV2Error('unsafe-agent-policy');
  }
  const granted = new Set();
  for (const rule of rules.slice(1)) {
    if (!rule || !ALLOWED_TOOLS.has(rule.action) || rule.resource !== '*' ||
        rule.effect !== 'allow' || granted.has(rule.action)) {
      throw new OpenCodeV2Error('unsafe-agent-policy');
    }
    granted.add(rule.action);
  }
  if (granted.size !== ALLOWED_TOOLS.size) throw new OpenCodeV2Error('unsafe-agent-policy');
  return true;
}

async function boundedJson(response) {
  if (!response?.ok) {
    await response?.body?.cancel?.().catch(() => {});
    throw new OpenCodeV2Error('unavailable');
  }
  const advertised = Number(response.headers.get('content-length'));
  if (Number.isFinite(advertised) && advertised > MAX_RESPONSE) {
    await response.body?.cancel().catch(() => {});
    throw new OpenCodeV2Error('response-too-large');
  }
  if (!response.body) throw new OpenCodeV2Error('invalid-response');
  const reader = response.body.getReader();
  const buffers = [];
  let total = 0;
  let complete = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { complete = true; break; }
      total += value.byteLength;
      if (total > MAX_RESPONSE) throw new OpenCodeV2Error('response-too-large');
      buffers.push(value);
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const value of buffers) { bytes.set(value, offset); offset += value.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new OpenCodeV2Error('invalid-response'); }
}

async function request(fetcher, origin, authorization, method, path, body, timeoutMs, empty = false) {
  let response;
  try {
    response = await fetcher(origin + path, {
      method, redirect: 'error', cache: 'no-store',
      headers: { accept: 'application/json', 'content-type': 'application/json', authorization },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new OpenCodeV2Error('unavailable');
  }
  if (empty) {
    if (response?.status !== 204) {
      await response?.body?.cancel?.().catch(() => {});
      throw new OpenCodeV2Error('invalid-response');
    }
    await response.body?.cancel?.().catch(() => {});
    return;
  }
  return boundedJson(response);
}

function extractPlan(messages, modelID) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length >= 20) {
    throw new OpenCodeV2Error('invalid-response');
  }
  let assistant;
  for (const message of messages) {
    if (message?.type === 'shell') throw new OpenCodeV2Error('unsafe-tool-result');
    if (message?.type !== 'assistant') continue;
    if (message.agent !== AGENT || message.model?.providerID !== 'ollama' ||
        message.model?.id !== modelID || message.error ||
        !Array.isArray(message.content) || message.content.length > 60) {
      throw new OpenCodeV2Error('invalid-model-response');
    }
    for (const part of message.content) {
      if (part?.type === 'tool' &&
          (!ALLOWED_TOOLS.has(part.name) || part.state?.status !== 'completed')) {
        throw new OpenCodeV2Error('unsafe-tool-result');
      }
      if (!['tool','text','reasoning'].includes(part?.type)) {
        throw new OpenCodeV2Error('invalid-model-response');
      }
    }
    if (!assistant) assistant = message;
  }
  if (!assistant || typeof assistant.finish !== 'string' || !assistant.finish ||
      assistant.time?.completed === undefined) throw new OpenCodeV2Error('incomplete-agent-response');
  const plan = assistant.content
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text).join('\n').trim();
  const length = new TextEncoder().encode(plan).length;
  if (length === 0 || length > MAX_PLAN) throw new OpenCodeV2Error('invalid-plan');
  return plan;
}

export async function planWithOpenCodeV2({ config, prompt, fetcher = fetch }) {
  const { origin, modelID, workspaceDirectory } = checkV2Config(config);
  const authorization = `Basic ${btoa(`opencode:${config.serverPassword}`)}`;
  const authenticatedRequest = (method, path, body, timeoutMs, empty = false) =>
    request(fetcher, origin, authorization, method, path, body, timeoutMs, empty);
  if (typeof prompt !== 'string' || !prompt.trim() ||
      new TextEncoder().encode(prompt).length > MAX_PROMPT) {
    throw new OpenCodeV2Error('invalid-prompt');
  }
  if (typeof fetcher !== 'function') throw new OpenCodeV2Error('invalid-fetcher');
  // Verify the protocol and exact effective agent policy BEFORE any inference.
  const health = await authenticatedRequest('GET', '/api/health', undefined, 10000);
  if (health?.healthy !== true) throw new OpenCodeV2Error('unsupported-protocol');
  const agentPath = '/api/agent?location%5Bdirectory%5D=' + encodeURIComponent(workspaceDirectory);
  const agents = await authenticatedRequest('GET', agentPath, undefined, 10000);
  if (!Array.isArray(agents?.data) || agents.location?.directory !== workspaceDirectory) {
    throw new OpenCodeV2Error('unexpected-workspace');
  }
  checkReadOnlyAgent(agents.data.find(agent => agent?.id === AGENT));
  let sessionId;
  try {
    const created = await authenticatedRequest('POST', '/api/session', {
      agent: AGENT, model: { id: modelID, providerID: 'ollama' },
      location: { directory: workspaceDirectory },
    }, 15000);
    const session = created?.data;
    if (typeof session?.id !== 'string' || !SESSION.test(session.id) ||
        session.agent !== AGENT || session.model?.id !== modelID ||
        session.model?.providerID !== 'ollama' ||
        session.location?.directory !== workspaceDirectory) throw new OpenCodeV2Error('invalid-session');
    sessionId = session.id;
    const admitted = await authenticatedRequest('POST',
      '/api/session/' + sessionId + '/prompt', { prompt: { text: prompt } }, 15000);
    if (admitted?.data?.sessionID !== sessionId ||
        typeof admitted.data.id !== 'string' || !admitted.data.id.startsWith('msg_')) {
      throw new OpenCodeV2Error('invalid-admission');
    }
    // The V2 API uses explicit wait and projected messages; unlike the legacy
    // protocol it has no DELETE session endpoint at the pinned release.
    await authenticatedRequest('POST', '/api/session/' + sessionId + '/wait',
      undefined, 90000, true);
    const messages = await authenticatedRequest('GET',
      '/api/session/' + sessionId + '/message?limit=19&order=desc', undefined, 15000);
    const plan = extractPlan(messages?.data, modelID);
    return { plan, mode: 'read-only', providerID: 'ollama', modelID };
  } catch (error) {
    if (sessionId) {
      try {
        await authenticatedRequest('POST', '/api/session/' + sessionId + '/interrupt',
          undefined, 3000, true);
      } catch { /* The trusted caller must destroy the entire ephemeral worker. */ }
    }
    throw error;
  }
}
