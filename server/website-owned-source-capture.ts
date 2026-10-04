import { captureWebsiteGitHubExportSource, type SourceReader } from '../src/modules/website-builder/services/websiteGithubExportSourceService';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';
import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { analyzeByoSourceCapabilities, type ByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';
import { readEditorIntegrationsFromProject } from '../src/modules/website-builder/core/editor-integrations-project-host';
import { isEditorProjectSecretReferenceFor } from '../src/modules/website-builder/core/editor-integration-security';
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
export interface OwnedStripeRuntimeSource { sourceConnectionId:string;sourceUpdatedAt:string;publishableKey:string; }
const stripePublishable=/^pk_(test|live)_[A-Za-z0-9]+$/;
function stripeRuntimeSource(snapshot:Record<string,unknown>,projectId:string,environment:Environment,
  capabilities:ByoSourceCapabilities):OwnedStripeRuntimeSource|null{
  if(!capabilities.integrationProviders.includes('stripe')&&!capabilities.stripeCheckouts.length)return null;
  const active=readEditorIntegrationsFromProject(snapshot).connections.filter(item=>item.enabled&&item.status!=='disabled'
    &&item.providerId==='stripe'&&item.environments.includes(environment));
  if(active.length!==1)throw new Error('Customer Stripe runtime source is unavailable.');
  const selected=active[0],secret=selected.secrets.secretKey;
  const publishableKey=typeof selected.config.publishableKey==='string'?selected.config.publishableKey:'';
  const match=stripePublishable.exec(publishableKey),mode=environment==='production'?'live':'test';
  if(selected.environments.length!==1||selected.environments[0]!==environment||!match||match[1]!==mode||!secret
    ||!isEditorProjectSecretReferenceFor(secret.ref,selected.id,'secretKey',environment)
    ||!secret.ref.startsWith(`secret://website/${projectId}/`)
    ||typeof secret.updatedAt!=='string'||!Number.isFinite(Date.parse(secret.updatedAt)))
    throw new Error('Customer Stripe runtime source is unavailable.');
  return{sourceConnectionId:selected.id,sourceUpdatedAt:secret.updatedAt,publishableKey};
}

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
  const state: { capabilities?: ByoSourceCapabilities;stripeRuntime?:OwnedStripeRuntimeSource|null } = {};
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
      state.stripeRuntime=stripeRuntimeSource(snapshot,input.projectId,input.environment,state.capabilities);
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
    vercel: structuredClone(initial.vercel), capabilities: structuredClone(state.capabilities!),
    stripeRuntime:state.stripeRuntime?structuredClone(state.stripeRuntime):null,isCurrent };
}
