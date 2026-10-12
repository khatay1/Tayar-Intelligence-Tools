/**
 * Provider-neutral boundary for one-shot, untrusted application code.
 * A provider must create a fresh VM with the supplied limits and must not
 * inherit host environment variables, credentials, files or network access.
 * This module is intentionally not mounted into an application route yet.
 */
export const ISOLATED_CODE_LIMITS = Object.freeze({
  maxSourceBytes: 64 * 1024,
  maxInputBytes: 64 * 1024,
  maxOutputBytes: 32 * 1024,
  maxTimeoutMs: 10_000,
  maxJsonDepth: 20,
});

export type IsolatedExecutionFailureCode =
  | 'adapter-unavailable'
  | 'invalid-request'
  | 'execution-timeout'
  | 'execution-failed'
  | 'output-too-large';

export class IsolatedExecutionError extends Error {
  constructor(readonly code: IsolatedExecutionFailureCode) {
    super(code);
    this.name = 'IsolatedExecutionError';
  }
}

export interface IsolatedSandboxOptions {
  runtime: 'node22';
  networkPolicy: 'deny-all';
  persistent: false;
  timeoutMs: number;
  resources: { vcpus: 1 };
}

export interface IsolatedExecutionSandbox {
  /** Execute untrusted source with JSON input inside the isolated VM. */
  execute(source: string, input: unknown): Promise<unknown>;
  /** Stop and discard the one-shot VM. Must also terminate active commands. */
  stop(): Promise<void>;
}

export interface IsolatedExecutionAdapter {
  create(options: IsolatedSandboxOptions): Promise<IsolatedExecutionSandbox>;
}

export interface IsolatedExecutionRequest {
  source: string;
  input: unknown;
  timeoutMs?: number;
}

function jsonBytes(value: unknown, maxDepth: number): number | null {
  const ancestors = new Set<object>();
  const visit = (entry: unknown, depth: number): boolean => {
    if (depth > maxDepth) return false;
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') return true;
    if (typeof entry === 'number') return Number.isFinite(entry);
    if (typeof entry !== 'object') return false;
    if (ancestors.has(entry)) return false;
    const prototype = Object.getPrototypeOf(entry);
    if (!Array.isArray(entry) && prototype !== Object.prototype && prototype !== null) return false;
    ancestors.add(entry);
    const valid = Array.isArray(entry)
      ? entry.every(item => visit(item, depth + 1))
      : Object.entries(entry).every(([key, item]) => typeof key === 'string' && visit(item, depth + 1));
    ancestors.delete(entry);
    return valid;
  };
  try {
    if (!visit(value, 0)) return null;
    const serialized = JSON.stringify(value);
    return typeof serialized === 'string' ? Buffer.byteLength(serialized, 'utf8') : null;
  } catch {
    return null;
  }
}

export async function runIsolatedCustomCode(
  request: IsolatedExecutionRequest,
  adapter?: IsolatedExecutionAdapter,
): Promise<unknown> {
  if (!adapter) throw new IsolatedExecutionError('adapter-unavailable');
  if (!request || typeof request.source !== 'string' || !request.source.trim()
    || Buffer.byteLength(request.source, 'utf8') > ISOLATED_CODE_LIMITS.maxSourceBytes) {
    throw new IsolatedExecutionError('invalid-request');
  }
  const inputSize = jsonBytes(request.input, ISOLATED_CODE_LIMITS.maxJsonDepth);
  if (inputSize === null || inputSize > ISOLATED_CODE_LIMITS.maxInputBytes) {
    throw new IsolatedExecutionError('invalid-request');
  }
  const timeoutMs = request.timeoutMs ?? ISOLATED_CODE_LIMITS.maxTimeoutMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > ISOLATED_CODE_LIMITS.maxTimeoutMs) {
    throw new IsolatedExecutionError('invalid-request');
  }

  let sandbox: IsolatedExecutionSandbox;
  try {
    sandbox = await adapter.create({
      runtime: 'node22',
      networkPolicy: 'deny-all',
      persistent: false,
      timeoutMs,
      resources: { vcpus: 1 },
    });
  } catch {
    throw new IsolatedExecutionError('execution-failed');
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      sandbox.execute(request.source, request.input),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new IsolatedExecutionError('execution-timeout')), timeoutMs);
      }),
    ]);
    const outputSize = jsonBytes(result, ISOLATED_CODE_LIMITS.maxJsonDepth);
    if (outputSize === null) throw new IsolatedExecutionError('execution-failed');
    if (outputSize > ISOLATED_CODE_LIMITS.maxOutputBytes) throw new IsolatedExecutionError('output-too-large');
    return result;
  } catch (error) {
    if (error instanceof IsolatedExecutionError) throw error;
    throw new IsolatedExecutionError('execution-failed');
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await sandbox.stop();
    } catch {
      // Do not replace the execution result with provider details. The adapter
      // contract requires stop() to terminate an active command and discard VM.
    }
  }
}
