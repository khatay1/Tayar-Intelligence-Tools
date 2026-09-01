import type { EditorNativeOperation, EditorNativeOperationAction } from './editor-native-operation';

export interface EditorOperationPreflightOptions {
  maxOperations?: number;
  maxDestructiveOperations?: number;
}

export interface EditorOperationPreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  destructiveCount: number;
}

const DESTRUCTIVE_ACTIONS = new Set<EditorNativeOperationAction>([
  'remove_page',
  'remove_section',
  'remove_element',
  'remove_container',
  'remove_form_field',
]);

function bounded(value: number | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function elementTargetKey(operation: EditorNativeOperation) {
  return operation.elementId
    ? `element:${operation.pageId || ''}:${operation.sectionId || ''}:${operation.elementId}`
    : undefined;
}

function containerTargetKey(operation: EditorNativeOperation) {
  return operation.containerId
    ? `container:${operation.pageId || ''}:${operation.sectionId || ''}:${operation.containerId}`
    : undefined;
}

function formFieldTargetKey(operation: EditorNativeOperation) {
  return operation.formFieldId
    ? `form-field:${operation.pageId || ''}:${operation.sectionId || ''}:${operation.formFieldId}`
    : undefined;
}

function targetKey(operation: EditorNativeOperation) {
  return (
    elementTargetKey(operation) ||
    containerTargetKey(operation) ||
    formFieldTargetKey(operation) ||
    (operation.sectionId
      ? `section:${operation.pageId || ''}:${operation.sectionId}`
      : undefined) ||
    (operation.pageId ? `page:${operation.pageId}` : undefined)
  );
}

function referencedTargetKeys(operation: EditorNativeOperation) {
  const targets: string[] = [];

  if (
    operation.action === 'assign_element_container' &&
    operation.containerId
  ) {
    const container = containerTargetKey(operation);
    if (container) targets.push(container);
  }

  return targets;
}

function removedTargetKey(operation: EditorNativeOperation) {
  if (operation.action === 'remove_element' && operation.elementId) {
    return elementTargetKey(operation);
  }
  if (operation.action === 'remove_container' && operation.containerId) {
    return containerTargetKey(operation);
  }
  if (operation.action === 'remove_form_field' && operation.formFieldId) {
    return formFieldTargetKey(operation);
  }
  if (operation.action === 'remove_section' && operation.sectionId) {
    return `section:${operation.pageId || ''}:${operation.sectionId}`;
  }
  if (operation.action === 'remove_page' && operation.pageId) {
    return `page:${operation.pageId}`;
  }
  return undefined;
}

function targetWasRemoved(target: string | undefined, removed: Set<string>) {
  if (!target) return false;
  if (removed.has(target)) return true;

  const parts = target.split(':');
  if (
    parts[0] === 'element' ||
    parts[0] === 'container' ||
    parts[0] === 'form-field'
  ) {
    if (removed.has(`section:${parts[1]}:${parts[2]}`)) return true;
    if (removed.has(`page:${parts[1]}`)) return true;
  }

  if (parts[0] === 'section' && removed.has(`page:${parts[1]}`)) {
    return true;
  }

  return false;
}

export function preflightEditorNativeOperations(
  operations: EditorNativeOperation[],
  options: EditorOperationPreflightOptions = {},
): EditorOperationPreflightResult {
  const maxOperations = bounded(options.maxOperations, 60, 200);
  const maxDestructive = bounded(options.maxDestructiveOperations, 20, 100);
  const errors: string[] = [];
  const warnings: string[] = [];
  const removed = new Set<string>();
  let destructiveCount = 0;

  if (operations.length > maxOperations) {
    errors.push(`Patch contains ${operations.length} operations; maximum is ${maxOperations}`);
  }

  operations.slice(0, maxOperations).forEach((operation, index) => {
    const prefix = `Operation ${index + 1} (${operation.action})`;
    if (DESTRUCTIVE_ACTIONS.has(operation.action)) destructiveCount += 1;

    const target = targetKey(operation);
    if (targetWasRemoved(target, removed)) {
      errors.push(`${prefix} targets content removed earlier in the same patch`);
    }

    for (const referencedTarget of referencedTargetKeys(operation)) {
      if (targetWasRemoved(referencedTarget, removed)) {
        errors.push(`${prefix} references content removed earlier in the same patch`);
      }
    }

    if (operation.action === 'update_page' && operation.changes?.sections !== undefined) {
      errors.push(`${prefix} cannot replace sections through update_page`);
    }
    if (operation.action === 'update_section') {
      if (operation.changes?.elements !== undefined || operation.changes?.containers !== undefined) {
        errors.push(`${prefix} cannot replace element/container structural arrays through update_section`);
      }

      // V2 Reset Form is an intentional manual operation. It may replace the
      // form-field array atomically, and the resulting project is still fully
      // validated by validateEditorProject before commit. AI/system patches must
      // continue using explicit add/remove/move form-field operations.
      if (operation.changes?.formFields !== undefined && operation.source !== 'manual') {
        errors.push(`${prefix} cannot replace form fields through update_section unless it is a validated manual edit`);
      }
    }
    if (operation.action === 'update_element' && operation.changes?.id !== undefined) {
      errors.push(`${prefix} cannot change element identity`);
    }
    if (operation.action === 'update_element' && operation.changes?.symbolId !== undefined) {
      errors.push(`${prefix} cannot change reusable component linkage through update_element`);
    }

    const removedKey = removedTargetKey(operation);
    if (removedKey) removed.add(removedKey);
  });

  if (destructiveCount > maxDestructive) {
    errors.push(`Patch contains ${destructiveCount} destructive operations; maximum is ${maxDestructive}`);
  } else if (destructiveCount >= Math.max(5, Math.floor(maxDestructive * 0.6))) {
    warnings.push(`Patch contains ${destructiveCount} destructive operations; review before applying`);
  }

  return {
    ok: errors.length === 0,
    errors: errors.slice(0, 50),
    warnings: warnings.slice(0, 50),
    destructiveCount,
  };
}
