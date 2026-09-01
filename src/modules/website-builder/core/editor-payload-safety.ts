const DANGEROUS_EDITOR_PAYLOAD_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

export interface EditorPayloadSafetyLimits {
  maxDepth?: number;
  maxNodes?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxStringLength?: number;
  maxTotalStringLength?: number;
}

export interface EditorPayloadSafetyResult {
  ok: boolean;
  errors: string[];
  nodes: number;
  maxDepth: number;
  stringLength: number;
}

const DEFAULT_LIMITS: Required<EditorPayloadSafetyLimits> = {
  maxDepth: 12,
  maxNodes: 5000,
  maxArrayLength: 500,
  maxObjectKeys: 300,
  maxStringLength: 100_000,
  maxTotalStringLength: 400_000,
};

function boundedLimit(
  value: number | undefined,
  fallback: number,
  maximum: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(maximum, Math.round(parsed)));
}

function resolvedLimits(
  limits: EditorPayloadSafetyLimits = {},
): Required<EditorPayloadSafetyLimits> {
  return {
    maxDepth: boundedLimit(limits.maxDepth, DEFAULT_LIMITS.maxDepth, 50),
    maxNodes: boundedLimit(limits.maxNodes, DEFAULT_LIMITS.maxNodes, 100_000),
    maxArrayLength: boundedLimit(
      limits.maxArrayLength,
      DEFAULT_LIMITS.maxArrayLength,
      10_000,
    ),
    maxObjectKeys: boundedLimit(
      limits.maxObjectKeys,
      DEFAULT_LIMITS.maxObjectKeys,
      10_000,
    ),
    maxStringLength: boundedLimit(
      limits.maxStringLength,
      DEFAULT_LIMITS.maxStringLength,
      2_000_000,
    ),
    maxTotalStringLength: boundedLimit(
      limits.maxTotalStringLength,
      DEFAULT_LIMITS.maxTotalStringLength,
      5_000_000,
    ),
  };
}

function pathKey(path: string, key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

export function inspectEditorPayloadSafety(
  value: unknown,
  label = 'payload',
  limits: EditorPayloadSafetyLimits = {},
): EditorPayloadSafetyResult {
  const resolved = resolvedLimits(limits);
  const errors: string[] = [];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let maxDepth = 0;
  let stringLength = 0;
  let limitError = false;

  const failLimit = (message: string) => {
    if (limitError) return;
    limitError = true;
    errors.push(message);
  };

  const visit = (candidate: unknown, path: string, depth: number) => {
    if (errors.length >= 50 || limitError) return;

    nodes += 1;
    maxDepth = Math.max(maxDepth, depth);
    if (nodes > resolved.maxNodes) {
      failLimit(`${label} exceeds node limit (${resolved.maxNodes})`);
      return;
    }
    if (depth > resolved.maxDepth) {
      failLimit(`${label} exceeds nesting depth (${resolved.maxDepth})`);
      return;
    }

    if (candidate === null || candidate === undefined) return;

    if (typeof candidate === 'string') {
      stringLength += candidate.length;
      if (candidate.length > resolved.maxStringLength) {
        errors.push(
          `${path} exceeds string length limit (${resolved.maxStringLength})`,
        );
      }
      if (stringLength > resolved.maxTotalStringLength) {
        failLimit(
          `${label} exceeds total string length limit (${resolved.maxTotalStringLength})`,
        );
      }
      return;
    }

    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) {
        errors.push(`${path} contains a non-finite number`);
      }
      return;
    }

    if (typeof candidate === 'boolean') return;

    if (
      typeof candidate === 'bigint' ||
      typeof candidate === 'function' ||
      typeof candidate === 'symbol'
    ) {
      errors.push(`${path} contains unsupported ${typeof candidate} data`);
      return;
    }

    if (typeof candidate !== 'object') {
      errors.push(`${path} contains unsupported data`);
      return;
    }

    if (seen.has(candidate)) {
      errors.push(`${path} contains a circular reference`);
      return;
    }
    seen.add(candidate);

    if (Array.isArray(candidate)) {
      if (candidate.length > resolved.maxArrayLength) {
        errors.push(
          `${path} exceeds array length limit (${resolved.maxArrayLength})`,
        );
        return;
      }
      candidate.forEach((entry, index) =>
        visit(entry, `${path}[${index}]`, depth + 1),
      );
      return;
    }

    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) {
      errors.push(`${path} must be a plain object`);
      return;
    }

    const keys = Object.keys(candidate as Record<string, unknown>);
    if (keys.length > resolved.maxObjectKeys) {
      errors.push(
        `${path} exceeds object key limit (${resolved.maxObjectKeys})`,
      );
      return;
    }

    for (const key of keys) {
      if (DANGEROUS_EDITOR_PAYLOAD_KEYS.has(key)) {
        errors.push(`${path} contains forbidden key: ${key}`);
        continue;
      }
      visit(
        (candidate as Record<string, unknown>)[key],
        pathKey(path, key),
        depth + 1,
      );
    }
  };

  visit(value, label, 0);

  return {
    ok: errors.length === 0,
    errors: errors.slice(0, 50),
    nodes,
    maxDepth,
    stringLength,
  };
}

export function assertEditorPayloadSafe(
  value: unknown,
  label = 'payload',
  limits: EditorPayloadSafetyLimits = {},
) {
  const result = inspectEditorPayloadSafety(value, label, limits);
  if (!result.ok) {
    throw new Error(result.errors[0] || `${label} is unsafe`);
  }
  return result;
}

export function cloneSafeEditorPayload<T>(
  value: T,
  label = 'payload',
  limits: EditorPayloadSafetyLimits = {},
): T {
  assertEditorPayloadSafe(value, label, limits);
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function safeEditorPayloadRecord(
  value: Record<string, unknown>,
  label = 'changes',
  limits: EditorPayloadSafetyLimits = {},
) {
  return cloneSafeEditorPayload(value, label, limits);
}

export function editorPayloadHasForbiddenKey(key: string) {
  return DANGEROUS_EDITOR_PAYLOAD_KEYS.has(key);
}
