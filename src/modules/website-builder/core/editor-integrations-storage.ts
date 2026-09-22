import {
  createEditorIntegrationsConfig,
  normalizeEditorIntegrationsConfig,
  type EditorIntegrationConnection,
  type EditorIntegrationsConfig,
} from './editor-integrations';

export const EDITOR_INTEGRATIONS_SCHEMA_VERSION = 1;

export interface EditorIntegrationsEnvelope {
  version: number;
  config: EditorIntegrationsConfig;
}

export function serializeEditorIntegrations(config: EditorIntegrationsConfig): EditorIntegrationsEnvelope {
  return { version: EDITOR_INTEGRATIONS_SCHEMA_VERSION, config: normalizeEditorIntegrationsConfig(config) };
}

export function deserializeEditorIntegrations(value: unknown): EditorIntegrationsConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createEditorIntegrationsConfig();
  if ('config' in value) return normalizeEditorIntegrationsConfig((value as Partial<EditorIntegrationsEnvelope>).config);
  return normalizeEditorIntegrationsConfig(value);
}

export function upsertEditorIntegration(config: EditorIntegrationsConfig, connection: EditorIntegrationConnection): EditorIntegrationsConfig {
  const connections = config.connections.some(item => item.id === connection.id)
    ? config.connections.map(item => item.id === connection.id ? { ...connection, updatedAt: new Date().toISOString() } : item)
    : [...config.connections, connection];
  return normalizeEditorIntegrationsConfig({ version: 1, connections });
}

export function removeEditorIntegration(config: EditorIntegrationsConfig, connectionId: string): EditorIntegrationsConfig {
  return { version: 1, connections: config.connections.filter(item => item.id !== connectionId) };
}

export function redactEditorIntegrationSecrets(config: EditorIntegrationsConfig): EditorIntegrationsConfig {
  return {
    version: 1,
    connections: config.connections.map(connection => ({
      ...connection,
      secrets: Object.fromEntries(Object.entries(connection.secrets).map(([key, value]) => [key, { ref: value.ref ? 'secret://redacted' : '', updatedAt: value.updatedAt }])),
    })),
  };
}
