import type { GitHubSourceFile } from '../src/modules/website-builder/services/websiteGithubExportTransport';
import { readOwnedReleaseIdentity } from './website-owned-release-identity';

/** Call only after authenticated Vercel inspection pins the exact deployment
 * URL to the customer project/commit. No custom host, redirect or credentials. */
export async function verifyOwnedDeployedRuntime(input: {
  projectId: string;
  environment: 'preview' | 'production';
  liveUrl: string;
  files: GitHubSourceFile[];
  isCurrent(): Promise<boolean>;
  fetcher?: typeof fetch;
}): Promise<void> {
  const failure = () => new Error('Customer deployed runtime verification is unavailable.');
  if (typeof window !== 'undefined') throw failure();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let body: ReadableStream<Uint8Array> | null = null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const origin = new URL(input.liveUrl);
    if (origin.origin !== input.liveUrl || origin.protocol !== 'https:' || origin.port || origin.username || origin.password
      || !/^[a-z0-9-]+\.vercel\.app$/.test(origin.hostname)) throw failure();
    const expected = await readOwnedReleaseIdentity(input.files);
    if (expected.projectId !== input.projectId || expected.environment !== input.environment || !await input.isCurrent()) throw failure();
    const challenge = crypto.randomUUID();
    const url = new URL('/api/application', origin);
    url.searchParams.set('tayarRoute', 'release-proof'); url.searchParams.set('challenge', challenge);
    timer = setTimeout(() => controller.abort(), 8000);
    const response = await (input.fetcher ?? fetch)(url, { method: 'GET', redirect: 'error', cache: 'no-store',
      credentials: 'omit', signal: controller.signal, headers: { accept: 'application/json' } });
    body = response.body;
    if (response.status !== 200 || (response.url && response.url !== url.href)
      || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')
      || !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') ?? '')
      || Number(response.headers.get('content-length') ?? 0) > 1024 || !response.body) throw failure();
    reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength; if (size > 1024) throw failure(); chunks.push(result.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const result: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw failure();
    const value = result as Record<string, unknown>;
    if (Object.keys(value).sort().join(',') !== 'challenge,environment,projectId,runtimeDigest,version'
      || value.version !== expected.version || value.projectId !== expected.projectId
      || value.environment !== expected.environment || value.runtimeDigest !== expected.runtimeDigest
      || value.challenge !== challenge || !await input.isCurrent()) throw failure();
  } catch { throw failure(); }
  finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
    if (reader) { try { await reader.cancel(); } catch { /* Never expose response errors. */ } }
    else if (body) { try { await body.cancel(); } catch { /* Never expose response errors. */ } }
  }
}
