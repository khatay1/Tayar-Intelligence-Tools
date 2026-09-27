import type { SupabaseClient } from '@supabase/supabase-js';
import { isEditorSecretReference } from '../core/editor-integration-security';
import type { EditorIntegrationEnvironment } from '../core/editor-integrations';
import type { EditorIntegrationSecretWriter } from '../core/editor-integrations-host';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const connection = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;
const fieldKey = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

/** Opaque project references stay in snapshots; secret values go directly to Vault through an owner-checked RPC. */
export function createWebsiteProjectSecretWriter(
  client: SupabaseClient,
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
