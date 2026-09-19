import { createEditorCommand, type EditorCommand } from './editor-command';
import {
  findEditorElement,
  findEditorElementById,
  findEditorSection,
  findEditorSectionById,
  type EditorElementLike,
  type EditorProjectLike,
  type EditorSectionLike,
} from './editor-model';
import { cloneEditorValue } from './editor-transaction';
import { syncEditorSymbolFromInstance } from './editor-symbols';
import { safeEditorPayloadRecord } from './editor-payload-safety';
import { assertEditorSemanticRecord } from './editor-value-safety';
import type { EditorCommandAdapterOptions } from './editor-command-adapters';

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

const ELEMENT_VISUAL_KEYS = [
  'style', 'responsive', 'animation', 'animationDuration', 'animationDelay', 'animationOnce',
  'hoverScale', 'shadow', 'borderStyle', 'borderWidth', 'borderColor',
] as const;

const SECTION_VISUAL_KEYS = [
  'layout', 'layoutGap', 'layoutAlign', 'contentWidth', 'backgroundMode', 'backgroundColor',
  'gradientFrom', 'gradientTo', 'gradientDirection', 'backgroundImage', 'backgroundPosition',
  'backgroundSize', 'overlayColor', 'overlayOpacity', 'sectionPaddingY', 'sectionPaddingX',
  'sectionRadius', 'minHeight', 'responsive',
] as const;

function copyKeys(target: Record<string, unknown>, source: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (source[key] === undefined) delete target[key];
    else target[key] = cloneEditorValue(source[key]);
  }
}

export function commandCopyElementStyle<P extends EditorProjectLike>(
  sourceElementId: string,
  pageId: string,
  sectionId: string,
  targetElementId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Copy element style', (draft) => {
    const source = findEditorElementById(draft, sourceElementId);
    if (!source) throw new Error(`Source element not found: ${sourceElementId}`);
    const target = findEditorElement(draft, pageId, sectionId, targetElementId);
    if (!target) throw new Error(`Target element not found: ${targetElementId}`);
    copyKeys(target.element, source.element, ELEMENT_VISUAL_KEYS);
    if (target.element.symbolId) syncEditorSymbolFromInstance(draft, target.element.symbolId, target.element);
  }, options);
}

export function commandCopySectionStyle<P extends EditorProjectLike>(
  sourceSectionId: string,
  pageId: string,
  targetSectionId: string,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Copy section style', (draft) => {
    const source = findEditorSectionById(draft, sourceSectionId);
    if (!source) throw new Error(`Source section not found: ${sourceSectionId}`);
    const target = findEditorSection(draft, pageId, targetSectionId);
    if (!target) throw new Error(`Target section not found: ${targetSectionId}`);
    copyKeys(target.section, source.section, SECTION_VISUAL_KEYS);
  }, options);
}

function numeric(value: unknown) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Add only missing device overrides. A second repair must be a true no-op,
// otherwise linked components can be synchronized without an actual edit.
function repairResponsiveValues(
  source: Record<string, unknown>,
  current: Record<string, unknown> | undefined,
  rules: readonly [string, number, number, number][],
) {
  const result = { ...current };
  let changed = false;
  for (const [device, limitIndex] of [['tablet', 2], ['mobile', 3]] as const) {
    const existing = current?.[device];
    const overrides = existing && typeof existing === 'object'
      ? { ...existing as Record<string, unknown> } : {};
    let deviceChanged = false;
    for (const rule of rules) {
      const [key, threshold] = rule;
      const value = numeric(source[key]);
      const magnitude = key.startsWith('margin') || key.startsWith('position') ? Math.abs(value ?? 0) : value;
      if (value === undefined || magnitude === undefined || magnitude <= threshold || overrides[key] !== undefined) continue;
      overrides[key] = Math.sign(value) * Math.min(Math.abs(value), rule[limitIndex]);
      deviceChanged = true;
    }
    if (deviceChanged) {
      result[device] = overrides;
      changed = true;
    }
  }
  return changed ? result : undefined;
}

function repairElementResponsive(element: EditorElementLike) {
  const next = repairResponsiveValues(element.style || {}, element.responsive, [
    ['fontSize', 52, 48, 38], ['padding', 40, 32, 24],
    ['marginTop', 56, 40, 24], ['marginRight', 56, 40, 24],
    ['marginBottom', 56, 40, 24], ['marginLeft', 56, 40, 24],
    ['positionX', 120, 0, 0], ['positionY', 120, 0, 0],
  ]);
  if (!next) return false;
  element.responsive = next;
  return true;
}

function repairSectionResponsive(section: EditorSectionLike) {
  const next = repairResponsiveValues(section, section.responsive as Record<string, unknown> | undefined, [
    ['sectionPaddingY', 72, 56, 40], ['sectionPaddingX', 48, 36, 24],
    ['layoutGap', 32, 28, 20], ['minHeight', 720, 640, 520],
  ]);
  if (!next) return false;
  section.responsive = next;
  return true;
}

export function commandRepairResponsive<P extends EditorProjectLike>(
  pageId: string | undefined,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Repair responsive design', (draft) => {
    const pages = pageId ? draft.pages.filter((page) => page.id === pageId) : draft.pages;
    if (pageId && pages.length === 0) throw new Error(`Page not found: ${pageId}`);
    for (const page of pages) {
      for (const section of page.sections) {
        repairSectionResponsive(section);
        for (const element of section.elements) {
          if (repairElementResponsive(element) && element.symbolId) {
            syncEditorSymbolFromInstance(draft, element.symbolId, element);
          }
        }
      }
    }
  }, options);
}

function meaningfulText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function commandRepairAccessibility<P extends EditorProjectLike>(
  pageId: string | undefined,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Repair accessibility', (draft) => {
    const pages = pageId ? draft.pages.filter((page) => page.id === pageId) : draft.pages;
    if (pageId && pages.length === 0) throw new Error(`Page not found: ${pageId}`);
    for (const page of pages) {
      for (const section of page.sections) {
        for (const element of section.elements) {
          let changed = false;
          if (element.type === 'image' && !meaningfulText(element.alt)) {
            element.alt = meaningfulText(element.title) || meaningfulText(section.title) || meaningfulText(page.name) || 'Website image';
            changed = true;
          }
          if (element.type === 'button' && !meaningfulText(element.content)) {
            element.content = 'Learn more';
            changed = true;
          }
          if (changed && element.symbolId) syncEditorSymbolFromInstance(draft, element.symbolId, element);
        }
        for (const field of section.formFields || []) {
          if (!meaningfulText(field.label)) {
            field.label = meaningfulText(field.name) || 'Field';
          }
        }
      }
    }
  }, options);
}

function setStyle(element: EditorElementLike, changes: Record<string, unknown>) {
  if (Object.entries(changes).every(([key, value]) => element.style?.[key] === value)) return false;
  element.style = { ...(element.style || {}), ...changes };
  return true;
}

export function commandRestyleSite<P extends EditorProjectLike>(
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Restyle site', (draft) => {
    const safeChanges = safeEditorPayloadRecord(changes, 'restyle changes');
    assertEditorSemanticRecord('restyle', safeChanges, 'restyle changes');
    const primary = safeChanges.primaryColor ?? safeChanges.accentColor;
    const background = safeChanges.backgroundColor;
    const text = safeChanges.textColor;
    const muted = safeChanges.mutedTextColor;
    const { accentColor: _accentColor, ...themeChanges } = safeChanges;
    if (primary !== undefined) themeChanges.primaryColor = cloneEditorValue(primary);
    draft.theme = { ...(draft.theme || {}), ...cloneEditorValue(themeChanges) };

    for (const page of draft.pages) {
      for (const section of page.sections) {
        if (background !== undefined) section.backgroundColor = cloneEditorValue(background);
        for (const element of section.elements) {
          const styleChanges: Record<string, unknown> = {};
          if (element.type === 'button' && primary !== undefined) styleChanges.backgroundColor = cloneEditorValue(primary);
          if ((element.type === 'heading' || element.type === 'text') && text !== undefined) styleChanges.color = cloneEditorValue(text);
          if (element.type === 'text' && muted !== undefined && element.muted === true) styleChanges.color = cloneEditorValue(muted);
          if (setStyle(element, styleChanges) && element.symbolId) syncEditorSymbolFromInstance(draft, element.symbolId, element);
        }
      }
    }
  }, options);
}
