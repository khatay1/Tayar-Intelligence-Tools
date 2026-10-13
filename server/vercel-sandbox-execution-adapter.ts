import type {
  IsolatedExecutionAdapter,
  IsolatedExecutionSandbox,
  IsolatedSandboxOptions,
} from './isolated-code-execution';
import { IsolatedExecutionError } from './isolated-code-execution';

const API_ORIGIN = 'https://api.vercel.com';
const SESSION_STARTUP_ALLOWANCE_MS = 30_000;
const SESSION_ID = /^[A-Za-z0-9_-]{1,128}$/;
const COMMAND_ID = /^[A-Za-z0-9_-]{1,128}$/;
const UTF8 = new TextEncoder();

export interface VercelSandboxAdapterConfig {
  token: string;
  teamId?: string;
  projectId: string;
  fetcher?: typeof fetch;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function query(teamId?: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (teamId) params.set('teamId', teamId);
  const value = params.toString();
  return value ? `?${value}` : '';
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error('Vercel Sandbox request failed.');
  try {
    const value = record(await response.json());
    if (!value) throw new Error();
    return value;
  } catch {
    throw new Error('Vercel Sandbox response was invalid.');
  }
}

function sessionIdFrom(value: Record<string, unknown>): string {
  const session = record(value.session);
  const id = session?.id;
  if (typeof id !== 'string' || !SESSION_ID.test(id)) throw new Error('Vercel Sandbox session was invalid.');
  return id;
}

function commandIdFrom(value: Record<string, unknown>): string {
  const command = record(value.command);
  const id = command?.id;
  if (typeof id !== 'string' || !COMMAND_ID.test(id)) throw new Error('Vercel Sandbox command was invalid.');
  return id;
}

function createRunnerArgs(source: string, input: unknown): string[] {
  // This trusted bootstrap executes only inside the isolated VM. Source and
  // input are separate argv values, never shell text or host-side evaluation.
  const runner = 'void (async()=>{try{const input=JSON.parse(process.argv[2]);const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const value=await (new AsyncFunction("input",process.argv[1]))(input);const output=JSON.stringify(value);if(typeof output!=="string")throw new Error();process.stdout.write(output)}catch{process.exitCode=1}})();';
  return ['-e', runner, source, JSON.stringify(input)];
}

async function readStdout(response: Response, maxBytes: number): Promise<string> {
  if (!response.ok || !response.body) throw new Error('Vercel Sandbox logs were unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let stdout = '';
  let streamBytes = 0;
  let complete = false;
  const consume = (line: string) => {
    if (!line) return;
    let entry: Record<string, unknown> | null;
    try { entry = record(JSON.parse(line)); } catch { throw new Error('Vercel Sandbox logs were invalid.'); }
    if (!entry || typeof entry.stream !== 'string') throw new Error('Vercel Sandbox logs were invalid.');
    if (entry.stream === 'error') throw new Error('Vercel Sandbox command failed.');
    if (entry.stream !== 'stdout' && entry.stream !== 'stderr') throw new Error('Vercel Sandbox logs were invalid.');
    if (typeof entry.data !== 'string') throw new Error('Vercel Sandbox logs were invalid.');
    if (entry.stream === 'stdout') {
      stdout += entry.data;
      if (UTF8.encode(stdout).byteLength > maxBytes) throw new IsolatedExecutionError('output-too-large');
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamBytes += value.byteLength;
      if (streamBytes > maxBytes + 16_384) throw new IsolatedExecutionError('output-too-large');
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      lines.forEach(consume);
    }
    pending += decoder.decode();
    if (pending) consume(pending);
    complete = true;
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return stdout;
}

export function createVercelSandboxExecutionAdapter(
  config: VercelSandboxAdapterConfig,
): IsolatedExecutionAdapter {
  if (typeof config.token !== 'string' || !config.token.trim() || config.token.length > 4096) {
    throw new Error('Vercel Sandbox credentials are unavailable.');
  }
  if (config.teamId !== undefined && !/^[A-Za-z0-9_-]{1,128}$/.test(config.teamId)) {
    throw new Error('Vercel Sandbox team scope is invalid.');
  }
  if (typeof config.projectId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(config.projectId)) {
    throw new Error('Vercel Sandbox project scope is invalid.');
  }
  const fetcher = config.fetcher ?? fetch;
  const headers = { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' };

  const request = async (path: string, init: RequestInit): Promise<Response> => fetcher(`${API_ORIGIN}${path}`, {
    ...init,
    redirect: 'error',
    headers: new Headers({ ...headers, ...Object.fromEntries(new Headers(init.headers).entries()) }),
  });

  return {
    async create(options: IsolatedSandboxOptions): Promise<IsolatedExecutionSandbox> {
      if (options.networkPolicy !== 'deny-all' || options.persistent !== false
        || options.runtime !== 'node22' || options.resources.vcpus !== 1) {
        throw new Error('Vercel Sandbox policy was not satisfied.');
      }
      const lifetime = options.timeoutMs + SESSION_STARTUP_ALLOWANCE_MS;
      const created = await responseJson(await request(`/v2/sandboxes${query(config.teamId, { projectId: config.projectId })}`, {
        method: 'POST',
        signal: AbortSignal.timeout(SESSION_STARTUP_ALLOWANCE_MS),
        body: JSON.stringify({
          runtime: 'node22',
          networkPolicy: { mode: 'custom', allowedDomains: [], allowedCIDRs: [], deniedCIDRs: [] },
          resources: { vcpus: '1', memory: '2048' },
          timeout: lifetime,
          persistent: false,
          ports: [],
        }),
      }));
      const sessionId = sessionIdFrom(created);
      let stopped = false;

      return {
        async execute(source: string, input: unknown): Promise<unknown> {
          const started = await responseJson(await request(
            `/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/cmd${query(config.teamId, { cmdId: crypto.randomUUID() })}`,
            {
              method: 'POST',
              signal: AbortSignal.timeout(options.timeoutMs + 1_000),
              body: JSON.stringify({
                command: 'node',
                args: createRunnerArgs(source, input),
                cwd: '/vercel/sandbox',
                sudo: false,
                wait: false,
                logs: false,
                timeout: options.timeoutMs,
              }),
            },
          ));
          const commandId = commandIdFrom(started);
          const commandPath = `/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/cmd/${encodeURIComponent(commandId)}`;
          const completed = await responseJson(await request(`${commandPath}${query(config.teamId, { wait: 'true' })}`, {
            method: 'GET',
            signal: AbortSignal.timeout(options.timeoutMs + 1_000),
          }));
          const command = record(completed.command);
          const exitCode = command?.exitCode;
          if (exitCode !== 0 && exitCode !== '0') throw new Error('Vercel Sandbox command failed.');

          const logs = await request(`${commandPath}/logs${query(config.teamId)}`, {
            method: 'GET',
            signal: AbortSignal.timeout(options.timeoutMs + 1_000),
            headers: { accept: 'application/x-ndjson' },
          });
          const output = await readStdout(logs, 32 * 1024);
          try { return JSON.parse(output); } catch { throw new Error('Vercel Sandbox output was invalid.'); }
        },

        async stop(): Promise<void> {
          if (stopped) return;
          stopped = true;
          const response = await request(`/v2/sandboxes/sessions/${encodeURIComponent(sessionId)}/stop${query(config.teamId)}`, {
            method: 'POST',
            signal: AbortSignal.timeout(2_000),
          });
          if (!response.ok && response.status !== 404 && response.status !== 410) {
            throw new Error('Vercel Sandbox could not be stopped.');
          }
        },
      };
    },
  };
}
