import {
  embedEditorIntegrationsHostIntoProject,
  hydrateEditorIntegrationsHostFromProject,
} from './editor-integrations-host-store';

export const EDITOR_MAX_STATE_KEY = 'maxState' as const;
export const EDITOR_MAX_STATE_VERSION = 1 as const;

export interface EditorMaxProjectState {
  version: typeof EDITOR_MAX_STATE_VERSION;
  cms?: unknown;
  localization?: unknown;
  publishing?: unknown;
  forms?: unknown;
  designSystem?: unknown;
  collaboration?: unknown;
  integrations?: unknown;
}

type ProjectRecord = Record<string, unknown>;

function asRecord(value: unknown): ProjectRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ProjectRecord
    : null;
}

function readLegacyState(project: ProjectRecord): Omit<EditorMaxProjectState, 'version'> {
  return {
    cms: project.cms ?? project.cmsState,
    localization: project.localization ?? project.localizationConfig,
    publishing: project.publishing ?? project.publishingConfig,
    forms: project.forms ?? project.formsConfig,
    designSystem: project.designSystem ?? project.designSystemConfig,
    collaboration: project.collaboration ?? project.collaborationConfig,
    integrations: project.integrations ?? project.integrationsConfig,
  };
}

export function readEditorMaxProjectState(input: unknown): EditorMaxProjectState {
  const project = asRecord(input);
  const persisted = project ? asRecord(project[EDITOR_MAX_STATE_KEY]) : null;
  const legacy = project ? readLegacyState(project) : {};

  return {
    version: EDITOR_MAX_STATE_VERSION,
    cms: persisted?.cms ?? legacy.cms,
    localization: persisted?.localization ?? legacy.localization,
    publishing: persisted?.publishing ?? legacy.publishing,
    forms: persisted?.forms ?? legacy.forms,
    designSystem: persisted?.designSystem ?? legacy.designSystem,
    collaboration: persisted?.collaboration ?? legacy.collaboration,
    integrations: persisted?.integrations ?? legacy.integrations,
  };
}

export function embedEditorMaxProjectState<T>(project: T): T {
  const record = asRecord(project);
  if (!record) return project;

  const state = readEditorMaxProjectState(record);
  const withMaxState = {
    ...record,
    [EDITOR_MAX_STATE_KEY]: state,
  };

  return embedEditorIntegrationsHostIntoProject(withMaxState) as T;
}

export function hydrateEditorMaxProjectState(input: unknown): EditorMaxProjectState {
  hydrateEditorIntegrationsHostFromProject(input);
  return readEditorMaxProjectState(input);
}
