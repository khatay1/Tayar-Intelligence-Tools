import type { SupabaseClient } from '@supabase/supabase-js';
import { isEditorSecretReference } from '../core/editor-integration-security';
import type { EditorIntegrationEnvironment } from '../core/editor-integrations';
import type { EditorIntegrationSecretWriter } from '../core/editor-integrations-host';
import { setEditorIntegrationSecret } from '../core/editor-integrations-host';
import type { EditorIntegrationsConfig } from '../core/editor-integrations';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const connection = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;
const fieldKey = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

/** Opaque project references stay in snapshots; secret values go directly to Vault through an owner-checked RPC. */
export function createWebsiteProjectSecretWriter(
  client: Pick<SupabaseClient, 'rpc'>,
  projectId: string,
  environment: EditorIntegrationEnvironment,
): EditorIntegrationSecretWriter {
  if (!uuid.test(projectId) || !['preview', 'staging', 'production'].includes(environment)) throw new Error('Invalid project secret target.');
  return {
    async setSecret(connectionId, field, value) {
      if (!connection.test(connectionId) || !fieldKey.test(field) || !value.trim() || new TextEncoder().encode(value).length > 16_384) {
        throw new Error('Invalid project secret.');
      }
      const { data, error } = await client.rpc('website_set_project_secret', {
        p_project_id: projectId, p_connection_id: connectionId, p_field: field,
        p_environment: environment, p_value: value,
      });
      if (error || !isEditorSecretReference(data)) throw new Error('Project secret could not be stored.');
      const expected = `secret://website/${projectId}/${connectionId}/${field}/${environment}`;
      if (data !== expected) throw new Error('Project secret reference does not match this project.');
      return { ref: data };
    },
  };
}

/** Keep a secret value out of editor state. The connection and active project
 * must still be the same after the owner RPC returns. A stale response cannot
 * attach a reference to another project or overwrite newer editor changes. */
export async function saveWebsiteIntegrationSecret(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  projectId: string;
  connectionId: string;
  field: string;
  value: string;
  getConfig(): EditorIntegrationsConfig;
  isCurrentProject(): boolean;
  apply(config: EditorIntegrationsConfig): void;
}): Promise<void> {
  const before = input.getConfig();
  const connection = before.connections.find(item => item.id === input.connectionId);
  if (!connection || connection.environments.length !== 1) throw new Error('Choose one integration environment before storing a secret.');
  const writer = createWebsiteProjectSecretWriter(input.client, input.projectId, connection.environments[0]);
  const next = await setEditorIntegrationSecret(before, input.connectionId, input.field, input.value, writer);
  if (!input.isCurrentProject() || input.getConfig() !== before) throw new Error('The project changed while storing its secret.');
  input.apply(next);
}
