import type { EditorNativeOperation } from './editor-native-operation';

export interface LegacyAIEditorOperationLike {
  action: string;
  changes?: unknown;
}

export interface LegacyAIPageOperationLike
  extends LegacyAIEditorOperationLike {
  pageId?: string;
  pageSlug?: string;
  beforePageId?: string;
  afterPageId?: string;
}

export interface LegacyAIStructuralOperationLike
  extends LegacyAIPageOperationLike {
  sectionId?: string;
  elementId?: string;
  beforeSectionId?: string;
  afterSectionId?: string;
  beforeElementId?: string;
  afterElementId?: string;
  containerId?: string;
  formFieldId?: string;
  formFieldType?: string;
  beforeFormFieldId?: string;
  afterFormFieldId?: string;
}

export interface LegacyAIStructuralNativeContext {
  pageId: string;
  sectionId: string;
  detachElementIds?: string[];
}

export interface LegacyAIUpdateNativeContext {
  pageId: string;
  sectionId: string;
  sectionColumns?: number;
  sectionIsStack?: boolean;
  currentFormField?: Record<string, unknown>;
}

export interface LegacyAIAddNativeContext {
  pageId: string;
  sectionId: string;
  generatedId: string;
  sectionColumns?: number;
  sectionIsStack?: boolean;
  existingContainerCount?: number;
  assignElementId?: string;
  existingFormFieldNames?: string[];
  existingFormFieldIds?: string[];
}

const GLOBAL_NATIVE_AI_ACTIONS = new Set([
  'update_theme',
  'update_seo',
  'update_header',
]);

const PAGE_NATIVE_AI_ACTIONS = new Set([
  'remove_page',
  'set_home_page',
  'move_page',
]);

const STRUCTURAL_NATIVE_AI_ACTIONS = new Set([
  'remove_section',
  'move_section',
  'remove_element',
  'move_element',
  'remove_container',
  'assign_element_container',
  'detach_symbol',
  'remove_form_field',
  'move_form_field',
]);

const UPDATE_NATIVE_AI_ACTIONS = new Set([
  'update_container',
  'update_form',
  'update_form_field',
]);

const ALLOWED_SHADOWS = new Set([
  'none',
  'sm',
  'md',
  'lg',
  'xl',
]);

const ALLOWED_FORM_FIELD_TYPES = new Set([
  'text',
  'email',
  'tel',
  'textarea',
  'select',
  'checkbox',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

function finiteNumber(
  value: unknown,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(min, Math.min(max, parsed));
}

function finiteLegacyNumber(
  value: unknown,
  min: number,
  max: number,
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return undefined;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizedFormFieldName(
  value: string,
  fallback = 'field',
) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function text(
  value: unknown,
  maxLength: number,
  allowEmpty = true,
) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, maxLength);
  if (!allowEmpty && !normalized) return undefined;
  return normalized;
}

function safeLink(value: unknown, maxLength: number) {
  const normalized = text(value, maxLength);
  if (normalized === undefined) return undefined;
  if (!normalized) return '';
  if (
    normalized.startsWith('#') ||
    (normalized.startsWith('/') && !normalized.startsWith('//')) ||
    normalized.startsWith('./') ||
    normalized.startsWith('../') ||
    /^(?:mailto|tel):/i.test(normalized) ||
    /^https?:\/\//i.test(normalized)
  ) {
    return normalized;
  }
  return undefined;
}

function safeMediaUrl(
  value: unknown,
  maxLength: number,
  allowEmpty = true,
) {
  const normalized = text(value, maxLength);
  if (normalized === undefined) return undefined;
  if (!normalized) return allowEmpty ? '' : undefined;
  if (
    (normalized.startsWith('/') && !normalized.startsWith('//')) ||
    /^https?:\/\//i.test(normalized)
  ) {
    return normalized;
  }
  return undefined;
}

function assignDefined(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value !== undefined) target[key] = value;
}

function themeChanges(
  changes: Record<string, unknown>,
) {
  const result: Record<string, unknown> = {};
  assignDefined(result, 'primaryColor', validHex(changes.primaryColor) ? changes.primaryColor : undefined);
  assignDefined(result, 'secondaryColor', validHex(changes.secondaryColor) ? changes.secondaryColor : undefined);
  assignDefined(result, 'backgroundColor', validHex(changes.backgroundColor) ? changes.backgroundColor : undefined);
  assignDefined(result, 'textColor', validHex(changes.textColor) ? changes.textColor : undefined);
  assignDefined(result, 'mutedTextColor', validHex(changes.mutedTextColor) ? changes.mutedTextColor : undefined);

  const fontFamily = text(changes.fontFamily, 80, false);
  if (
    fontFamily &&
    ['Inter', 'Arial', 'Georgia', 'Trebuchet MS', 'Courier New', 'system-ui'].includes(fontFamily)
  ) {
    result.fontFamily = fontFamily;
  }

  assignDefined(result, 'contentWidth', finiteNumber(changes.themeContentWidth, 720, 1440));
  assignDefined(result, 'buttonRadius', finiteNumber(changes.themeButtonRadius, 0, 40));
  assignDefined(result, 'sectionSpacing', finiteNumber(changes.themeSectionSpacing, 40, 140));
  return result;
}

function seoChanges(
  changes: Record<string, unknown>,
) {
  const result: Record<string, unknown> = {};
  assignDefined(result, 'title', text(changes.seoTitle, 120));
  assignDefined(result, 'description', text(changes.seoDescription, 300));

  if (Array.isArray(changes.seoKeywords)) {
    result.keywords = changes.seoKeywords
      .map((keyword) => String(keyword).trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 20);
  }

  return result;
}

function headerChanges(
  changes: Record<string, unknown>,
) {
  const result: Record<string, unknown> = {};

  for (const [source, target] of [
    ['headerEnabled', 'enabled'],
    ['headerSticky', 'sticky'],
    ['headerMobileMenu', 'mobileMenu'],
    ['headerLanguageSwitcher', 'languageSwitcher'],
    ['showCta', 'showCta'],
  ] as const) {
    if (typeof changes[source] === 'boolean') {
      result[target] = changes[source];
    }
  }

  assignDefined(result, 'brandText', text(changes.headerBrandText, 80));
  assignDefined(result, 'logoUrl', safeMediaUrl(changes.headerLogoUrl, 1000, false));
  assignDefined(result, 'ctaLabel', text(changes.ctaLabel, 80));
  assignDefined(result, 'ctaHref', safeLink(changes.ctaHref, 1000));

  for (const [source, target] of [
    ['headerBackgroundColor', 'backgroundColor'],
    ['headerTextColor', 'textColor'],
    ['headerActiveColor', 'activeColor'],
    ['headerHoverColor', 'hoverColor'],
    ['headerCtaBackgroundColor', 'ctaBackgroundColor'],
    ['headerCtaTextColor', 'ctaTextColor'],
    ['headerBorderColor', 'borderColor'],
  ] as const) {
    if (validHex(changes[source])) {
      result[target] = changes[source];
    }
  }

  assignDefined(result, 'navGap', finiteNumber(changes.headerNavGap, 4, 48));
  assignDefined(result, 'brandSize', finiteNumber(changes.headerBrandSize, 12, 32));
  assignDefined(result, 'navSize', finiteNumber(changes.headerNavSize, 10, 24));

  return result;
}

export function isLegacyAIGlobalNativeAction(action: string) {
  return GLOBAL_NATIVE_AI_ACTIONS.has(action);
}

export function convertLegacyAIGlobalOperationToNative(
  operation: LegacyAIEditorOperationLike,
): EditorNativeOperation | null {
  if (!isLegacyAIGlobalNativeAction(operation.action)) return null;

  const changes = isRecord(operation.changes)
    ? operation.changes
    : {};

  let mapped: Record<string, unknown>;
  if (operation.action === 'update_theme') {
    mapped = themeChanges(changes);
  } else if (operation.action === 'update_seo') {
    mapped = seoChanges(changes);
  } else {
    mapped = headerChanges(changes);
  }

  if (!Object.keys(mapped).length) return null;

  return {
    action: operation.action as 'update_theme' | 'update_seo' | 'update_header',
    source: 'ai',
    changes: mapped,
  };
}


export function isLegacyAIPageNativeAction(action: string) {
  return PAGE_NATIVE_AI_ACTIONS.has(action);
}

export function convertLegacyAIPageOperationToNative(
  operation: LegacyAIPageOperationLike,
  resolvedPageId: string,
): EditorNativeOperation | null {
  if (!isLegacyAIPageNativeAction(operation.action)) return null;

  const pageId = resolvedPageId.trim();
  if (!pageId) return null;

  if (operation.action === 'remove_page') {
    return {
      action: 'remove_page',
      source: 'ai',
      pageId,
    };
  }

  if (operation.action === 'set_home_page') {
    return {
      action: 'set_home_page',
      source: 'ai',
      pageId,
    };
  }

  const beforeId =
    typeof operation.beforePageId === 'string'
      ? operation.beforePageId.trim()
      : '';
  const afterId =
    typeof operation.afterPageId === 'string'
      ? operation.afterPageId.trim()
      : '';

  if ((!beforeId && !afterId) || (beforeId && afterId)) {
    return null;
  }

  return {
    action: 'move_page',
    source: 'ai',
    pageId,
    position: beforeId
      ? { beforeId }
      : { afterId },
  };
}


export function isLegacyAIStructuralNativeAction(
  action: string,
) {
  return STRUCTURAL_NATIVE_AI_ACTIONS.has(action);
}

function positionFromLegacyAnchors(
  beforeId: string | undefined,
  afterId: string | undefined,
) {
  const before =
    typeof beforeId === 'string'
      ? beforeId.trim()
      : '';
  const after =
    typeof afterId === 'string'
      ? afterId.trim()
      : '';

  if ((!before && !after) || (before && after)) {
    return null;
  }

  return before
    ? { beforeId: before }
    : { afterId: after };
}

export function convertLegacyAIStructuralOperationToNative(
  operation: LegacyAIStructuralOperationLike,
  context: LegacyAIStructuralNativeContext,
): EditorNativeOperation[] {
  if (!isLegacyAIStructuralNativeAction(operation.action)) {
    return [];
  }

  const pageId = context.pageId.trim();
  const sectionId = context.sectionId.trim();
  if (!pageId || !sectionId) return [];

  if (operation.action === 'remove_section') {
    return [
      {
        action: 'remove_section',
        source: 'ai',
        pageId,
        sectionId,
      },
    ];
  }

  if (operation.action === 'move_section') {
    const position = positionFromLegacyAnchors(
      operation.beforeSectionId,
      operation.afterSectionId,
    );
    if (!position || !operation.sectionId?.trim()) {
      return [];
    }
    return [
      {
        action: 'move_section',
        source: 'ai',
        pageId,
        sectionId: operation.sectionId.trim(),
        position,
      },
    ];
  }

  if (operation.action === 'remove_element') {
    const elementId = operation.elementId?.trim();
    if (!elementId) return [];
    return [
      {
        action: 'remove_element',
        source: 'ai',
        pageId,
        sectionId,
        elementId,
      },
    ];
  }

  if (operation.action === 'move_element') {
    const elementId = operation.elementId?.trim();
    const position = positionFromLegacyAnchors(
      operation.beforeElementId,
      operation.afterElementId,
    );
    if (!elementId || !position) return [];
    return [
      {
        action: 'move_element',
        source: 'ai',
        pageId,
        sectionId,
        elementId,
        position,
      },
    ];
  }

  if (operation.action === 'assign_element_container') {
    const elementId = operation.elementId?.trim();
    if (!elementId) return [];
    return [
      {
        action: 'assign_element_container',
        source: 'ai',
        pageId,
        sectionId,
        elementId,
        ...(typeof operation.containerId === 'string'
          ? { containerId: operation.containerId.trim() }
          : {}),
      },
    ];
  }

  if (operation.action === 'detach_symbol') {
    const elementId = operation.elementId?.trim();
    if (!elementId) return [];
    return [
      {
        action: 'detach_symbol',
        source: 'ai',
        pageId,
        sectionId,
        elementId,
      },
    ];
  }

  if (operation.action === 'remove_container') {
    const containerId = operation.containerId?.trim();
    if (!containerId) return [];

    const detachOperations =
      (context.detachElementIds || [])
        .map((elementId) => elementId.trim())
        .filter(Boolean)
        .map<EditorNativeOperation>((elementId) => ({
          action: 'assign_element_container',
          source: 'ai',
          pageId,
          sectionId,
          elementId,
          containerId: '',
        }));

    return [
      ...detachOperations,
      {
        action: 'remove_container',
        source: 'ai',
        pageId,
        sectionId,
        containerId,
      },
    ];
  }

  if (operation.action === 'remove_form_field') {
    const formFieldId = operation.formFieldId?.trim();
    if (!formFieldId) return [];
    return [
      {
        action: 'remove_form_field',
        source: 'ai',
        pageId,
        sectionId,
        formFieldId,
      },
    ];
  }

  const formFieldId = operation.formFieldId?.trim();
  const position = positionFromLegacyAnchors(
    operation.beforeFormFieldId,
    operation.afterFormFieldId,
  );
  if (!formFieldId || !position) return [];

  return [
    {
      action: 'move_form_field',
      source: 'ai',
      pageId,
      sectionId,
      formFieldId,
      position,
    },
  ];
}


export function convertLegacyAIPageUpdateOperationToNative(
  operation: LegacyAIPageOperationLike,
  resolvedPageId: string,
): EditorNativeOperation | null {
  if (operation.action !== 'update_page') {
    return null;
  }

  const pageId = resolvedPageId.trim();
  if (!pageId) return null;

  const changes = isRecord(operation.changes)
    ? operation.changes
    : {};
  const mapped: Record<string, unknown> = {};

  if (
    typeof changes.name === 'string' &&
    changes.name.trim()
  ) {
    mapped.name =
      changes.name.trim().slice(0, 60);
  }

  if (typeof changes.slug === 'string') {
    const slug = changes.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (slug) mapped.slug = slug;
  }

  if (
    typeof changes.showInNavigation === 'boolean'
  ) {
    mapped.showInNavigation =
      changes.showInNavigation;
  }

  if (typeof changes.seoTitle === 'string') {
    mapped.seoTitle =
      changes.seoTitle.trim().slice(0, 120);
  }

  if (
    typeof changes.seoDescription === 'string'
  ) {
    mapped.seoDescription =
      changes.seoDescription
        .trim()
        .slice(0, 300);
  }

  if (
    typeof changes.canonicalUrl === 'string'
  ) {
    mapped.canonicalUrl =
      changes.canonicalUrl
        .trim()
        .slice(0, 500);
  }

  if (typeof changes.noIndex === 'boolean') {
    mapped.noIndex = changes.noIndex;
  }

  if (!Object.keys(mapped).length) {
    return null;
  }

  return {
    action: 'update_page',
    source: 'ai',
    pageId,
    changes: mapped,
  };
}

export function isLegacyAIUpdateNativeAction(
  action: string,
) {
  return UPDATE_NATIVE_AI_ACTIONS.has(action);
}

export function convertLegacyAIUpdateOperationToNative(
  operation: LegacyAIStructuralOperationLike,
  context: LegacyAIUpdateNativeContext,
): EditorNativeOperation | null {
  if (!isLegacyAIUpdateNativeAction(operation.action)) {
    return null;
  }

  const pageId = context.pageId.trim();
  const sectionId = context.sectionId.trim();
  if (!pageId || !sectionId) return null;

  const changes = isRecord(operation.changes)
    ? operation.changes
    : {};

  if (operation.action === 'update_form') {
    const mapped: Record<string, unknown> = {};

    if (typeof changes.formSuccessMessage === 'string') {
      mapped.formSuccessMessage =
        changes.formSuccessMessage
          .trim()
          .slice(0, 500);
    }

    if (
      changes.formSuccessAction === 'redirect' ||
      changes.formSuccessAction === 'message'
    ) {
      mapped.formSuccessAction =
        changes.formSuccessAction;
    }

    if (typeof changes.formRedirectUrl === 'string') {
      mapped.formRedirectUrl =
        changes.formRedirectUrl
          .trim()
          .slice(0, 1000);
    }

    if (!Object.keys(mapped).length) {
      return null;
    }

    return {
      action: 'update_section',
      source: 'ai',
      pageId,
      sectionId,
      changes: mapped,
    };
  }

  if (operation.action === 'update_container') {
    const containerId = operation.containerId?.trim();
    if (!containerId) return null;

    const mapped: Record<string, unknown> = {};
    const columns = Math.max(
      1,
      Math.min(
        3,
        Math.round(context.sectionColumns || 1),
      ),
    );

    const name = text(
      changes.containerName,
      80,
      false,
    );
    assignDefined(mapped, 'name', name);

    if (
      changes.containerLayout === 'row' ||
      changes.containerLayout === 'stack'
    ) {
      mapped.layout = changes.containerLayout;
    }

    assignDefined(
      mapped,
      'gap',
      finiteLegacyNumber(
        changes.containerGap,
        0,
        80,
      ),
    );

    if (
      changes.containerAlign === 'start' ||
      changes.containerAlign === 'center' ||
      changes.containerAlign === 'end' ||
      changes.containerAlign === 'stretch'
    ) {
      mapped.align = changes.containerAlign;
    }

    if (validHex(changes.containerBackgroundColor)) {
      mapped.backgroundColor =
        changes.containerBackgroundColor;
    }

    assignDefined(
      mapped,
      'padding',
      finiteLegacyNumber(
        changes.containerPadding,
        0,
        120,
      ),
    );
    assignDefined(
      mapped,
      'borderRadius',
      finiteLegacyNumber(
        changes.containerBorderRadius,
        0,
        120,
      ),
    );
    assignDefined(
      mapped,
      'borderWidth',
      finiteLegacyNumber(
        changes.containerBorderWidth,
        0,
        16,
      ),
    );

    if (validHex(changes.containerBorderColor)) {
      mapped.borderColor =
        changes.containerBorderColor;
    }

    if (
      typeof changes.containerShadow === 'string' &&
      ALLOWED_SHADOWS.has(
        changes.containerShadow,
      )
    ) {
      mapped.shadow =
        changes.containerShadow;
    }

    if (context.sectionIsStack) {
      mapped.layoutColumn = undefined;
    } else {
      const layoutColumn =
        finiteLegacyNumber(
          changes.containerColumn,
          1,
          columns,
        );
      if (layoutColumn !== undefined) {
        mapped.layoutColumn =
          Math.round(layoutColumn);
      }
    }

    const columnSpan =
      finiteLegacyNumber(
        changes.containerColumnSpan,
        1,
        columns,
      );
    if (columnSpan !== undefined) {
      mapped.columnSpan =
        Math.round(columnSpan);
    }

    if (!Object.keys(mapped).length) {
      return null;
    }

    return {
      action: 'update_container',
      source: 'ai',
      pageId,
      sectionId,
      containerId,
      changes: mapped,
    };
  }

  const formFieldId =
    operation.formFieldId?.trim();
  const current =
    context.currentFormField;
  if (!formFieldId || !current) {
    return null;
  }

  const currentType =
    typeof current.type === 'string' &&
    ALLOWED_FORM_FIELD_TYPES.has(current.type)
      ? current.type
      : 'text';

  const requestedType =
    typeof operation.formFieldType === 'string' &&
    ALLOWED_FORM_FIELD_TYPES.has(
      operation.formFieldType,
    )
      ? operation.formFieldType
      : currentType;

  const mapped: Record<string, unknown> = {
    type: requestedType,
  };

  if (
    typeof changes.formFieldName === 'string' &&
    changes.formFieldName.trim()
  ) {
    mapped.name =
      normalizedFormFieldName(
        changes.formFieldName,
        typeof current.name === 'string' &&
          current.name
          ? current.name
          : 'field',
      );
  }

  if (typeof changes.formFieldLabel === 'string') {
    mapped.label =
      changes.formFieldLabel
        .trim()
        .slice(0, 120);
  }

  if (requestedType === 'checkbox') {
    mapped.placeholder = '';
  } else if (
    typeof changes.formFieldPlaceholder === 'string'
  ) {
    mapped.placeholder =
      changes.formFieldPlaceholder.slice(0, 160);
  }

  if (
    typeof changes.formFieldRequired === 'boolean'
  ) {
    mapped.required =
      changes.formFieldRequired;
  }

  if (requestedType === 'select') {
    if (Array.isArray(changes.formFieldOptions)) {
      mapped.options =
        changes.formFieldOptions
          .map((item) =>
            String(item).trim(),
          )
          .filter(Boolean)
          .slice(0, 20);
    } else if (Array.isArray(current.options)) {
      mapped.options = [
        ...current.options,
      ];
    } else {
      mapped.options = [
        'Option 1',
        'Option 2',
      ];
    }
  } else {
    mapped.options = undefined;
  }

  return {
    action: 'update_form_field',
    source: 'ai',
    pageId,
    sectionId,
    formFieldId,
    changes: mapped,
  };
}


export function convertLegacyAIAddOperationToNative(
  operation: LegacyAIStructuralOperationLike,
  context: LegacyAIAddNativeContext,
): EditorNativeOperation[] {
  const pageId = context.pageId.trim();
  const sectionId = context.sectionId.trim();
  const generatedId = context.generatedId.trim();
  if (!pageId || !sectionId || !generatedId) {
    return [];
  }

  const changes = isRecord(operation.changes)
    ? operation.changes
    : {};

  if (operation.action === 'add_container') {
    const columns = Math.max(
      1,
      Math.min(
        3,
        Math.round(context.sectionColumns || 1),
      ),
    );

    const requestedColumn =
      finiteLegacyNumber(
        changes.containerColumn,
        1,
        columns,
      );
    const requestedSpan =
      finiteLegacyNumber(
        changes.containerColumnSpan,
        1,
        columns,
      );

    const container: Record<string, unknown> = {
      id: generatedId,
      name:
        text(changes.containerName, 80, false) ||
        `AI Container ${(context.existingContainerCount || 0) + 1}`,
      layout:
        changes.containerLayout === 'row'
          ? 'row'
          : 'stack',
      gap:
        finiteLegacyNumber(
          changes.containerGap,
          0,
          80,
        ) ?? 16,
      align:
        changes.containerAlign === 'start' ||
        changes.containerAlign === 'end' ||
        changes.containerAlign === 'stretch'
          ? changes.containerAlign
          : 'center',
      backgroundColor:
        validHex(changes.containerBackgroundColor)
          ? changes.containerBackgroundColor
          : '#ffffff08',
      padding:
        finiteLegacyNumber(
          changes.containerPadding,
          0,
          120,
        ) ?? 20,
      borderRadius:
        finiteLegacyNumber(
          changes.containerBorderRadius,
          0,
          120,
        ) ?? 16,
      borderWidth:
        finiteLegacyNumber(
          changes.containerBorderWidth,
          0,
          16,
        ) ?? 1,
      borderColor:
        validHex(changes.containerBorderColor)
          ? changes.containerBorderColor
          : '#ffffff18',
      shadow:
        typeof changes.containerShadow === 'string' &&
        ALLOWED_SHADOWS.has(
          changes.containerShadow,
        )
          ? changes.containerShadow
          : 'none',
      layoutColumn:
        context.sectionIsStack
          ? undefined
          : Math.round(requestedColumn ?? 1),
      columnSpan:
        Math.round(requestedSpan ?? 1),
    };

    const operations: EditorNativeOperation[] = [
      {
        action: 'add_container',
        source: 'ai',
        pageId,
        sectionId,
        container: container as {
          id: string;
          [key: string]: unknown;
        },
      },
    ];

    if (context.assignElementId?.trim()) {
      operations.push({
        action: 'assign_element_container',
        source: 'ai',
        pageId,
        sectionId,
        elementId:
          context.assignElementId.trim(),
        containerId: generatedId,
      });
    }

    return operations;
  }

  if (operation.action !== 'add_form_field') {
    return [];
  }

  const fieldType =
    typeof operation.formFieldType === 'string' &&
    ALLOWED_FORM_FIELD_TYPES.has(operation.formFieldType)
      ? operation.formFieldType
      : '';

  if (!fieldType) return [];

  const explicitBaseName =
    typeof changes.formFieldName === 'string' &&
    changes.formFieldName.trim()
      ? normalizedFormFieldName(
          changes.formFieldName,
          'field',
        )
      : '';

  const baseName =
    explicitBaseName ||
    (fieldType === 'email'
      ? 'email'
      : fieldType === 'tel'
        ? 'phone'
        : fieldType === 'textarea'
          ? 'message'
          : fieldType === 'checkbox'
            ? 'consent'
            : fieldType === 'select'
              ? 'option'
              : 'field');

  const existingNames = new Set(
    context.existingFormFieldNames || [],
  );
  let uniqueName = baseName;
  let suffix = 2;
  while (existingNames.has(uniqueName)) {
    uniqueName = `${baseName}_${suffix}`;
    suffix += 1;
  }

  const label =
    typeof changes.formFieldLabel === 'string' &&
    changes.formFieldLabel.trim()
      ? changes.formFieldLabel
          .trim()
          .slice(0, 120)
      : fieldType === 'textarea'
        ? 'Message'
        : fieldType === 'checkbox'
          ? 'I agree'
          : fieldType === 'select'
            ? 'Choose an option'
            : fieldType === 'tel'
              ? 'Phone'
              : fieldType === 'email'
                ? 'Email'
                : 'New field';

  const field: Record<string, unknown> = {
    id: generatedId,
    name: uniqueName,
    label,
    type: fieldType,
    placeholder:
      fieldType === 'checkbox'
        ? ''
        : typeof changes.formFieldPlaceholder === 'string'
          ? changes.formFieldPlaceholder.slice(0, 160)
          : '',
    required:
      changes.formFieldRequired === true,
    options:
      fieldType === 'select'
        ? Array.isArray(changes.formFieldOptions)
          ? changes.formFieldOptions
              .map((item) =>
                String(item).trim(),
              )
              .filter(Boolean)
              .slice(0, 20)
          : ['Option 1', 'Option 2']
        : undefined,
  };

  const existingIds = new Set(
    context.existingFormFieldIds || [],
  );
  const before =
    typeof operation.beforeFormFieldId === 'string' &&
    existingIds.has(operation.beforeFormFieldId)
      ? operation.beforeFormFieldId
      : '';
  const after =
    !before &&
    typeof operation.afterFormFieldId === 'string' &&
    existingIds.has(operation.afterFormFieldId)
      ? operation.afterFormFieldId
      : '';

  return [
    {
      action: 'add_form_field',
      source: 'ai',
      pageId,
      sectionId,
      formField: field as {
        id: string;
        [key: string]: unknown;
      },
      ...(before
        ? { position: { beforeId: before } }
        : after
          ? { position: { afterId: after } }
          : {}),
    },
  ];
}
