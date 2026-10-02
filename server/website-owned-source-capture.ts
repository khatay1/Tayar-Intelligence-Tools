import { captureWebsiteGitHubExportSource, type SourceReader } from '../src/modules/website-builder/services/websiteGithubExportSourceService';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';
import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { analyzeByoSourceCapabilities, type ByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';
import { compileWebsiteOwnedApplicationSource } from './website-owned-source-compiler';

type Environment = 'preview' | 'production';
export interface OwnedRuntimeBinding {
  projectId: string;
  ownerId: string;
  environment: Environment;
  bindingVersion: number;
  supabaseConnectionId: string;
  supabaseConnectionVersion: number;
  vercelConnectionId: string;
  vercelConnectionVersion: number;
  applicationOrigin: string;
  backend: ApplicationPublicBackend;
}
export interface OwnedSourceReader extends SourceReader {
  readOwnedRuntimeBinding(projectId: string, ownerId: string, environment: Environment): Promise<OwnedRuntimeBinding | null>;
}
type Verification = (binding: OwnedRuntimeBinding, supabase: InfrastructureConnection,
  vercel: InfrastructureConnection, capabilities: ByoSourceCapabilities) => Promise<boolean>;

/** Source-only trust boundary. The binding and both provider records come from
 * private, owner-scoped persistence, never editable snapshot fields. Provider
 * ownership and schema/Auth/RLS proof must be supplied by a live verifier. */
export async function captureWebsiteOwnedApplicationSource(input: {
  projectId: string; ownerId: string; githubConnectionId: string; environment: Environment;
  platformOrigin: string; platformUrl: string;
  reader: OwnedSourceReader;
  verifyRuntime: Verification;
}) {
  if (typeof window !== 'undefined' || !['preview', 'production'].includes(input.environment)) {
    throw new Error('Customer runtime scope is unavailable.');
  }
  const captured: { value?: { binding: OwnedRuntimeBinding; supabase: InfrastructureConnection; vercel: InfrastructureConnection } } = {};
  const state: { capabilities?: ByoSourceCapabilities } = {};
  const identity = (connection: InfrastructureConnection) => JSON.stringify({
    id: connection.id, ownerId: connection.ownerId, projectId: connection.projectId,
    provider: connection.provider, environment: connection.environment, accountId: connection.accountId,
    targetId: connection.targetId, permissions: [...connection.permissions].sort(), status: connection.status,
    version: connection.version, operationId: connection.operationId, verifiedAt: connection.verifiedAt,
  });
  async function current() {
    const binding = await input.reader.readOwnedRuntimeBinding(input.projectId, input.ownerId, input.environment);
    if (!binding || binding.ownerId !== input.ownerId || binding.projectId !== input.projectId
      || binding.environment !== input.environment || !Number.isSafeInteger(binding.bindingVersion)||binding.bindingVersion<1
      || !binding.supabaseConnectionId||!Number.isSafeInteger(binding.supabaseConnectionVersion)||binding.supabaseConnectionVersion<1
      || !binding.vercelConnectionId||!Number.isSafeInteger(binding.vercelConnectionVersion)||binding.vercelConnectionVersion<1
      || binding.supabaseConnectionId === binding.vercelConnectionId) throw new Error();
    const [supabase, vercel] = await Promise.all([
      input.reader.readConnection(binding.supabaseConnectionId, input.projectId, input.ownerId),
      input.reader.readConnection(binding.vercelConnectionId, input.projectId, input.ownerId),
    ]);
    if (!supabase || !vercel) throw new Error();
    assertInfrastructureConnection(supabase); assertInfrastructureConnection(vercel);
    if (supabase.ownerId !== input.ownerId || vercel.ownerId !== input.ownerId
      || supabase.projectId !== input.projectId || vercel.projectId !== input.projectId
      || supabase.id !== binding.supabaseConnectionId || vercel.id !== binding.vercelConnectionId
      || supabase.version !== binding.supabaseConnectionVersion||vercel.version !== binding.vercelConnectionVersion
      || supabase.provider !== 'supabase' || vercel.provider !== 'vercel'
      || supabase.environment !== input.environment || vercel.environment !== input.environment
      || supabase.status !== 'ready'
      || !['connected','setup-incomplete','deployment-failed','ready'].includes(vercel.status)
      || supabase.targetId !== binding.backend.projectRef) throw new Error();
    validateOwnedApplicationPublicBackend(binding.backend, supabase.targetId);
    const origin = new URL(binding.applicationOrigin);
    if (origin.protocol !== 'https:' || origin.origin !== binding.applicationOrigin
      || origin.origin === input.platformOrigin || origin.origin === input.platformUrl
      || origin.hostname.endsWith('.supabase.co')) throw new Error();
    if (!state.capabilities || !await input.verifyRuntime(structuredClone(binding), structuredClone(supabase),
      structuredClone(vercel), structuredClone(state.capabilities))) throw new Error();
    return { binding, supabase, vercel };
  }
  const source = await captureWebsiteGitHubExportSource({
    projectId: input.projectId, ownerId: input.ownerId, connectionId: input.githubConnectionId, reader: input.reader,
    async compile(snapshot) {
      state.capabilities = analyzeByoSourceCapabilities(snapshot, input.environment);
      captured.value = await current();
      return compileWebsiteOwnedApplicationSource(snapshot, { projectId: input.projectId,
        applicationOrigin: captured.value.binding.applicationOrigin, expectedProjectRef: captured.value.supabase.targetId!,
        backend: captured.value.binding.backend, environment: input.environment,
        platformOrigin: input.platformOrigin, platformUrl: input.platformUrl });
    },
  });
  if (!captured.value) throw new Error('Customer runtime scope is unavailable.');
  const initial = captured.value;
  const boundIdentity = JSON.stringify(initial.binding);
  const supabaseIdentity = identity(initial.supabase), vercelIdentity = identity(initial.vercel);
  async function isCurrent(): Promise<boolean> {
    try {
      const latest = await current();
      return JSON.stringify(latest.binding) === boundIdentity
        && identity(latest.supabase) === supabaseIdentity && identity(latest.vercel) === vercelIdentity
        && await source.isCurrent();
    } catch { return false; }
  }
  if (!await isCurrent()) throw new Error('Customer runtime scope changed.');
  return { ...source, binding: structuredClone(initial.binding), supabase: structuredClone(initial.supabase),
    vercel: structuredClone(initial.vercel), capabilities: structuredClone(state.capabilities!), isCurrent };
}
