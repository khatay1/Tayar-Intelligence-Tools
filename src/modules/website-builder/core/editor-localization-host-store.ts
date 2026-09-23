import {
  createEditorLocalizationConfig,
  type EditorLocalizationConfig,
} from './editor-localization';

let currentConfig: EditorLocalizationConfig = createEditorLocalizationConfig();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function isLocalizationConfig(value: unknown): value is EditorLocalizationConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Partial<EditorLocalizationConfig>;
  return typeof config.defaultLocale === 'string'
    && Array.isArray(config.locales)
    && !!config.pageContent
    && typeof config.pageContent === 'object'
    && !Array.isArray(config.pageContent);
}

export function getEditorLocalizationHostConfig(): EditorLocalizationConfig {
  return currentConfig;
}

export function setEditorLocalizationHostConfig(config: EditorLocalizationConfig): void {
  currentConfig = config;
  emit();
}

export function subscribeEditorLocalizationHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateEditorLocalizationHost(value: unknown): EditorLocalizationConfig {
  currentConfig = isLocalizationConfig(value) ? value : createEditorLocalizationConfig();
  emit();
  return currentConfig;
}
