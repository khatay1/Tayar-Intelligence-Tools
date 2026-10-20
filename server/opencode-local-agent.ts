/**
 * Opt-in OpenCode bridge for an already isolated, disposable local workspace.
 * This is a trusted SERVER-SIDE adapter, not a public endpoint or a sandbox.
 * Network/filesystem isolation and per-tenant authorization belong to its caller.
 * No OpenCode dependency, server, model, provider, account, or billable API is started here.
 */

export interface LocalOpenCodeAgentConfig {
  enabled?: boolean;
  /** Only localhost inside the dedicated sandbox is accepted. */
  endpoint?: string;
  /** Server-side only; must match OPENCODE_SERVER_PASSWORD inside the sandbox. */
  serverPassword?: string;
  /** Trusted workspace allocated by the sandbox controller, never browser input. */
  workspaceDirectory?: string;
  /** Exact locally installed Ollama model from the isolated OpenCode config. */
  modelId?: string;
  /** Set only after the caller has established per-tenant sandbox/egress isolation. */
  isolatedWorkspaceConfirmed?: boolean;
  fetcher?: typeof fetch;
}

export interface LocalOpenCodeRunRequest {
  task: string;
  /** This approval must be granted by Tayar's authenticated server workflow. */
  approved: boolean;
}

export interface LocalOpenCodeRunResult {
  summary: string;
  changedFiles: string[];
}

export class LocalOpenCodeError extends Error {
  readonly code: 'disabled' | 'invalid-configuration' | 'not-approved' | 'unavailable' | 'unsafe-provider' | 'invalid-response' | 'execution-failed';
  constructor(code: LocalOpenCodeError['code']) {
    super(`OpenCode local agent: ${code}`);
    this.code = code;
    this.name = 'LocalOpenCodeError';
  }
}

const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_TASK_CHARS = 6000;
const REQUEST_TIMEOUT_MS = 120_000;
const SAFE_MODEL = /^[a-zA-Z0-9][\\w./:-]{0,127}$/;
const SAFE_WORKSPACE = /^\\/workspace\\/[a-zA-Z0-9_-]{3,80}$/;
const SAFE_SESSION = /^[a-zA-Z0-9_-]{1,128}$/;
const SAFE_FILE = /^(?!\\/)(?!.*(?:^|\\/)\\.\\.?\\/)(?!.*\\\\)[\\w@.\\-/ ]{1,240}$/;

function loopbackUrl(input: string, expectedPath: string): URL | null {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
        url.username || url.password || url.search || url.hash ||
        url.pathname !== expectedPath || !url.port) return null;
    return url;
  } catch { return null; }
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function configuredLocalProvider(config: unknown, modelId: string): boolean {
  const provider = object(object(object(config)?.provider)?.ollama);
  const options = object(provider?.options);
  const models = object(provider?.models);
  return typeof options?.baseURL === 'string' &&
    loopbackUrl(options.baseURL, '/v1') !== null &&
    Object.hasOwn(models ?? {}, modelId);
}

function safeChangedPaths(diffs: unknown): string[] {
  if (!Array.isArray(diffs) || diffs.length > 200) throw new LocalOpenCodeError('invalid-response');
  const files = new Set<string>();
  for (const diff of diffs) {
    const name = object(diff)?.file;
    if (typeof name !== 'string' || !SAFE_FILE.test(name) ||
        /(^|\\/)(\\.env(?:\\..*)?|\\.git|node_modules)(\\/|$)/i.test(name)) {
      throw new LocalOpenCodeError('invalid-response');
    }
    files.add(name);
  }
  return [...files];
}

export function createLocalOpenCodeAgent(config: LocalOpenCodeAgentConfig) {
  const enabled = config.enabled === true;
  const endpoint = config.endpoint ?? '';
  const endpointUrl = loopbackUrl(endpoint, '/');
  const password = config.serverPassword;
  const directory = config.workspaceDirectory;
  const modelId = config.modelId;
  const isolated = config.isolatedWorkspaceConfirmed === true;
  const fetcher = config.fetcher ?? fetch;

  function validate() {
    if (!enabled) throw new LocalOpenCodeError('disabled');
    if (!isolated || !endpointUrl || !password || password.length < 16 ||
        !directory || !SAFE_WORKSPACE.test(directory) || !/^[\\x21-\\x7e]{16,256}$/.test(password) || !modelId || !SAFE_MODEL.test(modelId)) {
      throw new LocalOpenCodeError('invalid-configuration');
    }
  }

  async function request(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<unknown> {
    validate();
    // Paths are made here from fixed literals or validated server-returned session IDs.
    const url = new URL(path, endpointUrl!);
    const headers: Record<string, string> = {
      'authorization': `Basic ${btoa(`opencode:${password}`)}`,
      'x-opencode-directory': directory!,
      'accept': 'application/json',
    };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let response: Response;
    try {
      response = await fetcher(url, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch { throw new LocalOpenCodeError('unavailable'); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new LocalOpenCodeError('unavailable');
    }
    if (response.status === 204) return null;
    if (!response.body) throw new LocalOpenCodeError('invalid-response');
    const reader = response.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    let done = false;
    try {
      const declared = Number(response.headers.get('content-length'));
      if (declared > MAX_RESPONSE_BYTES) throw new LocalOpenCodeError('invalid-response');
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        bytes += read.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) throw new LocalOpenCodeError('invalid-response');
        chunks.push(read.value);
      }
      done = true;
    } catch { throw new LocalOpenCodeError('invalid-response'); }
    finally {
      if (!done) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    try {
      const data = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
      return JSON.parse(new TextDecoder().decode(data));
    } catch { throw new LocalOpenCodeError('invalid-response'); }
  }

  async function probe(): Promise<{ healthy: true; version: string }> {
    validate();
    const health = object(await request('GET', '/global/health'));
    if (health?.healthy !== true || typeof health.version !== 'string' || health.version.length > 64) {
      throw new LocalOpenCodeError('invalid-response');
    }
    const settings = await request('GET', '/config');
    if (!configuredLocalProvider(settings, modelId!)) throw new LocalOpenCodeError('unsafe-provider');
    return { healthy: true, version: health.version };
  }

  async function run(input: LocalOpenCodeRunRequest): Promise<LocalOpenCodeRunResult> {
    validate();
    if (input.approved !== true) throw new LocalOpenCodeError('not-approved');
    if (typeof input.task !== 'string' || !input.task.trim() || input.task.length > MAX_TASK_CHARS) {
      throw new LocalOpenCodeError('invalid-configuration');
    }
    // Fail before creating a session if local-only provider config has drifted.
    await probe();
    const created = object(await request('POST', '/session', { title: 'Tayar isolated coding task' }));
    const sessionId = created?.id;
    if (typeof sessionId !== 'string' || !SAFE_SESSION.test(sessionId)) {
      throw new LocalOpenCodeError('invalid-response');
    }
    const route = `/session/${sessionId}`;
    let finished = false;
    try {
      const message = object(await request('POST', `${route}/message`, {
        model: { providerID: 'ollama', modelID: modelId },
        agent: 'build',
        // No shell, subagents, or outbound web tools in the first integration.
        // Edits can only affect the disposable, otherwise empty sandbox workspace.
        tools: { bash: false, task: false, webfetch: false, websearch: false },
        parts: [{ type: 'text', text: input.task }],
      }));
      if (!message || !Array.isArray(message.parts) || object(message.info)?.error) {
        throw new LocalOpenCodeError('execution-failed');
      }
      const diff = await request('GET', `${route}/diff`);
      const parts = message.parts.filter((p: unknown) => object(p)?.type === 'text');
      const summary = parts.map((p: unknown) => object(p)?.text).filter((t: unknown): t is string => typeof t === 'string').join('\\n').slice(0, 4000);
      const result = { summary, changedFiles: safeChangedPaths(diff) };
      finished = true;
      return result;
    } finally {
      if (!finished) await request('POST', `${route}/abort`).catch(() => {});
      // Never retain agent sessions between independent users/tasks.
      await request('DELETE', route);
    }
  }

  return { probe, run };
}
