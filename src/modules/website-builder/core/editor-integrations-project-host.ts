import { validateEditorIntegrations, type EditorIntegrationConnection, type EditorIntegrationsConfig } from './editor-integrations';
import { deserializeEditorIntegrations, serializeEditorIntegrations } from './editor-integrations-storage';

export const EDITOR_INTEGRATIONS_PROJECT_KEY = 'integrationsMax';

export interface EditorIntegrationsProjectData {
  [EDITOR_INTEGRATIONS_PROJECT_KEY]?: unknown;
  [key: string]: unknown;
}

export interface EditorIntegrationSecretStore {
  setSecret(input: { connectionId: string; field: string; value: string }): Promise<string>;
}

export function readEditorIntegrationsFromProject(projectData: unknown): EditorIntegrationsConfig {
  if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) return deserializeEditorIntegrations(undefined);
  return deserializeEditorIntegrations((projectData as EditorIntegrationsProjectData)[EDITOR_INTEGRATIONS_PROJECT_KEY]);
}

export function writeEditorIntegrationsToProject(projectData: unknown, config: EditorIntegrationsConfig): EditorIntegrationsProjectData {
  const base = projectData && typeof projectData === 'object' && !Array.isArray(projectData)
    ? { ...(projectData as Record<string, unknown>) }
    : {};
  return { ...base, [EDITOR_INTEGRATIONS_PROJECT_KEY]: serializeEditorIntegrations(config) };
}

export function editorIntegrationPublishBlockers(config: EditorIntegrationsConfig): string[] {
  const productionIds = new Set(config.connections.filter(connection => connection.enabled && connection.environments.includes('production')).map(connection => connection.id));
  return validateEditorIntegrations(config)
    .filter(issue => productionIds.has(issue.connectionId))
    .map(issue => issue.message);
}

export async function setEditorIntegrationSecret(
  config: EditorIntegrationsConfig,
  connectionId: string,
  field: string,
  value: string,
  store: EditorIntegrationSecretStore,
): Promise<EditorIntegrationsConfig> {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Integration secret cannot be empty.');
  const connection = config.connections.find(item => item.id === connectionId);
  if (!connection) throw new Error('Integration connection was not found.');
  const ref = (await store.setSecret({ connectionId, field, value: trimmed })).trim();
  if (!ref) throw new Error('Secret storage did not return a reference.');
  const updated: EditorIntegrationConnection = {
    ...connection,
    secrets: { ...connection.secrets, [field]: { ref, updatedAt: new Date().toISOString() } },
    updatedAt: new Date().toISOString(),
  };
  return { ...config, connections: config.connections.map(item => item.id === connectionId ? updated : item) };
}
