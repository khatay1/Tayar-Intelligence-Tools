import type { SupabaseClient } from '@supabase/supabase-js';
import { isEditorProjectSecretReferenceFor, isEditorSecretReference } from '../core/editor-integration-security';
import type { EditorIntegrationEnvironment } from '../core/editor-integrations';
import type { EditorIntegrationSecretWriter } from '../core/editor-integrations-host';
import { setEditorIntegrationSecret } from '../core/editor-integrations-host';
import type { EditorIntegrationsConfig } from '../core/editor-integrations';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const connection = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/;
const fieldKey = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const stripePublishableKey = /^pk_(test|live)_[a-zA-Z0-9]+$/;
const stripePrivateKey = /^(?:sk|rk)_(test|live)_[a-zA-Z0-9]+$/;

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
  const environment = connection.environments[0];
  if (connection.providerId === 'stripe' && input.field === 'secretKey') {
    const publishable = typeof connection.config.publishableKey === 'string'
      ? stripePublishableKey.exec(connection.config.publishableKey) : null;
    const secret = stripePrivateKey.exec(input.value);
    const expectedMode = environment === 'production' ? 'live' : 'test';
    if (!publishable || !secret || publishable[1] !== expectedMode || secret[1] !== expectedMode) {
      throw new Error('Stripe credential mode does not match the selected environment.');
    }
  }
  const writer = createWebsiteProjectSecretWriter(input.client, input.projectId, environment);
  const next = await setEditorIntegrationSecret(before, input.connectionId, input.field, input.value, writer);
  if (!input.isCurrentProject() || input.getConfig() !== before) throw new Error('The project changed while storing its secret.');
  input.apply(next);
}

export interface WebsiteSecretInventory {
  configured: number;
  missing: number;
  unlinked: number;
}

/** Compare owner-visible Vault references with the current editor snapshot. No secret values are read. */
export async function inspectWebsiteIntegrationSecrets(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  projectId: string;
  getConfig(): EditorIntegrationsConfig;
  isCurrentProject(): boolean;
}): Promise<WebsiteSecretInventory> {
  if (!uuid.test(input.projectId) || !input.isCurrentProject()) throw new Error('Project changed while checking credentials.');
  const before = input.getConfig();
  const { data, error } = await input.client.rpc('website_project_secret_refs', { p_project_id: input.projectId });
  if (error || !Array.isArray(data)) throw new Error('Project credentials could not be checked.');
  const stored = new Set<string>();
  for (const row of data) {
    if (!row || typeof row !== 'object' || !connection.test(row.connection_id) || !fieldKey.test(row.field)
      || !['preview', 'staging', 'production'].includes(row.environment)
      || row.ref !== `secret://website/${input.projectId}/${row.connection_id}/${row.field}/${row.environment}`
      || stored.has(row.ref)) throw new Error('Project credentials could not be checked.');
    stored.add(row.ref);
  }
  if (!input.isCurrentProject() || input.getConfig() !== before) throw new Error('Project changed while checking credentials.');
  const linked = new Set<string>();
  let missing = 0;
  for (const item of before.connections) {
    for (const [field, secret] of Object.entries(item.secrets)) {
      if (!secret?.ref?.startsWith('secret://website/')) continue;
      if (item.environments.length !== 1 || !isEditorProjectSecretReferenceFor(secret.ref, item.id, field, item.environments[0])
        || !secret.ref.startsWith(`secret://website/${input.projectId}/`) || !stored.has(secret.ref)) missing++;
      else linked.add(secret.ref);
    }
  }
  return { configured: linked.size, missing, unlinked: stored.size - linked.size };
}
