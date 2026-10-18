import { createEditorIntegrationEvent, dispatchEditorIntegrationEvent,
  type EditorIntegrationRuntimeAdapter } from '../src/modules/website-builder/core/editor-integration-runtime';
import type { EditorIntegrationsConfig } from '../src/modules/website-builder/core/editor-integrations';
import type { SocialAutomationEvent } from './social-assistant';
/** Reuse Tayar's existing dispatcher. No conversation text, customer identity,
 * attachment or secret is put in a generic integration event. Consent and the
 * server-owned project/scope binding must be proved before calling this bridge. */
export async function dispatchSocialAutomationSignal(input: {
  enabled: boolean; automationEnabled: boolean; approvedConnectionIds: readonly string[];
  event: SocialAutomationEvent; projectId: string; boundScopeId: string;
  config: EditorIntegrationsConfig; adapter: EditorIntegrationRuntimeAdapter;
}) {
  if (!input.enabled || !input.automationEnabled || input.event.scopeId !== input.boundScopeId
    || !input.event.id || !input.boundScopeId) return [];
  const allowed = new Set(input.approvedConnectionIds);
  const config = { ...input.config, connections: input.config.connections.filter(connection => allowed.has(connection.id)) };
  return dispatchEditorIntegrationEvent(config, createEditorIntegrationEvent({
    id: input.event.id, event: 'custom', projectId: input.projectId, environment: 'production',
    payload: { source: 'social-hub', trigger: input.event.trigger },
  }), input.adapter, { maxAttempts: 1 });
}
