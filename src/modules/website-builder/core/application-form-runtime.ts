import type { ApplicationDefinition, ApplicationField } from './application-model';
import { readApplicationDefinition } from './application-validation';
import type { WebsiteSection, WebsiteFormField } from './types';

/** Editable references only. Values/rows/credentials never belong in a binding. */
export interface ApplicationCreateFormBinding {
  operation: 'create';
  tableId: string;
  fields: Array<{ formFieldId: string; tableFieldId: string }>;
}
export type ApplicationFormSubmissionState = 'idle' | 'submitting' | 'confirmed' | 'uncertain';
const invalid = () => new Error('The form does not match the application fields.');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const activeFormRequests = new Set<string>();
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function exact(value: unknown, keys: string[]) {
  if (!record(value) || Object.keys(value).some(key => !keys.includes(key))) throw invalid();
}
function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) throw invalid();
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw invalid();
  return value;
}
function boundedJson(text: string) {
  if (text.length > 32_768) throw invalid();
  const result: unknown = JSON.parse(text);
  let nodes = 0;
  function inspect(value: unknown, depth: number) {
    if (++nodes > 4096 || depth > 24) throw invalid();
    if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) throw invalid();
    if (value && typeof value === 'object') Object.values(value).forEach(item => inspect(item, depth + 1));
  }
  inspect(result, 0); return result;
}
function convert(form: WebsiteFormField, field: ApplicationField, raw: string | undefined): unknown {
  if (field.type === 'boolean') {
    if (raw !== undefined && raw !== 'on' && raw !== 'true' && raw !== 'false') throw invalid();
    const checked = raw === 'on' || raw === 'true';
    if (form.required && !checked) throw invalid();
    return checked;
  }
  if (raw === undefined || raw.trim() === '') {
    if (field.required || form.required) throw invalid();
    return null;
  }
  if (raw.length > (field.type === 'json' ? 32_768 : 4000)) throw invalid();
  const validation = form.validation;
  if ((validation?.minLength !== undefined && raw.length < validation.minLength)
    || (validation?.maxLength !== undefined && raw.length > validation.maxLength)) throw invalid();
  if (form.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) throw invalid();
  if (form.type === 'url' && !['http:', 'https:'].includes(new URL(raw).protocol)) throw invalid();
  switch (field.type) {
    case 'text': return raw;
    case 'number': {
      if (raw.length > 100 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) throw invalid();
      const value = Number(raw);
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw invalid();
      if ((validation?.min !== undefined && value < validation.min) || (validation?.max !== undefined && value > validation.max)) throw invalid();
      return value;
    }
    case 'date': return date(raw);
    case 'datetime': {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(raw)) throw invalid();
      date(raw.slice(0, 10));
      const value = new Date(raw);
      if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 19) !== raw.slice(0, 19)) throw invalid();
      return value.toISOString();
    }
    case 'uuid': case 'reference': if (!uuid.test(raw)) throw invalid(); return raw.toLowerCase();
    case 'enum': if (!field.options?.includes(raw)) throw invalid(); return raw;
    case 'json': { const value = boundedJson(raw); if (value === null && field.required) throw invalid(); return value; }
  }
}

/** Compiles existing contact form field IDs to app field IDs. Permission checks
 * here are configuration checks only; the dedicated database RLS decides access.
 * Conditional/file fields and side-effect automations stay unavailable until
 * their server execution contracts are implemented. Never silently drop them. */
export function compileApplicationCreateForm(definition: ApplicationDefinition, source: WebsiteSection, input: ApplicationCreateFormBinding) {
  const app = readApplicationDefinition(definition);
  const section = JSON.parse(JSON.stringify(source)) as WebsiteSection;
  const binding = JSON.parse(JSON.stringify(input)) as ApplicationCreateFormBinding;
  exact(binding, ['operation', 'tableId', 'fields']);
  if (section.type !== 'contact' || binding.operation !== 'create' || typeof binding.tableId !== 'string'
    || !Array.isArray(binding.fields) || binding.fields.length < 1 || binding.fields.length > 45
    || !Array.isArray(section.formFields) || section.formFields.length !== binding.fields.length
    || section.formAutomations?.some(item => item.enabled) || section.formSuccessAction === 'redirect') throw invalid();
  const table = app.tables.find(item => item.id === binding.tableId);
  if (!table || !table.permissions.some(item => item.operation === 'create')) throw invalid();
  const formIds = new Set<string>(), tableIds = new Set<string>(), names = new Set<string>();
  const fields = binding.fields.map(mapping => {
    exact(mapping, ['formFieldId', 'tableFieldId']);
    if (typeof mapping.formFieldId !== 'string' || typeof mapping.tableFieldId !== 'string'
      || formIds.has(mapping.formFieldId) || tableIds.has(mapping.tableFieldId)) throw invalid();
    const form = section.formFields!.find(item => item.id === mapping.formFieldId);
    const field = table.fields.find(item => item.id === mapping.tableFieldId);
    if (!form || !field || !/^[a-z][a-z0-9_]{0,79}$/.test(form.name) || names.has(form.name)
      || form.name.startsWith('_tayar_') || form.conditions?.length || form.type === 'file') throw invalid();
    if (form.validation) {
      exact(form.validation, ['minLength', 'maxLength', 'min', 'max', 'pattern']);
      if (form.validation.pattern) throw invalid(); // Arbitrary regex execution needs a bounded validator.
      for (const key of ['minLength', 'maxLength', 'min', 'max'] as const) {
        const value = form.validation[key];
        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)
          || (key.endsWith('Length') && (!Number.isInteger(value) || value < 0 || value > 32_768)))) throw invalid();
      }
      if ((form.validation.minLength ?? 0) > (form.validation.maxLength ?? 32_768)
        || (form.validation.min ?? -Infinity) > (form.validation.max ?? Infinity)) throw invalid();
    }
    const compatible = field.type === 'boolean' ? form.type === 'checkbox'
      : field.type === 'number' ? form.type === 'number'
      : field.type === 'date' ? form.type === 'date'
      : field.type === 'enum' ? ['select', 'radio'].includes(form.type) && !!form.options?.length && form.options.every(value => field.options?.includes(value))
      : ['text', 'email', 'tel', 'url', 'textarea'].includes(form.type);
    if (!compatible) throw invalid();
    formIds.add(form.id); tableIds.add(field.id); names.add(form.name);
    return { form, field };
  });
  if (new Set(section.formFields.map(field => field.id)).size !== section.formFields.length
    || table.fields.some(field => field.required && field.defaultValue === undefined && !tableIds.has(field.id))) throw invalid();
  return {
    tableId: table.id,
    values(entries: Iterable<[string, unknown]>): Record<string, unknown> {
      const values = new Map<string, string>(); let count = 0;
      for (const [name, value] of entries) {
        if (++count > 46 || typeof value !== 'string' || values.has(name)) throw invalid();
        if (name === '_tayar_company') { if (value) throw invalid(); values.set(name, value); continue; }
        if (!names.has(name) || value.length > 32_768) throw invalid();
        values.set(name, value);
      }
      try { return Object.fromEntries(fields.map(({ form, field }) => [field.key, convert(form, field, values.get(form.name))])); }
      catch { throw invalid(); }
    },
  };
}

/** A lost response can mean the insert committed. No automatic retry/reset is
 * provided for an uncertain result; durable reconciliation/idempotency is a
 * release prerequisite. Runtime rows are intentionally not exposed by this API. */
export function createApplicationFormSubmission(compiled: ReturnType<typeof compileApplicationCreateForm>, runtime: {
  create(tableId: string, values: Record<string, unknown>): Promise<unknown>;
}) {
  const tableId = compiled.tableId, values = compiled.values;
  let state: ApplicationFormSubmissionState = 'idle', disposed = false;
  return {
    status: () => ({ state, disposed }),
    async submit(entries: Iterable<[string, unknown]>): Promise<'confirmed' | 'uncertain'> {
      if (disposed || state !== 'idle') throw new Error('This submission is not available.');
      const payload = values(entries); // Validation errors are safe to correct before any mutation.
      state = 'submitting';
      try {
        await runtime.create(tableId, payload);
        state = disposed ? 'uncertain' : 'confirmed';
      } catch { state = 'uncertain'; }
      return state;
    },
    resetConfirmed() { if (disposed || state !== 'confirmed') throw new Error('This submission cannot be reset.'); state = 'idle'; },
    dispose() { disposed = true; if (state === 'submitting') state = 'uncertain'; },
  };
}

/** A tab-scoped pending identity survives page navigation without persisting
 * submitted values. The caller supplies a key scoped to the dedicated project,
 * authenticated user and form. A changed payload cannot reuse its identity.
 * Storage failure stops the mutation before it reaches the database. */
export function createDurableApplicationFormSubmission(compiled: ReturnType<typeof compileApplicationCreateForm>, runtime: {
  createOnce(tableId: string, values: Record<string, unknown>, requestId: string): Promise<'created' | 'already-created'>;
}, scope: { key: string; storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; crypto: Pick<Crypto, 'randomUUID' | 'subtle'> }) {
  if (!scope || typeof scope.key !== 'string' || !/^tayar-app-form:[a-zA-Z0-9:._-]{1,240}$/.test(scope.key)
    || !scope.storage || !scope.crypto?.subtle || typeof scope.crypto.randomUUID !== 'function') throw new Error('Application form identity is unavailable.');
  let state: ApplicationFormSubmissionState = 'idle', disposed = false;
  const digest = async (payload: Record<string, unknown>) => {
    const bytes = await scope.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  };
  return {
    status: () => ({ state, disposed }),
    async submit(entries: Iterable<[string, unknown]>): Promise<'confirmed' | 'uncertain'> {
      if (disposed || (state !== 'idle' && state !== 'uncertain')) throw new Error('This submission is not available.');
      const payload = compiled.values(entries);
      let fingerprint: string;
      try { fingerprint = await digest(payload); }
      catch { throw new Error('Application form identity is unavailable.'); }
      if (disposed || (state !== 'idle' && state !== 'uncertain')) throw new Error('This submission is not available.');
      if (activeFormRequests.has(scope.key)) throw new Error('This submission is not available.');
      activeFormRequests.add(scope.key);
      try {
        let requestId: string;
        try {
          const stored = scope.storage.getItem(scope.key);
          if (stored !== null) {
            const pending: unknown = JSON.parse(stored);
            if (!record(pending) || Object.keys(pending).length !== 2 || typeof pending.requestId !== 'string'
              || !uuid.test(pending.requestId) || pending.fingerprint !== fingerprint) throw new Error();
            requestId = pending.requestId;
          } else {
            requestId = scope.crypto.randomUUID();
            if (!uuid.test(requestId)) throw new Error();
            scope.storage.setItem(scope.key, JSON.stringify({ requestId, fingerprint }));
          }
        } catch { throw new Error('Application form identity is unavailable.'); }
        state = 'submitting';
        try {
          await runtime.createOnce(compiled.tableId, payload, requestId);
          if (disposed) { state = 'uncertain'; return state; }
          scope.storage.removeItem(scope.key);
          state = 'confirmed';
        } catch { state = 'uncertain'; }
        return state;
      } finally { activeFormRequests.delete(scope.key); }
    },
    resetConfirmed() { if (disposed || state !== 'confirmed') throw new Error('This submission cannot be reset.'); state = 'idle'; },
    dispose() { disposed = true; if (state === 'submitting') state = 'uncertain'; },
  };
}
