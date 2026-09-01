import type { EditorNativeOperation } from './editor-native-operation';

export interface LegacyAIEditorOperationLike {
  action: string;
  changes?: Record<string, unknown>;
}

export interface LegacyAIPageOperationLike
  extends LegacyAIEditorOperationLike {
  pageId?: string;
  pageSlug?: string;
  beforePageId?: string;
  afterPageId?: string;
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
