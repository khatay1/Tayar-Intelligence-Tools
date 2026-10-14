export interface ApplicationCustomOperationAction {
  operationId: string;
  input: Record<string, unknown>;
}

const operationIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;
const maxInputBytes = 32 * 1024;

/** Resolve a page action against the trusted custom-operation catalog. Auth and
 * server authorization remain the execution client's responsibility. */
export function parseApplicationCustomOperationAction(
  operationId: string | null | undefined,
  inputJson: string | null | undefined,
  allowedOperationIds: ReadonlySet<string>,
): ApplicationCustomOperationAction | null {
  if (!operationId || !operationIdPattern.test(operationId) || !allowedOperationIds.has(operationId)
    || typeof inputJson !== 'string' || inputJson.length > maxInputBytes) return null;
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
    return { operationId, input: input as Record<string, unknown> };
  } catch { return null; }
}
