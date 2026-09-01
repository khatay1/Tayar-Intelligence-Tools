import type { EditorNativeOperation, EditorNativeOperationAction } from './editor-native-operation';
import type { EditorProjectLike } from './editor-model';

export interface EditorOperationPreflightOptions {
  maxOperations?: number;
  maxDestructiveOperations?: number;
  project?: EditorProjectLike;
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

type NativeReferenceKind = 'page' | 'section' | 'element' | 'container' | 'form-field' | 'symbol';

type NativeScopedLocation = {
  pageId: string;
  sectionId?: string;
};

interface NativeReferenceState {
  pages: Set<string>;
  sections: Map<string, NativeScopedLocation>;
  elements: Map<string, NativeScopedLocation>;
  containers: Map<string, NativeScopedLocation>;
  formFields: Map<string, NativeScopedLocation>;
  symbols: Set<string>;
}

interface NativeReferenceEntry {
  kind: NativeReferenceKind;
  id: string | undefined;
  label: string;
  pageId?: string;
  sectionId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasValidId(value: unknown) {
  return typeof value === 'string' && Boolean(value.trim()) && value === value.trim();
}

function validateIdValue(value: unknown, label: string, prefix: string, errors: string[]) {
  if (!hasValidId(value)) {
    errors.push(`${prefix} ${label} must be a non-blank ID without surrounding whitespace`);
    return false;
  }
  return true;
}

function validateElementPayload(value: unknown, prefix: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${prefix} element must be an object`);
    return false;
  }

  let ok = validateIdValue(value.id, 'element.id', prefix, errors);
  if (value.containerId !== undefined && !validateIdValue(value.containerId, 'element.containerId', prefix, errors)) {
    ok = false;
  }
  if (value.symbolId !== undefined && !validateIdValue(value.symbolId, 'element.symbolId', prefix, errors)) {
    ok = false;
  }
  return ok;
}

function validateContainerPayload(value: unknown, prefix: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${prefix} container must be an object`);
    return false;
  }
  return validateIdValue(value.id, 'container.id', prefix, errors);
}

function validateFormFieldPayload(value: unknown, prefix: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${prefix} formField must be an object`);
    return false;
  }
  return validateIdValue(value.id, 'formField.id', prefix, errors);
}

function validateSectionPayload(value: unknown, prefix: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${prefix} section must be an object`);
    return false;
  }

  let ok = validateIdValue(value.id, 'section.id', prefix, errors);
  if (!Array.isArray(value.elements) || value.elements.length === 0) {
    errors.push(`${prefix} section.elements must be a non-empty array`);
    ok = false;
  } else {
    value.elements.forEach((element, index) => {
      if (!validateElementPayload(element, `${prefix} section.elements[${index}]`, errors)) ok = false;
    });
  }

  if (value.containers !== undefined) {
    if (!Array.isArray(value.containers)) {
      errors.push(`${prefix} section.containers must be an array when provided`);
      ok = false;
    } else {
      value.containers.forEach((container, index) => {
        if (!validateContainerPayload(container, `${prefix} section.containers[${index}]`, errors)) ok = false;
      });
    }
  }

  if (value.formFields !== undefined) {
    if (!Array.isArray(value.formFields)) {
      errors.push(`${prefix} section.formFields must be an array when provided`);
      ok = false;
    } else {
      value.formFields.forEach((field, index) => {
        if (!validateFormFieldPayload(field, `${prefix} section.formFields[${index}]`, errors)) ok = false;
      });
    }
  }

  if (ok) {
    const containerIds = new Set(
      (Array.isArray(value.containers) ? value.containers : [])
        .filter(isRecord)
        .map((container) => container.id)
        .filter((id): id is string => typeof id === 'string'),
    );
    for (const element of value.elements as Array<Record<string, unknown>>) {
      if (typeof element.containerId === 'string' && !containerIds.has(element.containerId)) {
        errors.push(`${prefix} element ${String(element.id)} references missing container ${element.containerId}`);
        ok = false;
      }
    }
  }

  return ok;
}

function validatePagePayload(value: unknown, prefix: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${prefix} page must be an object`);
    return false;
  }

  let ok = validateIdValue(value.id, 'page.id', prefix, errors);
  if (!Array.isArray(value.sections) || value.sections.length === 0) {
    errors.push(`${prefix} page.sections must be a non-empty array`);
    return false;
  }

  value.sections.forEach((section, index) => {
    if (!validateSectionPayload(section, `${prefix} page.sections[${index}]`, errors)) ok = false;
  });
  return ok;
}

function validateOperationPayloadShape(
  operation: EditorNativeOperation,
  prefix: string,
  errors: string[],
) {
  let ok = true;

  for (const [label, value] of [
    ['pageId', operation.pageId],
    ['sectionId', operation.sectionId],
    ['elementId', operation.elementId],
    ['containerId', operation.containerId],
    ['formFieldId', operation.formFieldId],
    ['symbolId', operation.symbolId],
    ['sourceElementId', operation.sourceElementId],
    ['sourceSectionId', operation.sourceSectionId],
  ] as const) {
    if (value !== undefined && !validateIdValue(value, label, prefix, errors)) ok = false;
  }

  if (operation.changes !== undefined && !isRecord(operation.changes)) {
    errors.push(`${prefix} changes must be an object when provided`);
    ok = false;
  }

  if (operation.position !== undefined && !isRecord(operation.position)) {
    errors.push(`${prefix} position must be an object when provided`);
    ok = false;
  }

  if (operation.action === 'add_page') {
    if (!validatePagePayload(operation.page, prefix, errors)) ok = false;
  }
  if (operation.action === 'add_section') {
    if (!validateSectionPayload(operation.section, prefix, errors)) ok = false;
  }
  if (operation.action === 'add_element') {
    if (!validateElementPayload(operation.element, prefix, errors)) ok = false;
  }
  if (operation.action === 'add_container') {
    if (!validateContainerPayload(operation.container, prefix, errors)) ok = false;
  }
  if (operation.action === 'add_form_field') {
    if (!validateFormFieldPayload(operation.formField, prefix, errors)) ok = false;
  }

  if (
    operation.action === 'update_section' &&
    isRecord(operation.changes) &&
    operation.changes.formFields !== undefined
  ) {
    if (!Array.isArray(operation.changes.formFields)) {
      errors.push(`${prefix} changes.formFields must be an array when provided`);
      ok = false;
    } else {
      operation.changes.formFields.forEach((field, index) => {
        if (!validateFormFieldPayload(field, `${prefix} changes.formFields[${index}]`, errors)) ok = false;
      });
    }
  }

  return ok;
}

function createReferenceState(project?: EditorProjectLike): NativeReferenceState {
  const state: NativeReferenceState = {
    pages: new Set<string>(),
    sections: new Map<string, NativeScopedLocation>(),
    elements: new Map<string, NativeScopedLocation>(),
    containers: new Map<string, NativeScopedLocation>(),
    formFields: new Map<string, NativeScopedLocation>(),
    symbols: new Set<string>(),
  };

  if (!project || !Array.isArray(project.pages)) return state;

  for (const page of project.pages) {
    if (!page || typeof page.id !== 'string') continue;
    state.pages.add(page.id);
    for (const section of Array.isArray(page.sections) ? page.sections : []) {
      if (!section || typeof section.id !== 'string') continue;
      state.sections.set(section.id, { pageId: page.id });
      for (const element of Array.isArray(section.elements) ? section.elements : []) {
        if (element && typeof element.id === 'string') {
          state.elements.set(element.id, { pageId: page.id, sectionId: section.id });
        }
      }
      for (const container of Array.isArray(section.containers) ? section.containers : []) {
        if (container && typeof container.id === 'string') {
          state.containers.set(container.id, { pageId: page.id, sectionId: section.id });
        }
      }
      for (const field of Array.isArray(section.formFields) ? section.formFields : []) {
        if (field && typeof field.id === 'string') {
          state.formFields.set(field.id, { pageId: page.id, sectionId: section.id });
        }
      }
    }
  }

  for (const symbol of Array.isArray(project.symbols) ? project.symbols : []) {
    if (symbol && typeof symbol.id === 'string') state.symbols.add(symbol.id);
  }

  return state;
}

function identityKey(kind: NativeReferenceKind, id: string) {
  return `${kind}:${id}`;
}

function reservedIdentityKeys(state: NativeReferenceState) {
  const keys = new Set<string>();
  for (const id of state.pages) keys.add(identityKey('page', id));
  for (const id of state.sections.keys()) keys.add(identityKey('section', id));
  for (const id of state.elements.keys()) keys.add(identityKey('element', id));
  for (const id of state.containers.keys()) keys.add(identityKey('container', id));
  for (const id of state.formFields.keys()) keys.add(identityKey('form-field', id));
  for (const id of state.symbols) keys.add(identityKey('symbol', id));
  return keys;
}

function referenceExists(state: NativeReferenceState, reference: NativeReferenceEntry) {
  const id = reference.id;
  if (!id) return false;

  if (reference.kind === 'page') return state.pages.has(id);
  if (reference.kind === 'symbol') return state.symbols.has(id);

  const map =
    reference.kind === 'section'
      ? state.sections
      : reference.kind === 'element'
        ? state.elements
        : reference.kind === 'container'
          ? state.containers
          : state.formFields;
  const location = map.get(id);
  if (!location) return false;
  if (reference.pageId && location.pageId !== reference.pageId) return false;
  if (reference.sectionId && location.sectionId !== reference.sectionId) return false;
  return true;
}

function validateReference(
  state: NativeReferenceState,
  reference: NativeReferenceEntry,
  prefix: string,
  errors: string[],
) {
  if (!validateIdValue(reference.id, reference.label, prefix, errors)) return;
  if (!referenceExists(state, reference)) {
    errors.push(`${prefix} references missing or out-of-scope ${reference.label}: ${reference.id}`);
  }
}

function pushScopedReferences(
  references: NativeReferenceEntry[],
  operation: EditorNativeOperation,
  kinds: Array<NativeReferenceKind>,
) {
  const pageId = operation.pageId;
  const sectionId = operation.sectionId;

  if (kinds.includes('page')) {
    references.push({ kind: 'page', id: pageId, label: 'pageId' });
  }
  if (kinds.includes('section')) {
    references.push({ kind: 'section', id: sectionId, label: 'sectionId', pageId });
  }
  if (kinds.includes('element')) {
    references.push({ kind: 'element', id: operation.elementId, label: 'elementId', pageId, sectionId });
  }
  if (kinds.includes('container')) {
    references.push({ kind: 'container', id: operation.containerId, label: 'containerId', pageId, sectionId });
  }
  if (kinds.includes('form-field')) {
    references.push({ kind: 'form-field', id: operation.formFieldId, label: 'formFieldId', pageId, sectionId });
  }
}

function operationReferenceEntries(operation: EditorNativeOperation) {
  const references: NativeReferenceEntry[] = [];

  switch (operation.action) {
    case 'add_page':
      for (const section of operation.page?.sections || []) {
        for (const element of section.elements || []) {
          if (element.symbolId) {
            references.push({ kind: 'symbol', id: element.symbolId, label: 'page element symbolId' });
          }
        }
      }
      break;
    case 'duplicate_page':
    case 'update_page':
    case 'remove_page':
    case 'move_page':
    case 'set_home_page':
      pushScopedReferences(references, operation, ['page']);
      break;
    case 'add_section':
      pushScopedReferences(references, operation, ['page']);
      for (const element of operation.section?.elements || []) {
        if (element.symbolId) {
          references.push({ kind: 'symbol', id: element.symbolId, label: 'section element symbolId' });
        }
      }
      break;
    case 'duplicate_section':
    case 'update_section':
    case 'remove_section':
    case 'move_section':
      pushScopedReferences(references, operation, ['page', 'section']);
      break;
    case 'add_element':
      pushScopedReferences(references, operation, ['page', 'section']);
      if (operation.element?.containerId) {
        references.push({
          kind: 'container',
          id: operation.element.containerId,
          label: 'element.containerId',
          pageId: operation.pageId,
          sectionId: operation.sectionId,
        });
      }
      if (operation.element?.symbolId) {
        references.push({ kind: 'symbol', id: operation.element.symbolId, label: 'element.symbolId' });
      }
      break;
    case 'duplicate_element':
    case 'update_element':
    case 'remove_element':
    case 'move_element':
    case 'create_symbol':
    case 'detach_symbol':
      pushScopedReferences(references, operation, ['page', 'section', 'element']);
      break;
    case 'add_container':
      pushScopedReferences(references, operation, ['page', 'section']);
      break;
    case 'update_container':
    case 'remove_container':
      pushScopedReferences(references, operation, ['page', 'section', 'container']);
      break;
    case 'assign_element_container':
      pushScopedReferences(references, operation, ['page', 'section', 'element']);
      if (operation.containerId !== undefined) {
        references.push({
          kind: 'container',
          id: operation.containerId,
          label: 'containerId',
          pageId: operation.pageId,
          sectionId: operation.sectionId,
        });
      }
      break;
    case 'add_form_field':
      pushScopedReferences(references, operation, ['page', 'section']);
      break;
    case 'update_form_field':
    case 'remove_form_field':
    case 'move_form_field':
      pushScopedReferences(references, operation, ['page', 'section', 'form-field']);
      break;
    case 'insert_symbol':
      pushScopedReferences(references, operation, ['page', 'section']);
      references.push({ kind: 'symbol', id: operation.symbolId, label: 'symbolId' });
      break;
    case 'copy_element_style':
      pushScopedReferences(references, operation, ['page', 'section', 'element']);
      references.push({ kind: 'element', id: operation.sourceElementId, label: 'sourceElementId' });
      break;
    case 'copy_section_style':
      pushScopedReferences(references, operation, ['page', 'section']);
      references.push({ kind: 'section', id: operation.sourceSectionId, label: 'sourceSectionId' });
      break;
    case 'repair_responsive':
    case 'repair_accessibility':
      if (operation.pageId !== undefined) pushScopedReferences(references, operation, ['page']);
      break;
    default:
      break;
  }

  const anchorId = operation.position?.beforeId ?? operation.position?.afterId;
  if (anchorId) {
    if (operation.action === 'add_page' || operation.action === 'duplicate_page' || operation.action === 'move_page') {
      references.push({ kind: 'page', id: anchorId, label: 'position target' });
    } else if (
      operation.action === 'add_section' ||
      operation.action === 'duplicate_section' ||
      operation.action === 'move_section'
    ) {
      references.push({ kind: 'section', id: anchorId, label: 'position target', pageId: operation.pageId });
    } else if (
      operation.action === 'add_element' ||
      operation.action === 'duplicate_element' ||
      operation.action === 'move_element' ||
      operation.action === 'insert_symbol'
    ) {
      references.push({
        kind: 'element',
        id: anchorId,
        label: 'position target',
        pageId: operation.pageId,
        sectionId: operation.sectionId,
      });
    } else if (operation.action === 'add_form_field' || operation.action === 'move_form_field') {
      references.push({
        kind: 'form-field',
        id: anchorId,
        label: 'position target',
        pageId: operation.pageId,
        sectionId: operation.sectionId,
      });
    }
  }

  return references;
}

function removeSectionFromState(state: NativeReferenceState, sectionId: string) {
  state.sections.delete(sectionId);
  for (const [id, location] of [...state.elements.entries()]) {
    if (location.sectionId === sectionId) state.elements.delete(id);
  }
  for (const [id, location] of [...state.containers.entries()]) {
    if (location.sectionId === sectionId) state.containers.delete(id);
  }
  for (const [id, location] of [...state.formFields.entries()]) {
    if (location.sectionId === sectionId) state.formFields.delete(id);
  }
}

function removePageFromState(state: NativeReferenceState, pageId: string) {
  state.pages.delete(pageId);
  for (const [sectionId, location] of [...state.sections.entries()]) {
    if (location.pageId === pageId) removeSectionFromState(state, sectionId);
  }
}

function applyOperationToReferenceState(operation: EditorNativeOperation, state: NativeReferenceState) {
  if (operation.action === 'remove_page' && operation.pageId) {
    removePageFromState(state, operation.pageId);
    return;
  }
  if (operation.action === 'remove_section' && operation.sectionId) {
    removeSectionFromState(state, operation.sectionId);
    return;
  }
  if (operation.action === 'remove_element' && operation.elementId) {
    state.elements.delete(operation.elementId);
    return;
  }
  if (operation.action === 'remove_container' && operation.containerId) {
    state.containers.delete(operation.containerId);
    return;
  }
  if (operation.action === 'remove_form_field' && operation.formFieldId) {
    state.formFields.delete(operation.formFieldId);
    return;
  }

  if (operation.action === 'add_page' && operation.page) {
    state.pages.add(operation.page.id);
    for (const section of operation.page.sections || []) {
      state.sections.set(section.id, { pageId: operation.page.id });
      for (const element of section.elements || []) {
        state.elements.set(element.id, { pageId: operation.page.id, sectionId: section.id });
      }
      for (const container of section.containers || []) {
        state.containers.set(container.id, { pageId: operation.page.id, sectionId: section.id });
      }
      for (const field of section.formFields || []) {
        state.formFields.set(field.id, { pageId: operation.page.id, sectionId: section.id });
      }
    }
    return;
  }

  if (operation.action === 'add_section' && operation.section && operation.pageId) {
    state.sections.set(operation.section.id, { pageId: operation.pageId });
    for (const element of operation.section.elements || []) {
      state.elements.set(element.id, { pageId: operation.pageId, sectionId: operation.section.id });
    }
    for (const container of operation.section.containers || []) {
      state.containers.set(container.id, { pageId: operation.pageId, sectionId: operation.section.id });
    }
    for (const field of operation.section.formFields || []) {
      state.formFields.set(field.id, { pageId: operation.pageId, sectionId: operation.section.id });
    }
    return;
  }

  if (operation.action === 'add_element' && operation.element && operation.pageId && operation.sectionId) {
    state.elements.set(operation.element.id, { pageId: operation.pageId, sectionId: operation.sectionId });
    return;
  }
  if (operation.action === 'add_container' && operation.container && operation.pageId && operation.sectionId) {
    state.containers.set(operation.container.id, { pageId: operation.pageId, sectionId: operation.sectionId });
    return;
  }
  if (operation.action === 'add_form_field' && operation.formField && operation.pageId && operation.sectionId) {
    state.formFields.set(operation.formField.id, { pageId: operation.pageId, sectionId: operation.sectionId });
    return;
  }
  if (operation.action === 'create_symbol' && operation.symbolId) {
    state.symbols.add(operation.symbolId);
  }
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

function positionTargetKey(operation: EditorNativeOperation, targetId: string) {
  if (
    operation.action === 'add_page' ||
    operation.action === 'duplicate_page' ||
    operation.action === 'move_page'
  ) {
    return `page:${targetId}`;
  }
  if (
    operation.action === 'add_section' ||
    operation.action === 'duplicate_section' ||
    operation.action === 'move_section'
  ) {
    return `section:${operation.pageId || ''}:${targetId}`;
  }
  if (
    operation.action === 'add_element' ||
    operation.action === 'duplicate_element' ||
    operation.action === 'move_element' ||
    operation.action === 'insert_symbol'
  ) {
    return `element:${operation.pageId || ''}:${operation.sectionId || ''}:${targetId}`;
  }
  if (
    operation.action === 'add_form_field' ||
    operation.action === 'move_form_field'
  ) {
    return `form-field:${operation.pageId || ''}:${operation.sectionId || ''}:${targetId}`;
  }
  return undefined;
}

function movingIdentity(operation: EditorNativeOperation) {
  if (operation.action === 'move_page') return operation.pageId;
  if (operation.action === 'move_section') return operation.sectionId;
  if (operation.action === 'move_element') return operation.elementId;
  if (operation.action === 'move_form_field') return operation.formFieldId;
  return undefined;
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

  if (
    operation.action === 'add_element' &&
    operation.element?.containerId
  ) {
    targets.push(
      `container:${operation.pageId || ''}:${operation.sectionId || ''}:${operation.element.containerId}`,
    );
  }

  for (const targetId of [operation.position?.beforeId, operation.position?.afterId]) {
    if (!targetId) continue;
    const positionTarget = positionTargetKey(operation, targetId);
    if (positionTarget) targets.push(positionTarget);
  }

  return targets;
}

type CreatedIdentityKind = 'page' | 'section' | 'element' | 'container' | 'form-field' | 'symbol';

function createdIdentityEntries(operation: EditorNativeOperation) {
  const entries: Array<{ kind: CreatedIdentityKind; id: string }> = [];
  const push = (kind: CreatedIdentityKind, id: string | undefined) => {
    if (id !== undefined) entries.push({ kind, id });
  };

  if (operation.action === 'add_page' && operation.page) {
    push('page', operation.page.id);
    for (const section of operation.page.sections || []) {
      push('section', section.id);
      for (const element of section.elements || []) push('element', element.id);
      for (const container of section.containers || []) push('container', container.id);
      for (const field of section.formFields || []) push('form-field', field.id);
    }
  }

  if (operation.action === 'add_section' && operation.section) {
    push('section', operation.section.id);
    for (const element of operation.section.elements || []) push('element', element.id);
    for (const container of operation.section.containers || []) push('container', container.id);
    for (const field of operation.section.formFields || []) push('form-field', field.id);
  }

  if (operation.action === 'add_element' && operation.element) push('element', operation.element.id);
  if (operation.action === 'add_container' && operation.container) push('container', operation.container.id);
  if (operation.action === 'add_form_field' && operation.formField) push('form-field', operation.formField.id);
  if (operation.action === 'create_symbol' && operation.symbolId !== undefined) push('symbol', operation.symbolId);

  return entries;
}

function validatePosition(operation: EditorNativeOperation, prefix: string, errors: string[]) {
  const position = operation.position;
  if (!position) return;

  const hasBefore = position.beforeId !== undefined;
  const hasAfter = position.afterId !== undefined;
  const hasIndex = position.index !== undefined;
  if ([hasBefore, hasAfter, hasIndex].filter(Boolean).length > 1) {
    errors.push(`${prefix} position must use exactly one of beforeId, afterId, or index`);
    return;
  }

  const anchor = hasBefore ? position.beforeId : hasAfter ? position.afterId : undefined;
  if (anchor !== undefined) {
    if (!anchor.trim()) {
      errors.push(`${prefix} position target ID cannot be blank`);
      return;
    }
    const movingId = movingIdentity(operation)?.trim();
    if (movingId && movingId === anchor.trim()) {
      errors.push(`${prefix} cannot position content relative to itself`);
    }
  }

  if (hasIndex && !Number.isFinite(Number(position.index))) {
    errors.push(`${prefix} position index is invalid`);
  }
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
  const created = new Map<string, number>();
  const referenceState = createReferenceState(options.project);
  const reserved = reservedIdentityKeys(referenceState);
  let destructiveCount = 0;

  if (operations.length > maxOperations) {
    errors.push(`Patch contains ${operations.length} operations; maximum is ${maxOperations}`);
  }

  operations.slice(0, maxOperations).forEach((operation, index) => {
    const rawOperation = operation as unknown;
    if (!isRecord(rawOperation)) {
      errors.push(`Operation ${index + 1} must be an object`);
      return;
    }

    const prefix = `Operation ${index + 1} (${String(rawOperation.action || 'invalid')})`;
    const operationErrorStart = errors.length;
    if (DESTRUCTIVE_ACTIONS.has(operation.action)) destructiveCount += 1;

    if (!validateOperationPayloadShape(operation, prefix, errors)) return;
    validatePosition(operation, prefix, errors);

    if (options.project) {
      for (const reference of operationReferenceEntries(operation)) {
        validateReference(referenceState, reference, prefix, errors);
      }
    }

    for (const entry of createdIdentityEntries(operation)) {
      const id = entry.id.trim();
      if (!id) {
        errors.push(`${prefix} creates a blank ${entry.kind} ID`);
        continue;
      }
      if (id !== entry.id) {
        errors.push(`${prefix} creates a ${entry.kind} ID with surrounding whitespace: ${entry.id}`);
        continue;
      }
      const key = identityKey(entry.kind, id);
      const firstIndex = created.get(key);
      if (reserved.has(key)) {
        errors.push(
          firstIndex !== undefined
            ? `${prefix} creates duplicate ${entry.kind} ID ${id}; already created by operation ${firstIndex + 1}`
            : `${prefix} reuses existing or previously reserved ${entry.kind} ID ${id}`,
        );
      } else {
        reserved.add(key);
        created.set(key, index);
      }
    }

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
    if (operation.action === 'update_page' && operation.changes?.id !== undefined) {
      errors.push(`${prefix} cannot change page identity`);
    }
    if (operation.action === 'update_section' && operation.changes?.id !== undefined) {
      errors.push(`${prefix} cannot change section identity`);
    }
    if (operation.action === 'update_container' && operation.changes?.id !== undefined) {
      errors.push(`${prefix} cannot change container identity`);
    }
    if (operation.action === 'update_form_field' && operation.changes?.id !== undefined) {
      errors.push(`${prefix} cannot change form-field identity`);
    }
    if (operation.action === 'update_element' && operation.changes?.id !== undefined) {
      errors.push(`${prefix} cannot change element identity`);
    }
    if (operation.action === 'update_element' && operation.changes?.symbolId !== undefined) {
      errors.push(`${prefix} cannot change reusable component linkage through update_element`);
    }
    if (
      operation.action === 'update_element' &&
      operation.changes &&
      Object.prototype.hasOwnProperty.call(operation.changes, 'containerId')
    ) {
      errors.push(`${prefix} cannot change container assignment through update_element; use assign_element_container`);
    }

    if (errors.length === operationErrorStart) {
      const removedKey = removedTargetKey(operation);
      if (removedKey) removed.add(removedKey);
      applyOperationToReferenceState(operation, referenceState);
    }
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
