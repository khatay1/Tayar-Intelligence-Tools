import { readApplicationDefinition } from './application-validation';
import { readEditorIntegrationsFromProject } from './editor-integrations-project-host';
import { validateEditorIntegrations } from './editor-integrations';
import { assertInfrastructureConnection, type InfrastructureConnection,
  type InfrastructureEnvironment, type InfrastructureProvider, type InfrastructureStatus } from './application-infrastructure-connections';

export interface ByoRequirement {
  provider: InfrastructureProvider;
  required: boolean;
  reason: string;
  status: InfrastructureStatus | 'unavailable';
  action: 'none' | 'connect' | 'repair' | 'verify';
}
export interface ByoReadinessReport {
  ready: boolean;
  needs: { database: boolean; auth: boolean; serverRuntime: boolean; protectedPages: boolean;
    forms: boolean; integrations: string[] };
  requirements: ByoRequirement[];
  blockers: string[];
}

/** The provider records must be owner-scoped results of the private registry.
 * Capability proof from Supabase/Vercel and a complete source compiler remain
 * separate gates; this report never treats "connected" as deployment success. */
export function analyzeByoPublishReadiness(input: {
  snapshot: Record<string, unknown>;
  projectId: string;
  ownerId: string;
  environment: InfrastructureEnvironment;
  connections: InfrastructureConnection[];
  runtimeSourceVerified: boolean;
}): ByoReadinessReport {
  const { snapshot, projectId, ownerId, environment } = input;
  if (!['preview', 'production'].includes(environment) || !snapshot || Array.isArray(snapshot)
    || !Array.isArray(snapshot.pages) || !snapshot.pages.length || snapshot.pages.length > 100
    || !Array.isArray(input.connections)) throw new Error('BYO project readiness is unavailable.');
  const pageIds = new Set<string>();
  let forms = false;
  for (const page of snapshot.pages) {
    if (!page || typeof page !== 'object' || typeof page.id !== 'string' || !page.id
      || pageIds.has(page.id) || !Array.isArray(page.sections) || page.sections.length > 100) {
      throw new Error('BYO project readiness is unavailable.');
    }
    pageIds.add(page.id);
    forms ||= page.sections.some((section: unknown) => !!section && typeof section === 'object'
      && 'applicationFormBinding' in section);
  }
  const definition = readApplicationDefinition(snapshot.application, pageIds);
  const integrations = readEditorIntegrationsFromProject(snapshot).connections.filter(connection =>
    connection.enabled && connection.environments.includes(environment));
  const integrationConfig = readEditorIntegrationsFromProject(snapshot);
  const issues = validateEditorIntegrations(integrationConfig).filter(issue =>
    !issue.connectionId || integrations.some(connection => connection.id === issue.connectionId));
  const protectedPages = definition.pageAccess.some(rule => rule.access !== 'public');
  const auth = definition.auth.enabled || protectedPages || definition.roles.length > 0;
  const database = definition.tables.length > 0 || forms || auth;
  const serverRuntime = protectedPages || integrations.length > 0;
  const providers: Array<{ provider: InfrastructureProvider; required: boolean; reason: string }> = [
    { provider: 'github', required: true, reason: 'The customer owns the exported source repository.' },
    { provider: 'supabase', required: database, reason: 'The application uses database, Auth, roles or bound forms.' },
    { provider: 'vercel', required: true, reason: 'The customer owns hosting and server runtime.' },
    { provider: 'stripe', required: integrations.some(item => item.providerId === 'stripe'), reason: 'Stripe runs under the customer account.' },
    { provider: 'external', required: integrations.some(item => item.providerId !== 'stripe'), reason: 'External integrations require user-owned credentials and destination verification.' },
  ];
  const blockers = issues.map(issue => `Integration configuration: ${issue.message}`);
  const requirements = providers.map(({ provider, required, reason }): ByoRequirement => {
    const candidates = input.connections.filter(connection => connection.provider === provider
      && connection.ownerId === ownerId && connection.projectId === projectId && connection.environment === environment);
    if (candidates.length > 1) throw new Error('BYO connection identity is ambiguous.');
    const connection = candidates[0];
    if (connection) assertInfrastructureConnection(connection);
    const status = connection?.status ?? 'unavailable';
    // External integrations need a provider-specific destination/secret handoff.
    // One generic registry record cannot prove readiness for multiple adapters.
    const adapterUnverified = provider === 'external' && required;
    const action = !required ? 'none' : !connection || status === 'disconnected' ? 'connect'
      : status === 'connected' ? 'verify' : status === 'ready' && !adapterUnverified ? 'none' : 'repair';
    if (required && (status !== 'ready' || adapterUnverified)) blockers.push(`${provider}: ${action}.`);
    return { provider, required, reason, status, action };
  });
  if (!input.runtimeSourceVerified) blockers.push('A customer-owned application runtime source bundle has not been verified.');
  return { ready: blockers.length === 0, needs: { database, auth, serverRuntime, protectedPages, forms,
    integrations: integrations.map(item => item.providerId) }, requirements, blockers };
}
