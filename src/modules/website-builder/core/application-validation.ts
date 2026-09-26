import { APPLICATION_LIMITS, APPLICATION_SYSTEM_FIELDS, createApplicationDefinition, type ApplicationDefinition } from './application-model';

export interface ApplicationIssue { path: string; code: string; message: string }
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
const name = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;

export function validateApplicationDefinition(value: unknown, pageIds?: ReadonlySet<string>): ApplicationIssue[] {
  const issues: ApplicationIssue[] = [];
  const issue = (path: string, code: string, message: string) => issues.push({ path, code, message });
  function shape(item: unknown, keys: string[], path: string): item is RecordValue {
    if (!object(item)) { issue(path, 'invalid-object', 'Expected an application configuration object.'); return false; }
    if (Object.keys(item).some(key => !keys.includes(key))) issue(path, 'unknown-property', 'Unsupported configuration property; credentials and runtime data cannot be stored here.');
    return true;
  }
  function list(input: unknown, limit: number, path: string): unknown[] {
    if (!Array.isArray(input) || input.length > limit) { issue(path, 'invalid-list', `Expected a list with at most ${limit} items.`); return []; }
    return input;
  }
  if (!shape(value, ['version', 'tables', 'roles', 'auth', 'pageAccess'], 'application')) return issues;
  if (value.version !== 1) issue('application.version', 'unsupported-version', 'Unsupported application schema version. Keep the source project and use a compatible editor.');
  const tables = list(value.tables, APPLICATION_LIMITS.tables, 'application.tables');
  const roles = list(value.roles, APPLICATION_LIMITS.roles, 'application.roles');
  const tableIds = new Set<string>();
  const roleIds = new Set<string>();
  const allIds = new Set<string>();
  const tableKeys = new Set<string>();
  function identity(candidate: unknown, path: string, bucket?: Set<string>) {
    if (!id(candidate) || allIds.has(candidate)) { issue(path, 'invalid-id', 'IDs must be valid and globally unique within the application definition.'); return; }
    allIds.add(candidate); bucket?.add(candidate);
  }
  roles.forEach((role, index) => {
    const path = `application.roles[${index}]`;
    if (!shape(role, ['id', 'name'], path)) return;
    identity(role.id, `${path}.id`, roleIds);
    if (!name(role.name)) issue(`${path}.name`, 'invalid-name', 'A role requires a display name.');
  });
  const auth = value.auth;
  if (shape(auth, ['enabled', 'signUpEnabled', 'emailVerificationRequired'], 'application.auth')) {
    for (const key of ['enabled', 'signUpEnabled', 'emailVerificationRequired']) if (typeof auth[key] !== 'boolean') issue(`application.auth.${key}`, 'invalid-boolean', 'Expected a boolean setting.');
    if (auth.signUpEnabled && !auth.enabled) issue('application.auth', 'auth-disabled', 'Enable authentication before allowing registration.');
  }
  const authEnabled = object(auth) && auth.enabled === true;
  tables.forEach((table, index) => {
    const path = `application.tables[${index}]`;
    if (!shape(table, ['id', 'key', 'name', 'fields', 'permissions'], path)) return;
    identity(table.id, `${path}.id`, tableIds);
    if (!identifier(table.key) || tableKeys.has(table.key) || table.key.startsWith('tayar_') || table.key === 'user_roles') issue(`${path}.key`, 'invalid-key', 'Table keys must be unique lower-case identifiers outside reserved namespaces.');
    else tableKeys.add(table.key);
    if (!name(table.name)) issue(`${path}.name`, 'invalid-name', 'A table requires a display name.');
  });
  function access(rule: RecordValue, path: string, allowOwner: boolean) {
    const allowed = allowOwner ? ['public', 'authenticated', 'owner', 'role'] : ['public', 'authenticated', 'role'];
    if (!allowed.includes(String(rule.access))) issue(`${path}.access`, 'invalid-access', 'Unsupported access rule.');
    if (rule.access !== 'public' && !authEnabled) issue(path, 'auth-disabled', 'Authentication is required for this permission.');
    if (rule.access === 'role' && !roleIds.has(String(rule.roleId))) issue(`${path}.roleId`, 'missing-role', 'Select an existing application role.');
    if (rule.access !== 'role' && rule.roleId !== undefined) issue(`${path}.roleId`, 'unexpected-role', 'Role restrictions require role-based access.');
  }
  tables.forEach((table, tableIndex) => {
    if (!object(table)) return;
    const path = `application.tables[${tableIndex}]`;
    const keys = new Set<string>(APPLICATION_SYSTEM_FIELDS);
    list(table.fields, APPLICATION_LIMITS.fields, `${path}.fields`).forEach((field, fieldIndex) => {
      const fieldPath = `${path}.fields[${fieldIndex}]`;
      if (!shape(field, ['id', 'key', 'name', 'type', 'required', 'unique', 'indexed', 'defaultValue', 'options', 'referenceTableId'], fieldPath)) return;
      identity(field.id, `${fieldPath}.id`);
      if (!identifier(field.key) || keys.has(field.key)) issue(`${fieldPath}.key`, 'invalid-key', 'Field keys must be unique lower-case identifiers and cannot replace system fields.');
      else keys.add(field.key);
      if (!name(field.name)) issue(`${fieldPath}.name`, 'invalid-name', 'A field requires a display name.');
      if (!['text', 'number', 'boolean', 'date', 'datetime', 'uuid', 'json', 'enum', 'reference'].includes(String(field.type))) issue(`${fieldPath}.type`, 'invalid-type', 'Unsupported field type.');
      if (typeof field.required !== 'boolean' || ['unique', 'indexed'].some(key => field[key] !== undefined && typeof field[key] !== 'boolean')) issue(fieldPath, 'invalid-boolean', 'Field constraint flags must be booleans.');
      if (field.type === 'reference' && !tableIds.has(String(field.referenceTableId))) issue(fieldPath, 'missing-table', 'A relationship requires an existing target table.');
      if (field.type !== 'reference' && field.referenceTableId !== undefined) issue(fieldPath, 'unexpected-reference', 'Only reference fields can target a table.');
      if (field.type === 'enum') {
        if (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100 || field.options.some(item => typeof item !== 'string' || !item || item.length > 200) || new Set(field.options).size !== field.options.length) issue(fieldPath, 'invalid-options', 'An enum requires 1–100 unique nonempty options.');
      } else if (field.options !== undefined) issue(fieldPath, 'unexpected-options', 'Only enum fields can define options.');
      const def = field.defaultValue;
      if (def !== undefined) {
        const validDefault = def === null ? !field.required
          : field.type === 'number' ? typeof def === 'number' && Number.isFinite(def)
          : field.type === 'boolean' ? typeof def === 'boolean'
          : field.type === 'text' ? typeof def === 'string' && def.length <= 4000
          : field.type === 'enum' ? Array.isArray(field.options) && field.options.includes(def)
          : false;
        if (!validDefault) issue(`${fieldPath}.defaultValue`, 'invalid-default', 'The default must match the field type. Computed, relationship and structured defaults are not accepted.');
      }
    });
    const permissionKeys = new Set<string>();
    list(table.permissions, APPLICATION_LIMITS.permissions, `${path}.permissions`).forEach((permission, index) => {
      const permissionPath = `${path}.permissions[${index}]`;
      if (!shape(permission, ['operation', 'access', 'roleId'], permissionPath)) return;
      if (!['read', 'create', 'update', 'delete'].includes(String(permission.operation))) issue(permissionPath, 'invalid-operation', 'Unsupported database operation.');
      access(permission, permissionPath, true);
      if (permission.access === 'public' && permission.operation !== 'read') issue(permissionPath, 'public-write', 'Anonymous database writes require a validated server action.');
      const key = `${permission.operation}:${permission.access}:${permission.roleId ?? ''}`;
      if (permissionKeys.has(key)) issue(permissionPath, 'duplicate-permission', 'Duplicate permission rule.');
      permissionKeys.add(key);
    });
    if (Array.isArray(table.permissions) && table.permissions.some(p => object(p) && ['update', 'delete'].includes(String(p.operation))) && !table.permissions.some(p => object(p) && p.operation === 'read')) issue(`${path}.permissions`, 'read-required', 'Update and delete require a read policy.');
  });
  const protectedPages = new Set<string>();
  list(value.pageAccess, APPLICATION_LIMITS.pageAccess, 'application.pageAccess').forEach((rule, index) => {
    const path = `application.pageAccess[${index}]`;
    if (!shape(rule, ['pageId', 'access', 'roleId'], path)) return;
    if (!id(rule.pageId) || protectedPages.has(rule.pageId) || (pageIds && !pageIds.has(rule.pageId))) issue(path, 'invalid-page', 'Access rules require a unique existing page.');
    else protectedPages.add(rule.pageId);
    access(rule, path, false);
  });
  return issues;
}

/** Reject unsupported data instead of silently resetting an application's security configuration. */
export function readApplicationDefinition(value: unknown, pageIds?: ReadonlySet<string>): ApplicationDefinition {
  if (value === undefined) return createApplicationDefinition();
  const issues = validateApplicationDefinition(value, pageIds);
  if (issues.length) throw new Error(issues.map(item => `${item.path}: ${item.message}`).join('\n'));
  return structuredClone(value as ApplicationDefinition);
}
