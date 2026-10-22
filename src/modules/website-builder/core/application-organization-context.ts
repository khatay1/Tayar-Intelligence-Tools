import type { ApplicationDefinition, ApplicationTable } from './application-model';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApplicationOrganizationContext {
  id: string;
  fieldKey: string;
}

/** Resolve the immutable tenant discriminator for one table. The selected
 * organization is browser state only; PostgreSQL membership RLS remains the
 * authority and rejects stale or foreign identities. */
export function applicationOrganizationContext(definition: ApplicationDefinition, table: ApplicationTable,
  organizationId?: string): ApplicationOrganizationContext | undefined {
  if (!table.organizationFieldId) return undefined;
  const field = table.fields.find(item => item.id === table.organizationFieldId);
  if (!definition.tenancy || !field || field.type !== 'reference'
    || field.referenceTableId !== definition.tenancy.organizationTableId || !organizationId || !uuid.test(organizationId)) {
    throw new Error('An active organization is required.');
  }
  return { id: organizationId.toLowerCase(), fieldKey: field.key };
}

/** The organization discriminator is never accepted from an authored form or
 * record editor. It is injected from the revalidated active context. */
export function bindApplicationOrganizationInput(input: Record<string, unknown>, context?: ApplicationOrganizationContext) {
  if (!context) return input;
  if (Object.prototype.hasOwnProperty.call(input, context.fieldKey)) throw new Error('The organization scope cannot be changed.');
  return { ...input, [context.fieldKey]: context.id };
}

