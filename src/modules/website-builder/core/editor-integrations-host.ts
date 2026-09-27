import {
  getEditorIntegrationProvider,
  normalizeEditorIntegrationsConfig,
  validateEditorIntegrations,
  type EditorIntegrationConnection,
  type EditorIntegrationsConfig,
} from './editor-integrations';
import {
  serializeEditorIntegrations,
  upsertEditorIntegration,
} from './editor-integrations-storage';
import { readEditorIntegrationsFromProject as readPersistedIntegrations, writeEditorIntegrationsToProject as writePersistedIntegrations } from './editor-integrations-project-host';
import { isEditorSecretReference } from './editor-integration-security';

export interface EditorIntegrationsProjectData {
  integrations?: unknown;
}

export interface EditorIntegrationSecretWriter {
  setSecret(connectionId: string, field: string, value: string): Promise<{ ref: string; updatedAt?: string }>;
}

export function readEditorIntegrationsFromProject(project: EditorIntegrationsProjectData | null | undefined): EditorIntegrationsConfig {
  return readPersistedIntegrations(project);
}

export function writeEditorIntegrationsToProject<T extends EditorIntegrationsProjectData>(project: T, config: EditorIntegrationsConfig): T {
  return { ...writePersistedIntegrations(project, config), integrations: serializeEditorIntegrations(config) } as T;
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
  if (!getEditorIntegrationProvider(connection.providerId)?.fields.some(item => item.key === field && item.secret)) throw new Error('Unknown integration secret field.');
  const secret = value.trim();
  if (!secret) return config;
  const stored = await writer.setSecret(connectionId, field, secret);
  if (!isEditorSecretReference(stored.ref)) throw new Error('Secret storage did not return a valid reference.');
  const next: EditorIntegrationConnection = {
    ...connection,
    secrets: { ...connection.secrets, [field]: { ref: stored.ref, updatedAt: stored.updatedAt ?? new Date().toISOString() } },
    updatedAt: new Date().toISOString(),
  };
  return upsertEditorIntegration(normalizeEditorIntegrationsConfig(config), next);
}
