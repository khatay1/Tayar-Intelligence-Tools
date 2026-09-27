/** Editable application definitions only. Rows, users, role assignments and secrets live on the server. */
export type ApplicationFieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'uuid' | 'json' | 'enum' | 'reference';
export interface ApplicationField {
  id: string;
  key: string;
  name: string;
  type: ApplicationFieldType;
  required: boolean;
  unique?: boolean;
  indexed?: boolean;
  defaultValue?: string | number | boolean | null;
  options?: string[];
  referenceTableId?: string;
}
export type ApplicationDataOperation = 'read' | 'create' | 'update' | 'delete';
export type ApplicationAccess = 'public' | 'authenticated' | 'owner' | 'role';
export interface ApplicationPermission {
  operation: ApplicationDataOperation;
  access: ApplicationAccess;
  roleId?: string;
}
export interface ApplicationTable {
  id: string;
  key: string;
  name: string;
  fields: ApplicationField[];
  permissions: ApplicationPermission[];
}
export interface ApplicationRole { id: string; name: string }
export interface ApplicationPageAccess {
  pageId: string;
  access: Exclude<ApplicationAccess, 'owner'>;
  roleId?: string;
}
export interface ApplicationDefinition {
  version: 1;
  tables: ApplicationTable[];
  roles: ApplicationRole[];
  auth: { enabled: boolean; signUpEnabled: boolean; emailVerificationRequired: boolean };
  pageAccess: ApplicationPageAccess[];
}

export const APPLICATION_LIMITS = { tables: 50, fields: 80, roles: 30, permissions: 120, pageAccess: 100 } as const;
export const APPLICATION_SYSTEM_FIELDS = ['id', 'owner_id', 'created_at', 'updated_at'] as const;
export function createApplicationDefinition(): ApplicationDefinition {
  return { version: 1, tables: [], roles: [], auth: { enabled: false, signUpEnabled: false, emailVerificationRequired: true }, pageAccess: [] };
}
