export type EditorIntegrationCategory = 'analytics' | 'payments' | 'email' | 'crm' | 'api' | 'webhook';
export type EditorIntegrationStatus = 'disconnected' | 'configured' | 'active' | 'error' | 'disabled';
export type EditorIntegrationEnvironment = 'preview' | 'staging' | 'production';
export type EditorIntegrationEvent = 'form.submitted' | 'site.published' | 'site.unpublished' | 'commerce.checkout' | 'commerce.paid' | 'contact.created' | 'page.viewed' | 'custom';

export interface EditorIntegrationFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'url' | 'secret' | 'select' | 'boolean';
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface EditorIntegrationProviderDefinition {
  id: string;
  name: string;
  category: EditorIntegrationCategory;
  description: string;
  capabilities: string[];
  fields: EditorIntegrationFieldDefinition[];
  supportedEvents?: EditorIntegrationEvent[];
}

export interface EditorIntegrationSecretRef {
  ref: string;
  updatedAt?: string;
}

export interface EditorIntegrationConnection {
  id: string;
  providerId: string;
  name: string;
  enabled: boolean;
  status: EditorIntegrationStatus;
  environments: EditorIntegrationEnvironment[];
  config: Record<string, string | boolean>;
  secrets: Record<string, EditorIntegrationSecretRef>;
  events?: EditorIntegrationEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface EditorIntegrationsConfig {
  version: 1;
  connections: EditorIntegrationConnection[];
}

export interface EditorIntegrationValidationIssue {
  connectionId?: string;
  field?: string;
  code: 'unknown-provider' | 'missing-field' | 'missing-secret' | 'invalid-url' | 'unsupported-event' | 'duplicate-id';
  message: string;
}

export const EDITOR_INTEGRATION_PROVIDERS: EditorIntegrationProviderDefinition[] = [
  { id: 'google-analytics', name: 'Google Analytics', category: 'analytics', description: 'Measure traffic and page events.', capabilities: ['pageviews', 'events'], fields: [{ key: 'measurementId', label: 'Measurement ID', type: 'text', required: true, placeholder: 'G-XXXXXXXXXX' }] },
  { id: 'plausible', name: 'Plausible', category: 'analytics', description: 'Privacy-focused website analytics.', capabilities: ['pageviews', 'events'], fields: [{ key: 'domain', label: 'Site domain', type: 'text', required: true }] },
  { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Payments and checkout events.', capabilities: ['checkout', 'payment-events'], fields: [{ key: 'publishableKey', label: 'Publishable key', type: 'text', required: true }, { key: 'secretKey', label: 'Secret key', type: 'secret', required: true, secret: true }], supportedEvents: ['commerce.checkout', 'commerce.paid'] },
  { id: 'resend', name: 'Resend', category: 'email', description: 'Transactional email delivery.', capabilities: ['transactional-email'], fields: [{ key: 'from', label: 'From address', type: 'text', required: true }, { key: 'apiKey', label: 'API key', type: 'secret', required: true, secret: true }], supportedEvents: ['form.submitted', 'contact.created'] },
  { id: 'hubspot', name: 'HubSpot', category: 'crm', description: 'Send leads and contacts to CRM.', capabilities: ['contacts'], fields: [{ key: 'accessToken', label: 'Private app token', type: 'secret', required: true, secret: true }], supportedEvents: ['form.submitted', 'contact.created'] },
  { id: 'http-api', name: 'HTTP API', category: 'api', description: 'Call a custom HTTP endpoint.', capabilities: ['http-request'], fields: [{ key: 'url', label: 'Endpoint URL', type: 'url', required: true }, { key: 'authorization', label: 'Authorization', type: 'secret', secret: true }], supportedEvents: ['form.submitted', 'site.published', 'site.unpublished', 'commerce.checkout', 'commerce.paid', 'contact.created', 'custom'] },
  { id: 'webhook', name: 'Webhook', category: 'webhook', description: 'Deliver signed project events to an external endpoint.', capabilities: ['signed-webhooks'], fields: [{ key: 'url', label: 'Webhook URL', type: 'url', required: true }, { key: 'signingSecret', label: 'Signing secret', type: 'secret', required: true, secret: true }], supportedEvents: ['form.submitted', 'site.published', 'site.unpublished', 'commerce.checkout', 'commerce.paid', 'contact.created', 'custom'] },
];

export function createEditorIntegrationsConfig(): EditorIntegrationsConfig {
  return { version: 1, connections: [] };
}

export function getEditorIntegrationProvider(providerId: string): EditorIntegrationProviderDefinition | undefined {
  return EDITOR_INTEGRATION_PROVIDERS.find(provider => provider.id === providerId);
}

function cleanString(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeEditorIntegrationsConfig(value: unknown): EditorIntegrationsConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createEditorIntegrationsConfig();
  const raw = value as Partial<EditorIntegrationsConfig>;
  const connections = Array.isArray(raw.connections) ? raw.connections : [];
  const normalized: EditorIntegrationConnection[] = [];
  const seen = new Set<string>();
  for (const candidate of connections) {
    if (!candidate || typeof candidate !== 'object') continue;
    const source = candidate as Partial<EditorIntegrationConnection>;
    const id = cleanString(source.id, 120);
    const providerId = cleanString(source.providerId, 120);
    if (!id || seen.has(id) || !getEditorIntegrationProvider(providerId)) continue;
    seen.add(id);
    const config = Object.fromEntries(Object.entries(source.config ?? {}).filter(([, item]) => typeof item === 'string' || typeof item === 'boolean').map(([key, item]) => [key.slice(0, 120), typeof item === 'string' ? item.slice(0, 5000) : item]));
    const secrets = Object.fromEntries(Object.entries(source.secrets ?? {}).filter(([, item]) => !!item && typeof item === 'object' && typeof (item as EditorIntegrationSecretRef).ref === 'string').map(([key, item]) => [key.slice(0, 120), { ref: cleanString((item as EditorIntegrationSecretRef).ref, 500), updatedAt: cleanString((item as EditorIntegrationSecretRef).updatedAt, 80) || undefined }]));
    const environments = Array.from(new Set((source.environments ?? []).filter((item): item is EditorIntegrationEnvironment => item === 'preview' || item === 'staging' || item === 'production')));
    normalized.push({ id, providerId, name: cleanString(source.name, 160) || getEditorIntegrationProvider(providerId)?.name || providerId, enabled: source.enabled !== false, status: source.status === 'active' || source.status === 'error' || source.status === 'disabled' || source.status === 'configured' ? source.status : 'disconnected', environments: environments.length ? environments : ['production'], config, secrets, events: Array.from(new Set((source.events ?? []).filter((event): event is EditorIntegrationEvent => typeof event === 'string'))) as EditorIntegrationEvent[], createdAt: cleanString(source.createdAt, 80) || new Date().toISOString(), updatedAt: cleanString(source.updatedAt, 80) || new Date().toISOString() });
  }
  return { version: 1, connections: normalized };
}

export function validateEditorIntegrations(config: EditorIntegrationsConfig): EditorIntegrationValidationIssue[] {
  const issues: EditorIntegrationValidationIssue[] = [];
  const ids = new Set<string>();
  for (const connection of config.connections) {
    if (ids.has(connection.id)) issues.push({ connectionId: connection.id, code: 'duplicate-id', message: `Duplicate integration id: ${connection.id}` });
    ids.add(connection.id);
    const provider = getEditorIntegrationProvider(connection.providerId);
    if (!provider) { issues.push({ connectionId: connection.id, code: 'unknown-provider', message: `Unknown integration provider: ${connection.providerId}` }); continue; }
    for (const field of provider.fields) {
      if (!field.required) continue;
      if (field.secret) {
        if (!connection.secrets[field.key]?.ref) issues.push({ connectionId: connection.id, field: field.key, code: 'missing-secret', message: `${field.label} is required.` });
      } else if (connection.config[field.key] === undefined || connection.config[field.key] === '') issues.push({ connectionId: connection.id, field: field.key, code: 'missing-field', message: `${field.label} is required.` });
    }
    for (const field of provider.fields.filter(item => item.type === 'url')) {
      const value = connection.config[field.key];
      if (typeof value === 'string' && value) { try { const url = new URL(value); if (url.protocol !== 'https:') throw new Error(); } catch { issues.push({ connectionId: connection.id, field: field.key, code: 'invalid-url', message: `${field.label} must use a valid HTTPS URL.` }); } }
    }
    if (provider.supportedEvents) for (const event of connection.events ?? []) if (!provider.supportedEvents.includes(event)) issues.push({ connectionId: connection.id, code: 'unsupported-event', message: `${provider.name} does not support ${event}.` });
  }
  return issues;
}

export function integrationsForEvent(config: EditorIntegrationsConfig, event: EditorIntegrationEvent, environment: EditorIntegrationEnvironment): EditorIntegrationConnection[] {
  return config.connections.filter(connection => connection.enabled && connection.status !== 'disabled' && connection.environments.includes(environment) && (connection.events?.includes(event) ?? false));
}
