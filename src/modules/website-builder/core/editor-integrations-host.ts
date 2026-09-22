import {
  createEditorIntegrationsConfig,
  normalizeEditorIntegrationsConfig,
  validateEditorIntegrations,
  type EditorIntegrationConnection,
  type EditorIntegrationsConfig,
} from './editor-integrations';
import {
  deserializeEditorIntegrations,
  serializeEditorIntegrations,
  upsertEditorIntegration,
} from './editor-integrations-storage';

export interface EditorIntegrationsProjectData {
  integrations?: unknown;
}

export interface EditorIntegrationSecretWriter {
  setSecret(connectionId: string, field: string, value: string): Promise<{ ref: string; updatedAt?: string }>;
}

export function readEditorIntegrationsFromProject(project: EditorIntegrationsProjectData | null | undefined): EditorIntegrationsConfig {
  return project?.integrations ? deserializeEditorIntegrations(project.integrations) : createEditorIntegrationsConfig();
}

export function writeEditorIntegrationsToProject<T extends EditorIntegrationsProjectData>(project: T, config: EditorIntegrationsConfig): T {
  return { ...project, integrations: serializeEditorIntegrations(config) };
}

export function integrationPublishBlockers(config: EditorIntegrationsConfig): string[] {
  return validateEditorIntegrations(config)
    .filter(issue => {
      const connection = config.connections.find(item => item.id === issue.connectionId);
      return connection?.enabled && connection.environments.includes('production');
    })
    .map(issue => issue.message);
}

export async function setEditorIntegrationSecret(
  config: EditorIntegrationsConfig,
  connectionId: string,
  field: string,
  value: string,
  writer: EditorIntegrationSecretWriter,
): Promise<EditorIntegrationsConfig> {
  const connection = config.connections.find(item => item.id === connectionId);
  if (!connection) throw new Error('Integration connection not found.');
  const secret = value.trim();
  if (!secret) return config;
  const stored = await writer.setSecret(connectionId, field, secret);
  if (!stored.ref) throw new Error('Secret storage did not return a reference.');
  const next: EditorIntegrationConnection = {
    ...connection,
    secrets: { ...connection.secrets, [field]: { ref: stored.ref, updatedAt: stored.updatedAt ?? new Date().toISOString() } },
    updatedAt: new Date().toISOString(),
  };
  return upsertEditorIntegration(normalizeEditorIntegrationsConfig(config), next);
}
