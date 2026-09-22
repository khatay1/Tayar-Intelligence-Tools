import {
  createEditorIntegrationsConfig,
  normalizeEditorIntegrationsConfig,
  type EditorIntegrationsConfig,
} from './editor-integrations';
import {
  readEditorIntegrationsFromProject,
  writeEditorIntegrationsToProject,
} from './editor-integrations-project-host';

let currentConfig: EditorIntegrationsConfig = createEditorIntegrationsConfig();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getEditorIntegrationsHostConfig(): EditorIntegrationsConfig {
  return currentConfig;
}

export function setEditorIntegrationsHostConfig(config: EditorIntegrationsConfig): void {
  currentConfig = normalizeEditorIntegrationsConfig(config);
  emit();
}

export function subscribeEditorIntegrationsHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateEditorIntegrationsHostFromProject(project: unknown): EditorIntegrationsConfig {
  currentConfig = readEditorIntegrationsFromProject(project);
  emit();
  return currentConfig;
}

export function embedEditorIntegrationsHostIntoProject(project: unknown): Record<string, unknown> {
  return writeEditorIntegrationsToProject(project, currentConfig);
}
