import { EDITOR_INTEGRATION_PROVIDERS, getEditorIntegrationProvider, normalizeEditorIntegrationsConfig, validateEditorIntegrations, type EditorIntegrationsConfig, type EditorIntegrationEnvironment } from './editor-integrations';

export type APICapabilityCategory = 'agents-mcp' | 'developer-tools' | 'business' | 'ecommerce' | 'payments-invoicing' | 'booking' | 'maps' | 'education' | 'healthcare' | 'crm-erp' | 'real-estate' | 'logistics' | 'automation' | 'notifications' | 'analytics-seo';
export interface APICapability {
  id: string;
  name: string;
  category: APICapabilityCategory;
  providerId: string;
  source: string;
  authentication: 'none' | 'api-key' | 'oauth' | 'signed-webhook' | 'deployment';
  protocols: Array<'rest' | 'webhook' | 'oauth' | 'mcp'>;
  cost: 'local' | 'plan-dependent' | 'unknown';
  terms: { status: 'local-code' | 'review-required'; url?: string };
  usageLimits: { status: 'deployment-dependent' | 'account-dependent' | 'unknown'; documentation?: string };
  reliability: 'unmeasured';
  testStatus: 'isolated-existing-adapter' | 'metadata-only';
  requiredPermissions: string[];
  alternatives: string[];
  projectCompatibility: 'schema-supported-projects' | 'requires-provider-review';
  adapter: { kind: 'internal' | 'existing'; reference: string };
}

const internal = (id: string, name: string, category: APICapabilityCategory, reference: string): APICapability => ({
  id, name, category, providerId: 'tayar', source: reference, authentication: 'deployment', protocols: [], cost: 'local',
  terms: { status: 'local-code' }, usageLimits: { status: 'deployment-dependent' }, reliability: 'unmeasured',
  testStatus: 'isolated-existing-adapter', requiredPermissions: ['existing-application-authorization'], alternatives: [],
  projectCompatibility: 'schema-supported-projects', adapter: { kind: 'internal', reference },
});
const externalMetadata: Record<string, { source: string; terms?: string; limits?: string; auth: APICapability['authentication']; category: APICapabilityCategory }> = {
  'google-analytics': { source: 'https://developers.google.com/analytics', terms: 'https://marketingplatform.google.com/about/analytics/terms/us/', auth: 'none', category: 'analytics-seo' },
  plausible: { source: 'https://plausible.io/docs', terms: 'https://plausible.io/terms', auth: 'none', category: 'analytics-seo' },
  stripe: { source: 'https://docs.stripe.com/api', terms: 'https://stripe.com/legal/ssa', limits: 'https://docs.stripe.com/rate-limits', auth: 'api-key', category: 'payments-invoicing' },
  resend: { source: 'https://resend.com/docs', terms: 'https://resend.com/legal/terms-of-service', limits: 'https://resend.com/docs/api-reference/rate-limit', auth: 'api-key', category: 'notifications' },
  hubspot: { source: 'https://developers.hubspot.com/docs', terms: 'https://legal.hubspot.com/api-terms', auth: 'api-key', category: 'crm-erp' },
  'http-api': { source: 'src/modules/website-builder/core/editor-integration-runtime.ts', auth: 'api-key', category: 'developer-tools' },
  webhook: { source: 'src/modules/website-builder/core/editor-integration-runtime.ts', auth: 'signed-webhook', category: 'automation' },
};

/** A view over the existing adapters, never a second executable provider registry.
 * External documentation links are review targets, not approval or live evidence.
 * Directory entries never become runtime-authorized capabilities by import. */
export function getUniversalAPICapabilities(): APICapability[] {
  return [
    internal('records', 'Authorized records and CRM data', 'business', 'src/modules/website-builder/core/application-data-runtime.ts'),
    internal('auth', 'Application sign-in and access policies', 'developer-tools', 'src/modules/website-builder/core/application-access-policy.ts'),
    internal('booking', 'Resource booking and scheduling', 'booking', 'src/modules/website-builder/core/application-booking.ts'),
    internal('counter', 'Inventory counters', 'ecommerce', 'src/modules/website-builder/core/application-counter.ts'),
    internal('transaction', 'Atomic business transactions', 'ecommerce', 'src/modules/website-builder/core/application-transaction.ts'),
    internal('workflow', 'Authorized workflow transitions', 'automation', 'src/modules/website-builder/core/application-workflow.ts'),
    internal('reports', 'Application reports', 'analytics-seo', 'src/modules/website-builder/core/application-reports.ts'),
    ...EDITOR_INTEGRATION_PROVIDERS.flatMap(provider => {
      const meta = externalMetadata[provider.id];
      if (!meta) return []; // New/unreviewed adapter metadata does not gain implicit approval.
      return provider.capabilities.map(capability => ({
        id: `${provider.id}:${capability}`, name: `${provider.name}: ${capability}`, category: meta.category,
        providerId: provider.id, source: meta.source, authentication: meta.auth,
        protocols: ['google-analytics', 'plausible'].includes(provider.id) ? [] : [provider.id === 'webhook' ? 'webhook' : 'rest'] as APICapability['protocols'],
        cost: 'plan-dependent' as const, terms: { status: 'review-required' as const, url: meta.terms },
        usageLimits: { status: 'account-dependent' as const, documentation: meta.limits }, reliability: 'unmeasured' as const,
        testStatus: ['http-api', 'webhook', 'stripe', 'resend'].includes(provider.id) ? 'isolated-existing-adapter' as const : 'metadata-only' as const,
        requiredPermissions: provider.fields.filter(field => field.secret).map(field => `server-secret:${field.key}`),
        alternatives: EDITOR_INTEGRATION_PROVIDERS.filter(other => other.id !== provider.id && other.capabilities.includes(capability)).map(other => `${other.id}:${capability}`),
        projectCompatibility: 'requires-provider-review' as const,
        adapter: { kind: 'existing' as const, reference: 'src/modules/website-builder/core/editor-integration-runtime.ts' },
      }));
    }),
  ];
}

export interface UniversalIntegrationRequirement { id: string; capabilityIds: string[]; }
export interface UniversalIntegrationDecision {
  requirementId: string;
  status: 'reuse-internal' | 'prepare-existing-adapter' | 'unsupported';
  capabilityId?: string;
  connectionIds: string[];
  activation: 'deferred';
  blockers: string[];
}

/** Planning only. A selection never authorizes dispatch, transmits customer data,
 * imports remote code, or supplies a successful provider-test attestation. */
export function planUniversalIntegrations(requirements: UniversalIntegrationRequirement[], config: EditorIntegrationsConfig,
  environment: EditorIntegrationEnvironment = 'preview'): UniversalIntegrationDecision[] {
  if (requirements.length > 100) throw new Error('Integration requirements exceed planning limit.');
  const capabilities = getUniversalAPICapabilities();
  return requirements.map(requirement => {
    const matches = capabilities.filter(item => requirement.capabilityIds.includes(item.id));
    const selected = matches.find(item => item.adapter.kind === 'internal') ?? matches.find(item => config.connections.some(connection =>
      connection.providerId === item.providerId && connection.enabled && connection.status !== 'disabled' && connection.environments.includes(environment))) ?? matches[0];
    if (!selected) return { requirementId: requirement.id, status: 'unsupported', connectionIds: [], activation: 'deferred', blockers: ['No reviewed capability matches this requirement. A directory listing is not an implementation.'] };
    if (selected.adapter.kind === 'internal') return { requirementId: requirement.id, status: 'reuse-internal', capabilityId: selected.id, connectionIds: [], activation: 'deferred', blockers: ['Generate and validate the project schema, permissions and acceptance criteria before delivery.'] };
    const connectionIds = config.connections.filter(connection => connection.providerId === selected.providerId && connection.enabled && connection.status !== 'disabled' && connection.environments.includes(environment)).map(connection => connection.id);
    return { requirementId: requirement.id, status: 'prepare-existing-adapter', capabilityId: selected.id, connectionIds, activation: 'deferred', blockers: [
      'Review provider terms, data disclosure, scopes, current cost and account-specific limits.',
      ...(!connectionIds.length ? ['Configure the existing connection using server-managed secrets.'] : []),
      'Verify the server adapter and provider behavior for this project and environment; configuration is not live evidence.',
    ] };
  });
}

/** Credential-free model context. Status labels do not infer that an enabled
 * connection works; all external activation remains deferred in specifications. */
export function universalAPIGenerationContext(config: EditorIntegrationsConfig) {
  return {
    policy: 'Reuse internal capabilities first. External capabilities are deferred plans only; never claim connected, approved or tested from metadata. Unknown needs remain unsupported. REST/webhook adapters reuse the existing runtime. OAuth/MCP require a separately reviewed server adapter; never run discovered code.',
    capabilities: getUniversalAPICapabilities().map(({ id, name, category, providerId, authentication, protocols, testStatus, adapter }) => ({ id, name, category, providerId, authentication, protocols, testStatus, adapter: adapter.kind })),
    connections: config.connections.filter(connection => connection.enabled && connection.status !== 'disabled').map(connection => ({ id: connection.id, providerId: connection.providerId, environments: connection.environments, status: connection.status, activation: 'deferred' as const })),
  };
}

/** Produce a disabled native adapter draft, not downloaded/generated executable
 * code. Credentials must subsequently use the existing project Vault workflow. */
export function prepareUniversalIntegrationDraft(capabilityId: string, connectionId: string,
  environment: EditorIntegrationEnvironment, publicConfig: Record<string, string | boolean> = {}) {
  const capability = getUniversalAPICapabilities().find(item => item.id === capabilityId && item.adapter.kind === 'existing');
  if (!capability || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(connectionId)
    || !['preview', 'staging', 'production'].includes(environment)) throw new Error('Unsupported integration draft.');
  const provider = getEditorIntegrationProvider(capability.providerId)!;
  if (Object.keys(publicConfig).some(key => !provider.fields.some(field => field.key === key && !field.secret))) {
    throw new Error('Only registered public fields belong in an integration draft. Store credentials separately.');
  }
  const config = normalizeEditorIntegrationsConfig({ version: 1, connections: [{
    id: connectionId, providerId: provider.id, name: provider.name, enabled: false, status: 'disconnected',
    environments: [environment], config: publicConfig, secrets: {}, events: [],
  }] });
  return { capabilityId, adapter: capability.adapter, config,
    requiredSetup: provider.fields.filter(field => field.required).map(field => ({ field: field.key, secret: field.secret === true })),
    issues: validateEditorIntegrations(config), activation: 'deferred' as const, providerTest: 'not-run' as const };
}

export interface PreparedUniversalProjectIntegration {
  capabilityId: string;
  connectionId: string;
  config: EditorIntegrationsConfig;
  reused: boolean;
  activation: 'deferred';
  providerTest: 'not-run';
}

/** Adds a disabled adapter draft to a project configuration, or points to the
 * project's existing provider connection. It never enables a connection,
 * copies credentials, or treats configuration as provider verification. */
export function prepareUniversalProjectIntegration(config: EditorIntegrationsConfig, capabilityId: string,
  connectionId: string, environment: EditorIntegrationEnvironment = 'preview'): PreparedUniversalProjectIntegration {
  const normalized = normalizeEditorIntegrationsConfig(config);
  const capability = getUniversalAPICapabilities().find(item => item.id === capabilityId);
  if (!capability || capability.adapter.kind !== 'existing') throw new Error('This capability does not require a provider adapter draft.');
  const existing = normalized.connections.find(connection => connection.providerId === capability.providerId);
  if (existing) return { capabilityId, connectionId: existing.id, config: normalized, reused: true, activation: 'deferred', providerTest: 'not-run' };
  if (normalized.connections.some(connection => connection.id === connectionId)) throw new Error('Integration ID is already in use.');
  const draft = prepareUniversalIntegrationDraft(capabilityId, connectionId, environment);
  return {
    capabilityId,
    connectionId,
    config: { ...normalized, connections: [...normalized.connections, ...draft.config.connections] },
    reused: false,
    activation: 'deferred',
    providerTest: 'not-run',
  };
}
