/**
 * Dormant, internal-only OpenCode planning adapter.
 * No API route or browser import: callers must provision an isolated local workspace.
 * This code does not launch a process, grant permissions, configure a model provider,
 * or attest that the caller's sandbox/egress firewall actually exists.
 */
const RESPONSE_LIMIT = 192 * 1024;
const PLAN_LIMIT = 16 * 1024;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;

export class OpenCodeLocalError extends Error {
  constructor(code) {
    super(code);
    this.name = 'OpenCodeLocalError';
    this.code = code;
  }
}

export function validateLocalOpenCodeConfig(config) {
  if (!config || config.enabled !== true) throw new OpenCodeLocalError('disabled');
  // These two flags are operator declarations, NOT runtime proof of isolation.
  if (config.sandboxed !== true || config.offline !== true) {
    throw new OpenCodeLocalError('isolation-required');
  }
  if (typeof config.baseUrl !== 'string') throw new OpenCodeLocalError('invalid-endpoint');
  let url;
  try { url = new URL(config.baseUrl); } catch { throw new OpenCodeLocalError('invalid-endpoint'); }
  // Literal loopback only. No DNS hostnames, cloud endpoints, URL credentials or paths.
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      !url.port || url.pathname !== '/' || url.search || url.hash ||
      url.username || url.password ||
      !/^http:\/\/127\.0\.0\.1:[0-9]{2,5}\/?$/.test(config.baseUrl)) {
    throw new OpenCodeLocalError('invalid-endpoint');
  }
  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new OpenCodeLocalError('invalid-endpoint');
  }
  if (config.providerID !== 'ollama' ||
      typeof config.modelID !== 'string' || !MODEL_ID.test(config.modelID) ||
      /cloud|remote|online/i.test(config.modelID)) {
    throw new OpenCodeLocalError('local-model-required');
  }
  return { baseUrl: url.origin, modelID: config.modelID };
}

async function boundedJson(response) {
  if (!response || !response.ok) {
    await response?.body?.cancel?.().catch(() => {});
    throw new OpenCodeLocalError('opencode-unavailable');
  }
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > RESPONSE_LIMIT) {
    await response.body?.cancel().catch(() => {});
    throw new OpenCodeLocalError('response-too-large');
  }
  if (!response.body) throw new OpenCodeLocalError('invalid-response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  let doneReading = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { doneReading = true; break; }
      size += value.byteLength;
      if (size > RESPONSE_LIMIT) throw new OpenCodeLocalError('response-too-large');
      chunks.push(value);
    }
  } finally {
    if (!doneReading) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new OpenCodeLocalError('invalid-response'); }
}

async function request(fetcher, baseUrl, method, path, body, timeoutMs) {
  let response;
  try {
    response = await fetcher(baseUrl + path, {
      method,
      redirect: 'error',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new OpenCodeLocalError('opencode-unavailable');
  }
  return boundedJson(response);
}

/**
 * Read-only exploration pilot. It cannot be called from the browser.
 * The dedicated OpenCode server MUST run in an externally enforced, ephemeral,
 * no-egress workspace, with its Ollama base URL pinned to a LOCAL model server.
 * Permission keys are defense-in-depth; they are not filesystem isolation.
 */
export async function planWithLocalOpenCode({ config, prompt, fetcher = fetch }) {
  const { baseUrl, modelID } = validateLocalOpenCodeConfig(config);
  if (typeof prompt !== 'string' || !prompt.trim() ||
      new TextEncoder().encode(prompt).byteLength > 10 * 1024) {
    throw new OpenCodeLocalError('invalid-prompt');
  }
  if (typeof fetcher !== 'function') throw new OpenCodeLocalError('invalid-fetcher');
  let sessionId;
  let plan;
  let failure;
  let cleanupFailed = false;
  try {
    const session = await request(fetcher, baseUrl, 'POST', '/session',
      { title: 'Tayar isolated local planning' }, 15000);
    if (!SESSION_ID.test(session?.id ?? '')) throw new OpenCodeLocalError('invalid-session');
    sessionId = session.id;
    const response = await request(fetcher, baseUrl, 'POST',
      '/session/' + encodeURIComponent(sessionId) + '/message', {
        model: { providerID: 'ollama', modelID },
        agent: 'plan',
        // Explicitly disable all tools except non-mutating file inspection.
        // The sandbox's own OpenCode permission policy must deny writes/exec too.
        tools: { '*': false, read: true, grep: true, glob: true },
        parts: [{ type: 'text', text: prompt }],
      }, 90000);
    if (response?.info?.role !== 'assistant' ||
        response.info.providerID !== 'ollama' ||
        response.info.modelID !== modelID ||
        !Array.isArray(response.parts)) {
      throw new OpenCodeLocalError('invalid-model-response');
    }
    plan = response.parts
      .filter(part => part?.type === 'text' && typeof part.text === 'string')
      .map(part => part.text).join('\n').trim();
    if (!plan || new TextEncoder().encode(plan).byteLength > PLAN_LIMIT) {
      throw new OpenCodeLocalError('invalid-plan');
    }
    const diff = await request(fetcher, baseUrl, 'GET',
      '/session/' + encodeURIComponent(sessionId) + '/diff', undefined, 15000);
    if (!Array.isArray(diff) || diff.length !== 0) {
      throw new OpenCodeLocalError('unexpected-file-mutation');
    }
  } catch (error) {
    failure = error;
  } finally {
    if (sessionId) {
      try {
        const deleted = await request(fetcher, baseUrl, 'DELETE',
          '/session/' + encodeURIComponent(sessionId), undefined, 15000);
        if (deleted !== true) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
  }
  if (failure) throw failure;
  if (cleanupFailed) throw new OpenCodeLocalError('session-cleanup-failed');
  return { plan, providerID: 'ollama', modelID, mode: 'read-only' };
}
