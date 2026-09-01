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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function responsiveObject(element: EditorElementLike, device: 'tablet' | 'mobile') {
  const responsive = element.responsive || (element.responsive = {});
  const current = responsive[device];
  const next = current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
  responsive[device] = next;
  return next;
}

function repairElementResponsive(element: EditorElementLike) {
  const style = element.style || {};
  const fontSize = numeric(style.fontSize);
  const padding = numeric(style.padding);
  const marginTop = numeric(style.marginTop);
  const marginRight = numeric(style.marginRight);
  const marginBottom = numeric(style.marginBottom);
  const marginLeft = numeric(style.marginLeft);
  const positionX = numeric(style.positionX);
  const positionY = numeric(style.positionY);
  let changed = false;

  const tablet = responsiveObject(element, 'tablet');
  const mobile = responsiveObject(element, 'mobile');

  if (fontSize !== undefined && fontSize > 52) {
    if (tablet.fontSize === undefined) tablet.fontSize = Math.min(fontSize, 48);
    if (mobile.fontSize === undefined) mobile.fontSize = Math.min(fontSize, 38);
    changed = true;
  }
  if (padding !== undefined && padding > 40) {
    if (tablet.padding === undefined) tablet.padding = Math.min(padding, 32);
    if (mobile.padding === undefined) mobile.padding = Math.min(padding, 24);
    changed = true;
  }
  for (const [key, value] of [
    ['marginTop', marginTop], ['marginRight', marginRight], ['marginBottom', marginBottom], ['marginLeft', marginLeft],
  ] as const) {
    if (value !== undefined && Math.abs(value) > 56) {
      if (tablet[key] === undefined) tablet[key] = Math.sign(value) * Math.min(Math.abs(value), 40);
      if (mobile[key] === undefined) mobile[key] = Math.sign(value) * Math.min(Math.abs(value), 24);
      changed = true;
    }
  }
  if (positionX !== undefined && Math.abs(positionX) > 120) {
    if (tablet.positionX === undefined) tablet.positionX = 0;
    if (mobile.positionX === undefined) mobile.positionX = 0;
    changed = true;
  }
  if (positionY !== undefined && Math.abs(positionY) > 120) {
    if (tablet.positionY === undefined) tablet.positionY = 0;
    if (mobile.positionY === undefined) mobile.positionY = 0;
    changed = true;
  }

  if (!changed) {
    if (Object.keys(tablet).length === 0) delete element.responsive?.tablet;
    if (Object.keys(mobile).length === 0) delete element.responsive?.mobile;
    if (element.responsive && Object.keys(element.responsive).length === 0) delete element.responsive;
  }
  return changed;
}

function repairSectionResponsive(section: EditorSectionLike) {
  const source = section.responsive && typeof section.responsive === 'object'
    ? section.responsive as Record<string, unknown>
    : {};
  const tablet = source.tablet && typeof source.tablet === 'object' ? { ...(source.tablet as Record<string, unknown>) } : {};
  const mobile = source.mobile && typeof source.mobile === 'object' ? { ...(source.mobile as Record<string, unknown>) } : {};
  let changed = false;
  const paddingY = numeric(section.sectionPaddingY);
  const paddingX = numeric(section.sectionPaddingX);
  const gap = numeric(section.layoutGap);
  const minHeight = numeric(section.minHeight);

  if (paddingY !== undefined && paddingY > 72) {
    if (tablet.sectionPaddingY === undefined) tablet.sectionPaddingY = Math.min(paddingY, 56);
    if (mobile.sectionPaddingY === undefined) mobile.sectionPaddingY = Math.min(paddingY, 40);
    changed = true;
  }
  if (paddingX !== undefined && paddingX > 48) {
    if (tablet.sectionPaddingX === undefined) tablet.sectionPaddingX = Math.min(paddingX, 36);
    if (mobile.sectionPaddingX === undefined) mobile.sectionPaddingX = Math.min(paddingX, 24);
    changed = true;
  }
  if (gap !== undefined && gap > 32) {
    if (tablet.layoutGap === undefined) tablet.layoutGap = Math.min(gap, 28);
    if (mobile.layoutGap === undefined) mobile.layoutGap = Math.min(gap, 20);
    changed = true;
  }
  if (minHeight !== undefined && minHeight > 720) {
    if (tablet.minHeight === undefined) tablet.minHeight = Math.min(minHeight, 640);
    if (mobile.minHeight === undefined) mobile.minHeight = Math.min(minHeight, 520);
    changed = true;
  }
  if (changed) section.responsive = { ...source, tablet, mobile };
  return changed;
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
  element.style = { ...(element.style || {}), ...changes };
}

export function commandRestyleSite<P extends EditorProjectLike>(
  changes: Record<string, unknown>,
  options: EditorCommandAdapterOptions = {},
) {
  return commandOptions<P>('Restyle site', (draft) => {
    const safeChanges = safeEditorPayloadRecord(changes, 'restyle changes');
    const primary = safeChanges.primaryColor ?? safeChanges.accentColor;
    const background = safeChanges.backgroundColor;
    const text = safeChanges.textColor;
    const muted = safeChanges.mutedTextColor;
    draft.theme = { ...(draft.theme || {}), ...cloneEditorValue(safeChanges) };

    for (const page of draft.pages) {
      for (const section of page.sections) {
        if (background !== undefined) section.backgroundColor = cloneEditorValue(background);
        for (const element of section.elements) {
          if (element.type === 'button' && primary !== undefined) setStyle(element, { backgroundColor: cloneEditorValue(primary) });
          if ((element.type === 'heading' || element.type === 'text') && text !== undefined) setStyle(element, { color: cloneEditorValue(text) });
          if (element.type === 'text' && muted !== undefined && element.muted === true) setStyle(element, { color: cloneEditorValue(muted) });
          if (element.symbolId) syncEditorSymbolFromInstance(draft, element.symbolId, element);
        }
      }
    }
  }, options);
}
