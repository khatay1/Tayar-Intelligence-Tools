export interface AIProjectRequestBinding {
  tool: string;
  projectId: string | null;
  fingerprint: string | null;
}

const pendingBindings = new Map<string, AIProjectRequestBinding>();
const activeBindings = new Map<string, AIProjectRequestBinding>();
const responseBindings = new WeakMap<object, AIProjectRequestBinding>();

function objectValue(value: unknown): object | null {
  return value !== null && typeof value === 'object' ? value as object : null;
}

export function setActiveAIProjectContext(
  tool: string,
  projectId: string | null,
  fingerprint: string | null = null,
): void {
  activeBindings.set(tool, { tool, projectId, fingerprint });
}

export function prepareAIProjectRequestContext(
  tool: string,
  projectId: string | null,
  fingerprint: string | null = null,
): void {
  pendingBindings.set(tool, { tool, projectId, fingerprint });
}

export function captureAIProjectRequestContext(tool: string): AIProjectRequestBinding | null {
  const binding = pendingBindings.get(tool) || null;
  pendingBindings.delete(tool);
  return binding;
}

export function bindAIResponseProjectContext(
  value: unknown,
  binding: AIProjectRequestBinding | null,
): void {
  const target = objectValue(value);
  if (target && binding) responseBindings.set(target, binding);
}

export function carryAIResponseProjectContext(source: unknown, target: unknown): void {
  const sourceObject = objectValue(source);
  const targetObject = objectValue(target);
  if (!sourceObject || !targetObject) return;
  const binding = responseBindings.get(sourceObject);
  if (binding) responseBindings.set(targetObject, binding);
}

export function assertAIResponseProjectContextCurrent(value: unknown, tool: string): void {
  const target = objectValue(value);
  if (!target) return;
  const binding = responseBindings.get(target);
  if (!binding) return;

  const active = activeBindings.get(tool);
  if (!active) return;

  if (binding.projectId !== null && active.projectId !== binding.projectId) {
    throw new Error('Target project changed while AI was working. The stale AI result was discarded.');
  }

  if (
    binding.projectId !== null &&
    active.projectId === binding.projectId &&
    binding.fingerprint &&
    active.fingerprint &&
    binding.fingerprint !== active.fingerprint
  ) {
    throw new Error('Target project files changed while AI was working. Generate a fresh patch before applying changes.');
  }
}

export function assertAIResponseProjectContextMatches(
  value: unknown,
  tool: string,
  projectId: string,
  fingerprint?: string | null,
): void {
  const target = objectValue(value);
  const binding = target ? responseBindings.get(target) : null;

  if (!binding || binding.tool !== tool) {
    throw new Error('This AI patch is missing its project safety binding. Generate a fresh patch before applying changes.');
  }

  if (binding.projectId !== projectId) {
    throw new Error('This AI patch belongs to a different project. Generate a new patch for the selected project.');
  }

  if (binding.fingerprint && fingerprint && binding.fingerprint !== fingerprint) {
    throw new Error('This AI patch was planned from an older project snapshot. Refresh the project and generate a new patch.');
  }
}
