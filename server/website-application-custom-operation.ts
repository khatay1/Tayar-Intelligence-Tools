import {
  IsolatedExecutionError,
  runIsolatedCustomCode,
  type IsolatedExecutionAdapter,
} from './isolated-code-execution';

export type PublishedCustomOperationErrorCode =
  | 'disabled'
  | 'invalid-request'
  | 'not-authorized'
  | 'unavailable'
  | 'execution-failed'
  | 'execution-timeout'
  | 'output-too-large';

export class PublishedCustomOperationError extends Error {
  constructor(readonly code: PublishedCustomOperationErrorCode) {
    super(code);
    this.name = 'PublishedCustomOperationError';
  }
}

export interface PublishedCustomOperationRequest {
  ownerId: string;
  projectId: string;
  releaseId: string;
  operationId: string;
  input: unknown;
}

/** Server-only dependencies. Source must be loaded from the immutable release;
 * it is deliberately absent from the request accepted from an application. */
export interface PublishedCustomOperationDependencies {
  loadOperation(input: Pick<PublishedCustomOperationRequest, 'projectId' | 'releaseId' | 'operationId'>):
    Promise<{ releaseId: string; source: string } | null>;
  authorize(input: PublishedCustomOperationRequest): Promise<boolean>;
  reserveUsage(input: PublishedCustomOperationRequest): Promise<boolean>;
  adapter: IsolatedExecutionAdapter;
  enabled?: boolean;
}

const safeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);

/** Executes only an operation resolved from the caller's immutable release.
 * The feature is disabled by default and usage reservation is mandatory. */
export async function runPublishedCustomOperation(
  request: PublishedCustomOperationRequest,
  dependencies: PublishedCustomOperationDependencies,
): Promise<unknown> {
  if (dependencies.enabled !== true) throw new PublishedCustomOperationError('disabled');
  if (!request || Object.keys(request).some(key => !['ownerId', 'projectId', 'releaseId', 'operationId', 'input'].includes(key))
    || !safeId(request.ownerId) || !safeId(request.projectId)
    || !safeId(request.releaseId) || !safeId(request.operationId)) {
    throw new PublishedCustomOperationError('invalid-request');
  }

  try {
    if (!await dependencies.authorize(request)) throw new PublishedCustomOperationError('not-authorized');
    const operation = await dependencies.loadOperation(request);
    if (!operation || operation.releaseId !== request.releaseId || typeof operation.source !== 'string') {
      throw new PublishedCustomOperationError('unavailable');
    }
    if (!await dependencies.reserveUsage(request)) throw new PublishedCustomOperationError('unavailable');
    return await runIsolatedCustomCode({ source: operation.source, input: request.input }, dependencies.adapter);
  } catch (error) {
    if (error instanceof PublishedCustomOperationError) throw error;
    if (error instanceof IsolatedExecutionError) {
      if (error.code === 'invalid-request') throw new PublishedCustomOperationError('invalid-request');
      if (error.code === 'execution-timeout') throw new PublishedCustomOperationError('execution-timeout');
      if (error.code === 'output-too-large') throw new PublishedCustomOperationError('output-too-large');
    }
    throw new PublishedCustomOperationError('execution-failed');
  }
}
