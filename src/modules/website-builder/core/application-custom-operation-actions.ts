export interface ApplicationCustomOperationAction {
  operationId: string;
  input: Record<string, unknown>;
  bindFormValues: boolean;
}

const operationIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const maxInputBytes = 32 * 1024;
const maxOutputBytes = 32 * 1024;

/** Convert a validated JSON result into bounded text for a textContent sink. */
export function serializeApplicationCustomOperationResult(result: unknown): string | null {
  try {
    const output = typeof result === 'string' ? result : JSON.stringify(result);
    return typeof output === 'string' && new TextEncoder().encode(output).byteLength <= maxOutputBytes ? output : null;
  } catch { return null; }
}

/** Resolve a page action against the trusted custom-operation catalog. Auth and
 * server authorization remain the execution client's responsibility. */
export function parseApplicationCustomOperationAction(
  operationId: string | null | undefined,
  inputJson: string | null | undefined,
  allowedOperationIds: ReadonlySet<string>,
  bindFormValues = false,
): ApplicationCustomOperationAction | null {
  if (!operationId || !operationIdPattern.test(operationId) || !allowedOperationIds.has(operationId)
    || typeof inputJson !== 'string' || inputJson.length > maxInputBytes || typeof bindFormValues !== 'boolean') return null;
  try {
    const input: unknown = JSON.parse(inputJson);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const ancestors = new Set<object>();
    const valid = (value: unknown, depth: number): boolean => {
      if (depth > 20) return false;
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
      if (typeof value === 'number') return Number.isFinite(value);
      if (typeof value !== 'object' || ancestors.has(value)) return false;
      ancestors.add(value);
      const ok = Array.isArray(value)
        ? value.every(item => valid(item, depth + 1))
        : Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key)
          && valid(item, depth + 1));
      ancestors.delete(value);
      return ok;
    };
    if (!valid(input, 0) || new TextEncoder().encode(JSON.stringify(input)).byteLength > maxInputBytes) return null;
    if (bindFormValues && Object.prototype.hasOwnProperty.call(input, 'form')) return null;
    return { operationId, input: input as Record<string, unknown>, bindFormValues };
  } catch { return null; }
}

/** Add explicitly opted-in, same-section application form values under `form`.
 * Reject files, duplicate names, undeclared controls, unsafe keys, and oversized payloads. */
export function bindApplicationCustomOperationFormValues(
  input: Record<string, unknown>,
  entries: Iterable<[string, FormDataEntryValue]>,
  allowedFieldNames: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (Object.prototype.hasOwnProperty.call(input, 'form')) return null;
  const form: Record<string, string> = {};
  let count = 0;
  for (const [name, value] of entries) {
    if (++count > 46 || !allowedFieldNames.has(name) || ['__proto__', 'constructor', 'prototype'].includes(name)
      || typeof value !== 'string' || value.length > maxInputBytes || Object.prototype.hasOwnProperty.call(form, name)) return null;
    form[name] = value;
  }
  const result = { ...input, form };
  try {
    const json = JSON.stringify(result);
    if (new TextEncoder().encode(json).byteLength > maxInputBytes) return null;
    return result;
  } catch { return null; }
}
