import { getEditorIntegrationProvider, validateEditorIntegrations, type EditorIntegrationConnection, type EditorIntegrationsConfig } from './editor-integrations';
import { deserializeEditorIntegrations, serializeEditorIntegrations } from './editor-integrations-storage';
import { isEditorSecretReference } from './editor-integration-security';

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
  const project = projectData as EditorIntegrationsProjectData;
  const maxState = project.maxState && typeof project.maxState === 'object' && !Array.isArray(project.maxState)
    ? project.maxState as Record<string, unknown> : {};
  return deserializeEditorIntegrations(maxState.integrations ?? project[EDITOR_INTEGRATIONS_PROJECT_KEY] ?? project.integrations ?? project.integrationsConfig);
}

export function writeEditorIntegrationsToProject(projectData: unknown, config: EditorIntegrationsConfig): EditorIntegrationsProjectData {
  const base = projectData && typeof projectData === 'object' && !Array.isArray(projectData)
    ? { ...(projectData as Record<string, unknown>) }
    : {};
  const serialized = serializeEditorIntegrations(config);
  const maxState = base.maxState && typeof base.maxState === 'object' && !Array.isArray(base.maxState)
    ? base.maxState as Record<string, unknown> : {};
  return {
    ...base,
    ...('integrations' in base ? { integrations: serialized } : {}),
    ...('integrationsConfig' in base ? { integrationsConfig: serialized } : {}),
    [EDITOR_INTEGRATIONS_PROJECT_KEY]: serialized,
    maxState: { ...maxState, version: maxState.version ?? 1, integrations: serialized },
  };
}

export function editorIntegrationPublishBlockers(config: EditorIntegrationsConfig): string[] {
  const productionIds = new Set(config.connections.filter(connection => connection.enabled && connection.environments.includes('production')).map(connection => connection.id));
  return validateEditorIntegrations(config)
    .filter(issue => typeof issue.connectionId === 'string' && productionIds.has(issue.connectionId))
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
  if (!getEditorIntegrationProvider(connection.providerId)?.fields.some(item => item.key === field && item.secret)) throw new Error('Unknown integration secret field.');
  const ref = (await store.setSecret({ connectionId, field, value: trimmed })).trim();
  if (!isEditorSecretReference(ref)) throw new Error('Secret storage did not return a valid reference.');
  const updated: EditorIntegrationConnection = {
    ...connection,
    secrets: { ...connection.secrets, [field]: { ref, updatedAt: new Date().toISOString() } },
    updatedAt: new Date().toISOString(),
  };
  return { ...config, connections: config.connections.map(item => item.id === connectionId ? updated : item) };
}
