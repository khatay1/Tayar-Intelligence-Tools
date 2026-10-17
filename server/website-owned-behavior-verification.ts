import type { GitHubSourceFile } from '../src/modules/website-builder/services/websiteGithubExportTransport';
import { readOwnedReleaseIdentity } from './website-owned-release-identity';

/** Verifies the fresh, credential-free behavioral self-test on a provider-pinned
 * unaliased deployment URL. It proves only the compiled runtime boundaries. */
export async function verifyOwnedDeployedBehavior(input: {
  projectId: string; liveUrl: string; files: GitHubSourceFile[]; isCurrent(): Promise<boolean>; fetcher?: typeof fetch;
}): Promise<void> {
  const failure = () => new Error('Customer deployed behavior verification is unavailable.');
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined; let body: ReadableStream<Uint8Array> | null = null;
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const origin = new URL(input.liveUrl), expected = await readOwnedReleaseIdentity(input.files);
    if (origin.origin !== input.liveUrl || origin.protocol !== 'https:' || origin.port || origin.username || origin.password
      || !/^[a-z0-9-]+\.vercel\.app$/.test(origin.hostname) || expected.projectId !== input.projectId
      || expected.environment !== 'production' || !await input.isCurrent()) throw failure();
    const challenge = crypto.randomUUID(), url = new URL('/api/application', origin);
    url.searchParams.set('tayarRoute', 'release-behavior-proof'); url.searchParams.set('challenge', challenge);
    timer = setTimeout(() => controller.abort(), 8000);
    const response = await (input.fetcher ?? fetch)(url, { method: 'GET', redirect: 'error', cache: 'no-store',
      credentials: 'omit', signal: controller.signal, headers: { accept: 'application/json' } });
    body = response.body;
    if (response.status !== 200 || response.url && response.url !== url.href
      || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')
      || !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control') ?? '')
      || Number(response.headers.get('content-length') ?? 0) > 2048 || !response.body) throw failure();
    reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > 2048) throw failure(); chunks.push(part.value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw failure();
    const value = raw as Record<string, unknown>;
    if (Object.keys(value).sort().join(',') !== 'behaviorVersion,challenge,checks,environment,projectId,runtimeDigest,version'
      || value.version !== expected.version || value.projectId !== expected.projectId || value.environment !== 'production'
      || value.runtimeDigest !== expected.runtimeDigest || value.behaviorVersion !== 1 || value.challenge !== challenge
      || JSON.stringify(value.checks) !== '["auth-shell","anonymous-session-denial","unknown-route-denial"]'
      || !await input.isCurrent()) throw failure();
  } catch { throw failure(); }
  finally { if (timer !== undefined) clearTimeout(timer); controller.abort();
    if (reader) { try { await reader.cancel(); } catch { /* ignore */ } }
    else if (body) { try { await body.cancel(); } catch { /* ignore */ } } }
}
