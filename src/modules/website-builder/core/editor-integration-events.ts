import type { EditorIntegrationEnvironment, EditorIntegrationEvent, EditorIntegrationsConfig } from './editor-integrations';
import {
  createEditorIntegrationEvent,
  dispatchEditorIntegrationEvent,
  type EditorIntegrationDelivery,
  type EditorIntegrationDispatchOptions,
  type EditorIntegrationRuntimeAdapter,
} from './editor-integration-runtime';

export type EditorBuilderIntegrationEvent = Extract<EditorIntegrationEvent,
  'page.viewed' | 'form.submitted' | 'commerce.checkout' | 'commerce.paid' | 'site.published'>;

export interface EditorBuilderIntegrationEventContext {
  projectId: string;
  environment: EditorIntegrationEnvironment;
  event: EditorBuilderIntegrationEvent;
  payload?: Record<string, unknown>;
}

/**
 * Single event boundary used by Website Builder features. Keeping event creation
 * here prevents Forms, Publishing and Commerce from each implementing their own
 * webhook/retry/secret behavior.
 */
export async function emitEditorBuilderIntegrationEvent(
  config: EditorIntegrationsConfig,
  context: EditorBuilderIntegrationEventContext,
  adapter: EditorIntegrationRuntimeAdapter,
  options?: EditorIntegrationDispatchOptions,
): Promise<EditorIntegrationDelivery[]> {
  return dispatchEditorIntegrationEvent(
    config,
    createEditorIntegrationEvent({
      projectId: context.projectId,
      environment: context.environment,
      event: context.event,
      payload: context.payload ?? {},
    }),
    adapter,
    options,
  );
}

export function editorPublishEvent(projectId: string, payload: Record<string, unknown> = {}): EditorBuilderIntegrationEventContext {
  return { projectId, environment: 'production', event: 'site.published', payload };
}

export function editorFormSubmissionEvent(projectId: string, payload: Record<string, unknown>, environment: EditorIntegrationEnvironment = 'production'): EditorBuilderIntegrationEventContext {
  return { projectId, environment, event: 'form.submitted', payload };
}

export function editorCommerceEvent(projectId: string, paid: boolean, payload: Record<string, unknown>, environment: EditorIntegrationEnvironment = 'production'): EditorBuilderIntegrationEventContext {
  return { projectId, environment, event: paid ? 'commerce.paid' : 'commerce.checkout', payload };
}

export function editorPageViewEvent(projectId: string, payload: Record<string, unknown>, environment: EditorIntegrationEnvironment): EditorBuilderIntegrationEventContext {
  return { projectId, environment, event: 'page.viewed', payload };
}
