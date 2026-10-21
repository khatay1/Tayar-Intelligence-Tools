import { captureWebsiteGitHubExportSource, type SourceReader } from '../src/modules/website-builder/services/websiteGithubExportSourceService';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';
import { validateOwnedApplicationPublicBackend, type ApplicationPublicBackend } from '../src/modules/website-builder/core/application-data-runtime';
import { analyzeByoSourceCapabilities, type ByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';
import { readEditorIntegrationsFromProject } from '../src/modules/website-builder/core/editor-integrations-project-host';
import { isEditorProjectSecretReferenceFor } from '../src/modules/website-builder/core/editor-integration-security';
import { compileWebsiteOwnedApplicationSource } from './website-owned-source-compiler';
import { bindSavedOwnedEmailNotifications } from './website-owned-email-rules';
import { createOwnedRuntimeSecretPlan } from './website-owned-runtime-secret-plan';

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
export interface OwnedStripeRuntimeSource { sourceConnectionId:string;sourceUpdatedAt:string;publishableKey:string;
  webhookEndpointId?:string;webhookSigningSecretUpdatedAt?:string; }
export interface OwnedEmailRuntimeSource { connections: Array<{ sourceConnectionId:string;sourceUpdatedAt:string;
  connectionUpdatedAt:string;from:string;environmentKey:string }> }
const stripePublishable=/^pk_(test|live)_[A-Za-z0-9]+$/;
export function captureOwnedStripeRuntimeSource(snapshot:Record<string,unknown>,projectId:string,environment:Environment,
  capabilities:ByoSourceCapabilities):OwnedStripeRuntimeSource|null{
  if(!capabilities.integrationProviders.includes('stripe')&&!capabilities.stripeCheckouts.length)return null;
  const active=readEditorIntegrationsFromProject(snapshot).connections.filter(item=>item.enabled&&item.status!=='disabled'
    &&item.providerId==='stripe'&&item.environments.includes(environment));
  if(active.length!==1)throw new Error('Customer Stripe runtime source is unavailable.');
  const selected=active[0],secret=selected.secrets.secretKey;
  const publishableKey=typeof selected.config.publishableKey==='string'?selected.config.publishableKey:'';
  const orderPayments=capabilities.definition.tables.some(table=>Boolean(table.payment));
  const webhookEndpointId=typeof selected.config.webhookEndpointId==='string'?selected.config.webhookEndpointId:'';
  const webhookSecret=selected.secrets.webhookSigningSecret;
  const match=stripePublishable.exec(publishableKey),mode=environment==='production'?'live':'test';
  if(selected.environments.length!==1||selected.environments[0]!==environment||!match||match[1]!==mode||!secret
    ||!isEditorProjectSecretReferenceFor(secret.ref,selected.id,'secretKey',environment)
    ||!secret.ref.startsWith(`secret://website/${projectId}/`)
    ||typeof secret.updatedAt!=='string'||!Number.isFinite(Date.parse(secret.updatedAt)))
    throw new Error('Customer Stripe runtime source is unavailable.');
  if(orderPayments&&(!/^we_[A-Za-z0-9]{8,128}$/.test(webhookEndpointId)||!webhookSecret
    ||!isEditorProjectSecretReferenceFor(webhookSecret.ref,selected.id,'webhookSigningSecret',environment)
    ||!webhookSecret.ref.startsWith(`secret://website/${projectId}/`)
    ||typeof webhookSecret.updatedAt!=='string'||!Number.isFinite(Date.parse(webhookSecret.updatedAt))))
    throw new Error('Customer Stripe webhook source is unavailable.');
  return{sourceConnectionId:selected.id,sourceUpdatedAt:secret.updatedAt,publishableKey,
    ...(orderPayments?{webhookEndpointId,webhookSigningSecretUpdatedAt:webhookSecret!.updatedAt}: {})};
}

export function captureOwnedEmailRuntimeSource(snapshot:Record<string,unknown>,projectId:string,environment:Environment,
  capabilities:ByoSourceCapabilities):OwnedEmailRuntimeSource|null{
  if(!capabilities.definition.tables.some(table=>table.notifications?.length))return null;
  const bound=bindSavedOwnedEmailNotifications({projectId,definition:capabilities.definition,environment,
    integrations:readEditorIntegrationsFromProject(snapshot)});
  if(!bound.rules.length||!bound.connections.length)throw new Error('Customer email runtime source is unavailable.');
  const plan=createOwnedRuntimeSecretPlan({environment,capabilities,
    emailConnections:bound.connections.map(connection=>({id:connection.id,from:connection.from}))});
  return{connections:plan.emailConnections.map(connection=>{
    const source=bound.connections.find(item=>item.id===connection.id);
    if(!source)throw new Error('Customer email runtime source is unavailable.');
    return{sourceConnectionId:source.id,sourceUpdatedAt:source.secretUpdatedAt,
      connectionUpdatedAt:source.connectionUpdatedAt,from:source.from,environmentKey:connection.environmentKey};
  })};
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
  const state: { capabilities?: ByoSourceCapabilities;stripeRuntime?:OwnedStripeRuntimeSource|null;
    emailRuntime?:OwnedEmailRuntimeSource|null } = {};
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
      // This path always compiles the owned order runtime below. Keep its
      // capabilities aligned with that compiler; independent backend, secret
      // and delivery verification still gates publishing and attestation.
      state.capabilities = analyzeByoSourceCapabilities(snapshot, input.environment, { stripeOrderRuntimeCompiled: true });
      state.stripeRuntime=captureOwnedStripeRuntimeSource(snapshot,input.projectId,input.environment,state.capabilities);
      state.emailRuntime=captureOwnedEmailRuntimeSource(snapshot,input.projectId,input.environment,state.capabilities);
      captured.value = await current();
      return compileWebsiteOwnedApplicationSource(snapshot, { projectId: input.projectId,
        applicationOrigin: captured.value.binding.applicationOrigin, expectedProjectRef: captured.value.supabase.targetId!,
        backend: captured.value.binding.backend, environment: input.environment,
        platformOrigin: input.platformOrigin, platformUrl: input.platformUrl });
    },
  });
  if (!captured.value) throw new Error('Customer runtime scope is unavailable.');
  if (source.connection.environment !== input.environment) throw new Error('Customer source environment changed.');
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
    stripeRuntime:state.stripeRuntime?structuredClone(state.stripeRuntime):null,
    emailRuntime:state.emailRuntime?structuredClone(state.emailRuntime):null,isCurrent };
}

/** Compile distinct Production source from the same saved specification as
 * the verified Preview, with separate database and environment connections.
 * Reuses the current compiler/scope verifier. This does not deploy or activate. */
export async function captureWebsiteOwnedProductionSource(input:
  Omit<Parameters<typeof captureWebsiteOwnedApplicationSource>[0], 'environment' | 'githubConnectionId'> & {
    previewGithubConnectionId: string;
    productionGithubConnectionId: string;
    expectedPreviewSourceDigest: string;
  }) {
  if (typeof window !== 'undefined' || !/^[a-f0-9]{64}$/.test(input.expectedPreviewSourceDigest)
    || input.previewGithubConnectionId === input.productionGithubConnectionId) throw new Error('Production source preparation is unavailable.');
  try {
    const preview = await captureWebsiteOwnedApplicationSource({ ...input, environment: 'preview', githubConnectionId: input.previewGithubConnectionId });
    if (preview.sourceDigest !== input.expectedPreviewSourceDigest) throw new Error();
    const production = await captureWebsiteOwnedApplicationSource({ ...input, environment: 'production', githubConnectionId: input.productionGithubConnectionId });
    if (production.snapshotDigest !== preview.snapshotDigest || production.sourceDigest === preview.sourceDigest
      || production.supabase.id === preview.supabase.id || production.binding.backend.projectRef === preview.binding.backend.projectRef
      || production.vercel.id === preview.vercel.id || production.vercel.targetId !== preview.vercel.targetId
      || production.vercel.accountId !== preview.vercel.accountId
      || production.connection.targetId !== preview.connection.targetId || production.connection.accountId !== preview.connection.accountId
      || production.binding.applicationOrigin !== preview.binding.applicationOrigin) throw new Error();
    const isCurrent = async () => await preview.isCurrent() && await production.isCurrent();
    if (!await isCurrent()) throw new Error();
    return { ...production, previewSourceDigest: preview.sourceDigest, isCurrent };
  } catch { throw new Error('Production source preparation is unavailable.'); }
}
