import type { ApplicationDataOperation, ApplicationDefinition, ApplicationField, ApplicationTable } from './application-model';
import { validateApplicationBookingValues } from './application-booking';
import { readApplicationDefinition } from './application-validation';

export interface ApplicationDataViewBinding {
  tableId: string;
  columns: string[];
  actions: Array<'create' | 'update' | 'delete' | 'adjust' | 'transact' | 'transition'>;
  pageSize: number;
  searchFieldId?: string;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** References only. Runtime rows and credentials never enter an editor snapshot. */
export function validateApplicationDataViewShape(value: unknown): value is ApplicationDataViewBinding {
  if (!object(value) || Object.keys(value).some(key => !['tableId', 'columns', 'actions', 'pageSize', 'searchFieldId'].includes(key))
    || typeof value.tableId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value.tableId)
    || !Array.isArray(value.columns) || !value.columns.length || value.columns.length > 80
    || value.columns.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id))
    || new Set(value.columns).size !== value.columns.length
    || !Array.isArray(value.actions) || value.actions.some(action => !['create', 'update', 'delete', 'adjust', 'transact', 'transition'].includes(String(action)))
    || new Set(value.actions).size !== value.actions.length
    || !Number.isInteger(value.pageSize) || Number(value.pageSize) < 1 || Number(value.pageSize) > 50
    || (value.searchFieldId !== undefined && (typeof value.searchFieldId !== 'string' || !value.columns.includes(value.searchFieldId)))) return false;
  return true;
}

export function compileApplicationDataView(definition: ApplicationDefinition, input: unknown) {
  const app = readApplicationDefinition(definition);
  if (!app.auth.enabled || !validateApplicationDataViewShape(input)) throw new Error('Invalid application data view.');
  const binding = structuredClone(input);
  const table = app.tables.find(table => table.id === binding.tableId);
  if (!table || !table.fields.length || !table.permissions.some(rule => rule.operation === 'read')
    || binding.actions.some(action => !table.permissions.some(rule => rule.operation === (action === 'adjust' || action === 'transition' ? 'update' : action === 'transact' ? 'create' : action)))) throw new Error('Data view requires declared read and action permissions.');
  if (binding.actions.includes('adjust') && !table.counter) throw new Error('Adjustment requires a native counter rule.');
  if (binding.actions.includes('transact') && !table.transaction) throw new Error('Transaction creation requires a native transaction rule.');
  if (binding.actions.includes('transition') && !table.workflow) throw new Error('State transition requires a native workflow rule.');
  const columns = binding.columns.map(id => {
    const field = table.fields.find(field => field.id === id);
    if (!field) throw new Error('Data view column references a missing field.');
    return field;
  });
  if (binding.actions.some(action => action === 'create' || action === 'update')) {
    for (const field of table.fields.filter(field => field.type === 'reference')) {
      const related = app.tables.find(table => table.id === field.referenceTableId);
      if (!related?.permissions.some(rule => rule.operation === 'read')) throw new Error('Editable relationships require declared read access to the related table.');
    }
  }
  const search = columns.find(field => field.id === binding.searchFieldId);
  if (binding.searchFieldId && (!search || search.type !== 'text')) throw new Error('Data view search requires a text column.');
  return { binding, table, columns, search };
}

/** This controls available UI actions. Dedicated database RLS remains authoritative. */
export function dataViewAllows(table: ApplicationTable, operation: ApplicationDataOperation, user: { is_anonymous?: boolean } | null, roles: readonly string[]) {
  return table.permissions.some(rule => rule.operation === operation && (rule.access === 'public'
    || (!!user && !user.is_anonymous && (rule.access === 'authenticated' || rule.access === 'owner'
      || (rule.access === 'role' && !!rule.roleId && roles.includes(rule.roleId))))));
}

export function parseApplicationDataViewValues(table: ApplicationTable, input: Record<string, unknown>, creating: boolean) {
  if (!object(input) || Object.keys(input).some(key => !table.fields.some(field => field.key === key && field.id !== table.workflow?.fieldId && !field.formula))) throw new Error('Unknown record field.');
  const values: Record<string, unknown> = {};
  for (const field of table.fields) {
    if (table.workflow?.fieldId === field.id || field.formula) continue;
    const value = input[field.key];
    if (value === undefined || value === '' || value === null) {
      if (creating && field.defaultValue !== undefined) continue;
      if (field.required) throw new Error(`${field.name}: required.`);
      values[field.key] = null; continue;
    }
    values[field.key] = parseValue(field, value);
  }
  validateApplicationBookingValues(table, values);
  return values;
}

function parseValue(field: ApplicationField, value: unknown): unknown {
  const invalid = () => { throw new Error(`${field.name}: invalid value.`); };
  switch (field.type) {
    case 'number': {
      if (typeof value !== 'number' && typeof value !== 'string') return invalid();
      const number = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(number) && String(value).trim() ? number : invalid();
    }
    case 'boolean': return value === true || value === 'true' ? true : value === false || value === 'false' ? false : invalid();
    case 'enum': return typeof value === 'string' && field.options?.includes(value) ? value : invalid();
    case 'uuid': case 'reference': return typeof value === 'string' && uuid.test(value) ? value : invalid();
    case 'date': return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
      && new Date(value).toISOString().slice(0, 10) === value ? value : invalid();
    case 'datetime': return typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(value)
      && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : invalid();
    case 'json': {
      if (typeof value !== 'string' || value.length > 20_000) return invalid();
      try { return JSON.parse(value) as unknown; } catch { return invalid(); }
    }
    case 'text': return typeof value === 'string' && value.length <= 20_000 ? value : invalid();
  }
}
