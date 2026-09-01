import { createEditorCommand, type EditorCommand } from './editor-command';
import {
  cloneEditorElementIndependent,
  cloneEditorPageIndependent,
  cloneEditorSectionIndependent,
  createEditorCloneIdFactory,
  type EditorCloneIdFactory,
  type EditorCloneKind,
} from './editor-clone';
import {
  editorProjectIdentitySet,
  findEditorElement,
  findEditorPage,
  findEditorSection,
  type EditorElementLike,
  type EditorIdentityKind,
  type EditorPageLike,
  type EditorProjectLike,
  type EditorSectionLike,
} from './editor-model';
import { syncEditorSymbolFromInstance } from './editor-symbols';
import {
  cloneSafeEditorPayload,
  safeEditorPayloadRecord,
} from './editor-payload-safety';

export type EditorInsertPosition = {
  beforeId?: string;
  afterId?: string;
  index?: number;
};

export interface EditorCommandAdapterOptions {
  source?: 'manual' | 'ai' | 'system';
  id?: string;
  coalesceKey?: string;
  coalesceWindowMs?: number;
}

function commandOptions<P>(
  label: string,
  mutate: EditorCommand<P>['mutate'],
  options: EditorCommandAdapterOptions = {},
): EditorCommand<P> {
  return createEditorCommand({
    id: options.id,
    label,
    source: options.source,
    coalesceKey: options.coalesceKey,
    coalesceWindowMs: options.coalesceWindowMs,
    mutate,
  });
}

function normalizedId(value: string, label: string) {
  const id = value.trim();
  if (!id) throw new Error(`${label} ID is required`);
  if (id !== value) throw new Error(`${label} ID cannot contain surrounding whitespace`);
  return id;
}

function targetIndex<T extends { id: string }>(
  items: T[],
  position: EditorInsertPosition,
  movingId?: string,
) {
  const hasBefore = position.beforeId !== undefined;
  const hasAfter = position.afterId !== undefined;
  const hasIndex = position.index !== undefined;
  if ([hasBefore, hasAfter, hasIndex].filter(Boolean).length > 1) {
    throw new Error('Position must use exactly one of beforeId, afterId, or index');
  }

  const withoutMoving = movingId ? items.filter((item) => item.id !== movingId) : items;
  if (hasBefore) {
    const beforeId = normalizedId(position.beforeId || '', 'Target before');
    if (movingId && beforeId === movingId) throw new Error('Move target cannot reference the moving ID');
    const index = withoutMoving.findIndex((item) => item.id === beforeId);
    if (index < 0) throw new Error(`Target before ID not found: ${beforeId}`);
    return index;
  }
  if (hasAfter) {
    const afterId = normalizedId(position.afterId || '', 'Target after');
    if (movingId && afterId === movingId) throw new Error('Move target cannot reference the moving ID');
    const index = withoutMoving.findIndex((item) => item.id === afterId);
    if (index < 0) throw new Error(`Target after ID not found: ${afterId}`);
    return index + 1;
  }
  if (hasIndex) {
    const parsed = Number(position.index);
    if (!Number.isFinite(parsed)) throw new Error('Target index is invalid');
    return Math.max(0, Math.min(withoutMoving.length, Math.round(parsed)));
  }
  return withoutMoving.length;
}

function insertAt<T>(items: T[], value: T, index: number) {
  items.splice(Math.max(0, Math.min(items.length, index)), 0, value);
}

function hasExplicitPosition(position: EditorInsertPosition) {
  return (
    position.beforeId !== undefined ||
    position.afterId !== undefined ||
    position.index !== undefined
  );
}

function mergeWithoutIdentity<T extends { id: string }>(
  target: T,
  changes: Partial<T>,
  blockedKeys: string[] = [],
): T {
  const safeChanges = safeEditorPayloadRecord(
    changes as Record<string, unknown>,
    'editor changes',
  );
  delete safeChanges.id;
  for (const key of blockedKeys) delete safeChanges[key];
  return Object.assign(target, safeChanges);
}

function assertIdentityIdsAvailable<P extends EditorProjectLike>(
  draft: P,
  kind: EditorIdentityKind,
  ids: string[],
  label: string,
) {
  const existing = editorProjectIdentitySet(draft, kind);
  const incoming = new Set<string>();

  for (const rawId of ids) {
    const id = normalizedId(rawId, label);
    if (incoming.has(id)) throw new Error(`Duplicate ${label.toLowerCase()} ID in incoming content: ${id}`);
    if (existing.has(id)) throw new Error(`${label} already exists elsewhere in the project: ${id}`);
    incoming.add(id);
  }
}

function assertIncomingSectionIdentities<P extends EditorProjectLike>(
  draft: P,
  section: EditorSectionLike,
) {
  assertIdentityIdsAvailable(draft, 'section', [section.id], 'Section');
  assertIdentityIdsAvailable(draft, 'element', section.elements.map((element) => element.id), 'Element');
  assertIdentityIdsAvailable(draft, 'container', (section.containers || []).map((container) => container.id), 'Container');
  assertIdentityIdsAvailable(draft, 'form-field', (section.formFields || []).map((field) => field.id), 'Form field');

  const containerIds = new Set((section.containers || []).map((container) => normalizedId(container.id, 'Container')));
  for (const element of section.elements) {
    if (element.containerId && !containerIds.has(normalizedId(element.containerId, 'Container'))) {
      throw new Error(`Container not found for incoming element ${element.id}: ${element.containerId}`);
    }
  }
}

function assertIncomingPageIdentities<P extends EditorProjectLike>(
  draft: P,
  page: EditorPageLike,
) {
  assertIdentityIdsAvailable(draft, 'page', [page.id], 'Page');
  assertIdentityIdsAvailable(draft, 'section', page.sections.map((section) => section.id), 'Section');
  assertIdentityIdsAvailable(
    draft,
    'element',
    page.sections.flatMap((section) => section.elements.map((element) => element.id)),
    'Element',
  );
  assertIdentityIdsAvailable(
    draft,
    'container',
    page.sections.flatMap((section) => (section.containers || []).map((container) => container.id)),
    'Container',
  );
  assertIdentityIdsAvailable(
    draft,
    'form-field',
    page.sections.flatMap((section) => (section.formFields || []).map((field) => field.id)),
    'Form field',
  );

  for (const section of page.sections) {
    const containerIds = new Set((section.containers || []).map((container) => normalizedId(container.id, 'Container')));
    for (const element of section.elements) {
      if (element.containerId && !containerIds.has(normalizedId(element.containerId, 'Container'))) {
        throw new Error(`Container not found for incoming element ${element.id}: ${element.containerId}`);
      }
    }
  }
}

function createCollisionSafeCloneIdFactory<P extends EditorProjectLike>(
  draft: P,
  baseFactory: EditorCloneIdFactory,
): EditorCloneIdFactory {
  const reserved: Record<EditorCloneKind, Set<string>> = {
    page: editorProjectIdentitySet(draft, 'page'),
    section: editorProjectIdentitySet(draft, 'section'),
    element: editorProjectIdentitySet(draft, 'element'),
    container: editorProjectIdentitySet(draft, 'container'),
    'form-field': editorProjectIdentitySet(draft, 'form-field'),
    symbol: editorProjectIdentitySet(draft, 'symbol'),
  };

  return (kind, sourceId) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = normalizedId(baseFactory(kind, sourceId), `${kind} clone`);
      if (!reserved[kind].has(candidate)) {
        reserved[kind].add(candidate);
        return candidate;
      }
    }
    throw new Error(`Could not generate a unique ${kind} clone ID`);
  };
}

export function commandAddPage<P extends EditorProjectLike>(
  page: EditorPageLike,
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Add page', (draft) => {
    const safePage = cloneSafeEditorPayload(page, 'page');
    const id = normalizedId(safePage.id, 'Page');
    assertIncomingPageIdentities(draft, safePage);
    const index = targetIndex(draft.pages, position);
    insertAt(draft.pages, safePage, index);
    if (!draft.homePageId) draft.homePageId = id;
  }, options);
}

export function commandUpdatePage<P extends EditorProjectLike>(
  pageId: string,
  changes: Partial<EditorPageLike>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update page', (draft) => {
    const match = findEditorPage(draft, normalizedId(pageId, 'Page'));
    if (!match) throw new Error(`Page not found: ${pageId}`);
    mergeWithoutIdentity(match.page, changes, ['sections']);
  }, options);
}

export function commandRemovePage<P extends EditorProjectLike>(
  pageId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Remove page', (draft) => {
    const id = normalizedId(pageId, 'Page');
    if (draft.pages.length <= 1) throw new Error('Cannot remove the final page');
    const match = findEditorPage(draft, id);
    if (!match) throw new Error(`Page not found: ${id}`);
    if (draft.homePageId === id) throw new Error('Cannot remove the home page');
    draft.pages.splice(match.index, 1);
  }, options);
}

export function commandMovePage<P extends EditorProjectLike>(
  pageId: string,
  position: EditorInsertPosition,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Move page', (draft) => {
    const id = normalizedId(pageId, 'Page');
    const match = findEditorPage(draft, id);
    if (!match) throw new Error(`Page not found: ${id}`);
    const page = match.page;
    const index = targetIndex(draft.pages, position, id);
    draft.pages.splice(match.index, 1);
    insertAt(draft.pages, page, index);
  }, options);
}

export function commandSetHomePage<P extends EditorProjectLike>(
  pageId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Set home page', (draft) => {
    const id = normalizedId(pageId, 'Page');
    if (!findEditorPage(draft, id)) throw new Error(`Page not found: ${id}`);
    draft.homePageId = id;
  }, options);
}

export function commandAddSection<P extends EditorProjectLike>(
  pageId: string,
  section: EditorSectionLike,
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Add section', (draft) => {
    const pageMatch = findEditorPage(draft, normalizedId(pageId, 'Page'));
    if (!pageMatch) throw new Error(`Page not found: ${pageId}`);
    const safeSection = cloneSafeEditorPayload(section, 'section');
    normalizedId(safeSection.id, 'Section');
    assertIncomingSectionIdentities(draft, safeSection);
    insertAt(pageMatch.page.sections, safeSection, targetIndex(pageMatch.page.sections, position));
  }, options);
}

export function commandUpdateSection<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  changes: Partial<EditorSectionLike>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update section', (draft) => {
    const match = findEditorSection(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
    );
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    mergeWithoutIdentity(match.section, changes, ['elements', 'containers', 'formFields']);
  }, options);
}

export function commandRemoveSection<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Remove section', (draft) => {
    const match = findEditorSection(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
    );
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    if (match.page.sections.length <= 1) throw new Error('Cannot remove the final section on a page');
    match.page.sections.splice(match.index, 1);
  }, options);
}

export function commandMoveSection<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  position: EditorInsertPosition,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Move section', (draft) => {
    const match = findEditorSection(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
    );
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const section = match.section;
    const index = targetIndex(match.page.sections, position, section.id);
    match.page.sections.splice(match.index, 1);
    insertAt(match.page.sections, section, index);
  }, options);
}

export function commandAddElement<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  element: EditorElementLike,
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Add element', (draft) => {
    const match = findEditorSection(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
    );
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const safeElement = cloneSafeEditorPayload(element, 'element');
    normalizedId(safeElement.id, 'Element');
    assertIdentityIdsAvailable(draft, 'element', [safeElement.id], 'Element');

    if (
      safeElement.containerId &&
      !match.section.containers?.some(
        (container) => container.id === safeElement.containerId,
      )
    ) {
      throw new Error(`Container not found: ${safeElement.containerId}`);
    }

    insertAt(match.section.elements, safeElement, targetIndex(match.section.elements, position));
  }, options);
}

export function commandUpdateElement<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  changes: Partial<EditorElementLike>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update element', (draft) => {
    const match = findEditorElement(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
      normalizedId(elementId, 'Element'),
    );
    if (!match) throw new Error(`Element not found: ${elementId}`);
    const symbolId = match.element.symbolId;
    mergeWithoutIdentity(match.element, changes, ['symbolId']);
    if (symbolId) syncEditorSymbolFromInstance(draft, symbolId, match.element);
  }, options);
}

export function commandRemoveElement<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Remove element', (draft) => {
    const match = findEditorElement(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
      normalizedId(elementId, 'Element'),
    );
    if (!match) throw new Error(`Element not found: ${elementId}`);
    if (match.element.symbolId) throw new Error('Detach reusable component before removing this element');
    if (match.section.elements.length <= 1) throw new Error('Cannot remove the final element from a section');
    match.section.elements.splice(match.elementIndex, 1);
  }, options);
}

export function commandMoveElement<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  position: EditorInsertPosition,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Move element', (draft) => {
    const match = findEditorElement(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
      normalizedId(elementId, 'Element'),
    );
    if (!match) throw new Error(`Element not found: ${elementId}`);
    if (match.element.symbolId) throw new Error('Detach reusable component before moving this element');
    const element = match.element;
    const index = targetIndex(match.section.elements, position, element.id);
    match.section.elements.splice(match.elementIndex, 1);
    insertAt(match.section.elements, element, index);
  }, options);
}

export function commandUpdateTheme<P extends EditorProjectLike>(
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update theme', (draft) => {
    const safeChanges = safeEditorPayloadRecord(changes, 'theme changes');
    draft.theme = { ...(draft.theme || {}), ...safeChanges };
  }, options);
}

export function commandUpdateSeo<P extends EditorProjectLike>(
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update SEO', (draft) => {
    const safeChanges = safeEditorPayloadRecord(changes, 'SEO changes');
    draft.seo = { ...(draft.seo || {}), ...safeChanges };
  }, options);
}

export function commandUpdateHeader<P extends EditorProjectLike>(
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update header', (draft) => {
    const safeChanges = safeEditorPayloadRecord(changes, 'header changes');
    draft.headerConfig = { ...(draft.headerConfig || {}), ...safeChanges };
  }, options);
}

export function commandAddContainer<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  container: { id: string; [key: string]: unknown },
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Add container', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const safeContainer = cloneSafeEditorPayload(container, 'container');
    normalizedId(safeContainer.id, 'Container');
    assertIdentityIdsAvailable(draft, 'container', [safeContainer.id], 'Container');
    const containers = match.section.containers || (match.section.containers = []);
    containers.push(safeContainer);
  }, options);
}

export function commandUpdateContainer<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  containerId: string,
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update container', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const id = normalizedId(containerId, 'Container');
    const container = match.section.containers?.find((candidate) => candidate.id === id);
    if (!container) throw new Error(`Container not found: ${id}`);
    const safeChanges = safeEditorPayloadRecord(changes, 'container changes');
    delete safeChanges.id;
    Object.assign(container, safeChanges);
  }, options);
}

export function commandRemoveContainer<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  containerId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Remove container', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const id = normalizedId(containerId, 'Container');
    const containers = match.section.containers || [];
    const index = containers.findIndex((candidate) => candidate.id === id);
    if (index < 0) throw new Error(`Container not found: ${id}`);
    if (match.section.elements.some((element) => element.containerId === id)) {
      throw new Error('Cannot remove a container while elements are assigned to it');
    }
    containers.splice(index, 1);
  }, options);
}

export function commandAssignElementContainer<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  containerId: string | undefined,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Assign element container', (draft) => {
    const match = findEditorElement(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
      normalizedId(elementId, 'Element'),
    );
    if (!match) throw new Error(`Element not found: ${elementId}`);
    if (containerId) {
      const id = normalizedId(containerId, 'Container');
      if (!match.section.containers?.some((container) => container.id === id)) {
        throw new Error(`Container not found: ${id}`);
      }
      match.element.containerId = id;
    } else {
      delete match.element.containerId;
    }
  }, options);
}

export function commandAddFormField<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  field: { id: string; [key: string]: unknown },
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Add form field', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const safeField = cloneSafeEditorPayload(field, 'form field');
    normalizedId(safeField.id, 'Form field');
    assertIdentityIdsAvailable(draft, 'form-field', [safeField.id], 'Form field');
    const fields = match.section.formFields || (match.section.formFields = []);
    insertAt(fields, safeField, targetIndex(fields, position));
  }, options);
}

export function commandUpdateFormField<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  fieldId: string,
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Update form field', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const id = normalizedId(fieldId, 'Form field');
    const field = match.section.formFields?.find((candidate) => candidate.id === id);
    if (!field) throw new Error(`Form field not found: ${id}`);
    const safeChanges = safeEditorPayloadRecord(changes, 'form-field changes');
    delete safeChanges.id;
    Object.assign(field, safeChanges);
  }, options);
}

export function commandRemoveFormField<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  fieldId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Remove form field', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const fields = match.section.formFields || [];
    if (fields.length <= 1) throw new Error('Cannot remove the final form field');
    const id = normalizedId(fieldId, 'Form field');
    const index = fields.findIndex((candidate) => candidate.id === id);
    if (index < 0) throw new Error(`Form field not found: ${id}`);
    fields.splice(index, 1);
  }, options);
}

export function commandMoveFormField<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  fieldId: string,
  position: EditorInsertPosition,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Move form field', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const fields = match.section.formFields || [];
    const id = normalizedId(fieldId, 'Form field');
    const index = fields.findIndex((candidate) => candidate.id === id);
    if (index < 0) throw new Error(`Form field not found: ${id}`);
    const field = fields[index];
    const target = targetIndex(fields, position, id);
    fields.splice(index, 1);
    insertAt(fields, field, target);
  }, options);
}


export function commandDuplicatePage<P extends EditorProjectLike>(
  pageId: string,
  changes: Partial<EditorPageLike> = {},
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions & { idFactory?: EditorCloneIdFactory } = {},
) {
  return commandOptions<P>('Duplicate page', (draft) => {
    const match = findEditorPage(draft, normalizedId(pageId, 'Page'));
    if (!match) throw new Error(`Page not found: ${pageId}`);
    const idFactory = createCollisionSafeCloneIdFactory(
      draft,
      options.idFactory || createEditorCloneIdFactory('duplicate'),
    );
    const clone = cloneEditorPageIndependent(match.page, idFactory);
    mergeWithoutIdentity(clone, changes, ['sections']);
    const index = hasExplicitPosition(position)
      ? targetIndex(draft.pages, position)
      : match.index + 1;
    insertAt(draft.pages, clone, index);
  }, options);
}

export function commandDuplicateSection<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  changes: Partial<EditorSectionLike> = {},
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions & { idFactory?: EditorCloneIdFactory } = {},
) {
  return commandOptions<P>('Duplicate section', (draft) => {
    const match = findEditorSection(draft, normalizedId(pageId, 'Page'), normalizedId(sectionId, 'Section'));
    if (!match) throw new Error(`Section not found: ${sectionId}`);
    const idFactory = createCollisionSafeCloneIdFactory(
      draft,
      options.idFactory || createEditorCloneIdFactory('duplicate'),
    );
    const clone = cloneEditorSectionIndependent(match.section, idFactory);
    mergeWithoutIdentity(clone, changes, ['elements', 'containers', 'formFields']);
    const index = hasExplicitPosition(position)
      ? targetIndex(match.page.sections, position)
      : match.index + 1;
    insertAt(match.page.sections, clone, index);
  }, options);
}

export function commandDuplicateElement<P extends EditorProjectLike>(
  pageId: string,
  sectionId: string,
  elementId: string,
  changes: Partial<EditorElementLike> = {},
  position: EditorInsertPosition = {},
  options: EditorCommandAdapterOptions & { idFactory?: EditorCloneIdFactory } = {},
) {
  return commandOptions<P>('Duplicate element', (draft) => {
    const match = findEditorElement(
      draft,
      normalizedId(pageId, 'Page'),
      normalizedId(sectionId, 'Section'),
      normalizedId(elementId, 'Element'),
    );
    if (!match) throw new Error(`Element not found: ${elementId}`);
    const idFactory = createCollisionSafeCloneIdFactory(
      draft,
      options.idFactory || createEditorCloneIdFactory('duplicate'),
    );
    const clone = cloneEditorElementIndependent(match.element, idFactory);
    mergeWithoutIdentity(clone, changes, ['symbolId', 'containerId']);
    const index = hasExplicitPosition(position)
      ? targetIndex(match.section.elements, position)
      : match.elementIndex + 1;
    insertAt(match.section.elements, clone, index);
  }, options);
}
