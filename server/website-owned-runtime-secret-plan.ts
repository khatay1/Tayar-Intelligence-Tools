import type { ByoSourceCapabilities } from '../src/modules/website-builder/core/application-byo-source-capabilities';

export type OwnedRuntimeEnvironment = 'preview' | 'production';
export interface OwnedRuntimeSecretRequirement {
  key: string;
  service: 'supabase' | 'stripe' | 'resend' | 'vercel';
  exposure: 'public-runtime-config' | 'server-secret';
  purpose: string;
  sourceConnectionId?: string;
}
export interface OwnedRuntimeEmailConnectionPlan {
  id: string;
  from: string;
  environmentKey: string;
}
export interface OwnedRuntimeSecretPlan {
  version: 1;
  environment: OwnedRuntimeEnvironment;
  requirements: OwnedRuntimeSecretRequirement[];
  emailConnections: OwnedRuntimeEmailConnectionPlan[];
}

/** Values never enter this artifact. It is the deterministic checklist used by
 * final credential handoff and by the generated runtime to locate server-only
 * environment variables. */
export function createOwnedRuntimeSecretPlan(input: {
  environment: OwnedRuntimeEnvironment;
  capabilities: ByoSourceCapabilities;
  emailConnections?: readonly { id: string; from: string }[];
}): OwnedRuntimeSecretPlan {
  if (!['preview', 'production'].includes(input.environment)) throw new Error('Runtime secret plan unavailable.');
  const connections = [...(input.emailConnections ?? [])].sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(connections.map(item => item.id)).size !== connections.length || connections.length > 10
    || connections.some(item => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(item.id)
      || typeof item.from !== 'string' || item.from.length > 254)) throw new Error('Runtime secret plan unavailable.');
  const emailConnections = connections.map((connection, index) => ({ ...connection,
    environmentKey: `TAYAR_RESEND_${String(index + 1).padStart(2, '0')}_API_KEY` }));
  const requirements: OwnedRuntimeSecretRequirement[] = [
    { key: 'SUPABASE_URL', service: 'supabase', exposure: 'public-runtime-config', purpose: 'Customer application API origin.' },
    { key: 'SUPABASE_ANON_KEY', service: 'supabase', exposure: 'public-runtime-config', purpose: 'Customer browser publishable key.' },
  ];
  const orderPayments=input.capabilities.definition?.tables.some(table=>table.payment)??false;
  if (orderPayments||input.capabilities.integrationProviders.includes('stripe') || input.capabilities.stripeCheckouts.length) {
    requirements.push({ key: 'STRIPE_SECRET_KEY', service: 'stripe', exposure: 'server-secret', purpose: 'Creates customer-owned Stripe Checkout sessions.' });
  }
  if(orderPayments)requirements.push({key:'STRIPE_WEBHOOK_SECRET',service:'stripe',exposure:'server-secret',purpose:'Verifies customer-owned order payment and refund events.'});
  if (emailConnections.length||orderPayments) {
    requirements.push(
      { key: 'SUPABASE_SECRET_KEY', service: 'supabase', exposure: 'server-secret', purpose: 'Runs private customer email or payment RPCs.' });
  }
  if (emailConnections.length) {
    requirements.push(
      { key: 'CRON_SECRET', service: 'vercel', exposure: 'server-secret', purpose: 'Authenticates the scheduled email worker.' },
      ...emailConnections.map(connection => ({ key: connection.environmentKey, service: 'resend' as const,
        exposure: 'server-secret' as const, purpose: `Sends saved notifications for ${connection.id}.`, sourceConnectionId: connection.id })),
    );
  }
  if (new Set(requirements.map(item => item.key)).size !== requirements.length) throw new Error('Runtime secret plan unavailable.');
  return { version: 1, environment: input.environment, requirements, emailConnections };
}

export function readOwnedRuntimeEnvironment(plan: OwnedRuntimeSecretPlan, environment: NodeJS.ProcessEnv = process.env) {
  const result: Record<string, string> = {};
  for (const requirement of plan.requirements) {
    const value = environment[requirement.key];
    if (typeof value !== 'string' || !value || value.length > 4096 || /[\r\n]/.test(value)) {
      throw new Error(`Missing runtime environment: ${requirement.key}`);
    }
    result[requirement.key] = value;
  }
  return result;
}
