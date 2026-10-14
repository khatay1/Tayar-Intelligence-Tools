import {
  PublishedCustomOperationError,
  runPublishedCustomOperation,
  type PublishedCustomOperationDependencies,
} from './website-application-custom-operation';

const maxBodyBytes = 32 * 1024;
const failure = (status: number, code: string) => Response.json({ error: code }, {
  status,
  headers: { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store', 'vary': 'Origin, Authorization, Cookie', 'x-content-type-options': 'nosniff' },
});

async function readBoundedBody(request: Request): Promise<string> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^\d{1,8}$/.test(declaredLength) || Number(declaredLength) > maxBodyBytes)) throw new Error();
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') throw new Error();
  if (!request.body) throw new Error();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        throw new Error();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    reader.releaseLock();
  }
}

/** Server route contract. The caller must provide identities and the app origin
 * from its verified release; none of these values come from request parameters. */
export async function servePublishedCustomOperationRequest(input: {
  request: Request;
  ownerId: string;
  projectId: string;
  applicationOrigin: string;
  dependencies: PublishedCustomOperationDependencies;
}): Promise<Response> {
  const { request, ownerId, projectId, applicationOrigin, dependencies } = input;
  const headers = { 'cache-control': 'private, no-store', 'cdn-cache-control': 'no-store', 'vary': 'Origin, Authorization, Cookie' };
  try {
    const expectedOrigin = new URL(applicationOrigin);
    const url = new URL(request.url);
    if (expectedOrigin.protocol !== 'https:' || expectedOrigin.origin !== applicationOrigin
      || url.origin !== applicationOrigin || url.pathname !== '/api/application-operation' || url.search || url.hash) {
      return failure(404, 'not_found');
    }
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, allow: 'POST' } });
    if (request.headers.get('origin') !== applicationOrigin
      || (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
      return failure(403, 'not_authorized');
    }
    if ((request.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
      return failure(415, 'invalid_request');
    }
    const parsed: unknown = JSON.parse(await readBoundedBody(request));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failure(400, 'invalid_request');
    const body = parsed as Record<string, unknown>;
    if (Object.keys(body).some(key => !['releaseId', 'operationId', 'input'].includes(key))
      || !Object.hasOwn(body, 'input')) return failure(400, 'invalid_request');
    const result = await runPublishedCustomOperation({
      ownerId, projectId,
      releaseId: body.releaseId as string,
      operationId: body.operationId as string,
      input: body.input,
    }, dependencies);
    return Response.json({ result }, { headers: { ...headers, 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    const code = error instanceof PublishedCustomOperationError ? error.code : 'invalid-request';
    const status = code === 'disabled' ? 404
      : code === 'invalid-request' ? 400
        : code === 'not-authorized' ? 403
          : code === 'execution-timeout' ? 504
            : code === 'execution-failed' || code === 'output-too-large' ? 502 : 503;
    return failure(status, code.replaceAll('-', '_'));
  }
}
