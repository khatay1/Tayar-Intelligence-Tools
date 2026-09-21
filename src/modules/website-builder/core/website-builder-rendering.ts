import { localizeUi } from '@/lib/ui-localization';
import { containerLayoutCss, elementConstraintCss } from './editor-layout-style';
import { elementAnimationEasing, elementAnimationTransform, normalizeElementAnimation } from './editor-motion';
import type { Language } from '@/context/PreferencesContext';
import { relativeWebsitePageHref } from './website-localization';
import type { Device, ElementShadow, SectionBackgroundMode, SectionBackgroundPosition, SectionBackgroundSize, SectionContentWidth, SectionLayout, SectionLayoutAlign, SectionType, WebsiteElement, WebsiteElementContainer, WebsiteFormField, WebsiteSection } from './types';
import { createDefaultContactFormFields, createSection } from './defaults';
import { languageCodeLabel, normalizePageLanguage, normalizeSlug } from './project-identifiers';
import type { WebsitePage, LeadCaptureConfig, WebsiteTheme, WebsiteHeaderConfig, WebsiteFooterConfig, WebsiteSiteEnhancements, WebsiteProductionConfig } from './website-builder-model';
import { sanitizeCustomCss, normalizeProductionConfig, normalizeHeaderConfig, normalizeFooterConfig, normalizeSiteEnhancements, safeSocialUrl, normalizeTheme } from './website-builder-config';

export function sectionColumnCount(layout?: SectionLayout): number {
  if (layout === 'three-column') return 3;
  if (layout === 'two-column') return 2;
  return 1;
}

export function sectionLayoutGap(section: WebsiteSection): number {
  const value = Number(section.layoutGap);
  return Number.isFinite(value) ? Math.min(80, Math.max(0, value)) : 20;
}

export function sectionLayoutAlign(section: WebsiteSection): SectionLayoutAlign {
  return section.layoutAlign === 'start' || section.layoutAlign === 'end' || section.layoutAlign === 'stretch'
    ? section.layoutAlign
    : 'center';
}

export function sectionBackgroundMode(section: WebsiteSection): SectionBackgroundMode {
  return section.backgroundMode === 'gradient' || section.backgroundMode === 'image'
    ? section.backgroundMode
    : 'color';
}

export function sectionBackgroundPosition(section: WebsiteSection): SectionBackgroundPosition {
  return ['top', 'bottom', 'left', 'right'].includes(section.backgroundPosition || '')
    ? section.backgroundPosition as SectionBackgroundPosition
    : 'center';
}

export function sectionBackgroundSize(section: WebsiteSection): SectionBackgroundSize {
  return section.backgroundSize === 'contain' || section.backgroundSize === 'auto'
    ? section.backgroundSize
    : 'cover';
}

export function sectionContentWidth(section: WebsiteSection): SectionContentWidth {
  return section.contentWidth === 'full' ? 'full' : 'boxed';
}

export function sectionVisualNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function safeSectionColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function rgbaFromHex(hex: string, opacity: number): string {
  const normalized = safeSectionColor(hex, '#000000').slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, opacity))})`;
}

export function safeCssUrl(value: string): string {
  return value.trim().replace(/[\n\r"'<>\\]/g, '');
}

export function sectionBackgroundCss(section: WebsiteSection): string {
  const mode = sectionBackgroundMode(section);
  if (mode === 'gradient') {
    const from = safeSectionColor(section.gradientFrom, section.background || '#111827');
    const to = safeSectionColor(section.gradientTo, section.accent || '#7c3aed');
    const angle = sectionVisualNumber(section.gradientAngle, 135, 0, 360);
    return `linear-gradient(${angle}deg, ${from}, ${to})`;
  }

  if (mode === 'image' && section.backgroundImage?.trim()) {
    const overlayColor = safeSectionColor(section.overlayColor, '#000000');
    const overlayOpacity = sectionVisualNumber(section.overlayOpacity, 0.35, 0, 1);
    const image = safeCssUrl(section.backgroundImage);
    const position = sectionBackgroundPosition(section);
    const size = sectionBackgroundSize(section);
    return `linear-gradient(${rgbaFromHex(overlayColor, overlayOpacity)}, ${rgbaFromHex(overlayColor, overlayOpacity)}), url("${image}") ${position}/${size} no-repeat`;
  }

  return safeSectionColor(section.background, '#111827');
}

export function sectionInlineCss(section: WebsiteSection): string {
  const minHeight = sectionVisualNumber(section.minHeight, 0, 0, 1200);
  const radius = sectionVisualNumber(section.sectionRadius, 0, 0, 80);
  const hasPaddingY = Number.isFinite(Number(section.sectionPaddingY));
  const hasPaddingX = Number.isFinite(Number(section.sectionPaddingX));
  const paddingY = sectionVisualNumber(section.sectionPaddingY, 90, 0, 240);
  const paddingX = sectionVisualNumber(section.sectionPaddingX, 24, 0, 160);
  return [
    `background:${sectionBackgroundCss(section)}`,
    `--accent:${safeSectionColor(section.accent, '#7c3aed')}`,
    minHeight ? `min-height:${minHeight}px` : '',
    hasPaddingY ? `padding-top:${paddingY}px;padding-bottom:${paddingY}px` : '',
    hasPaddingX ? `padding-left:${paddingX}px;padding-right:${paddingX}px` : '',
    radius ? `border-radius:${radius}px;overflow:hidden` : '',
  ].filter(Boolean).join(';');
}

export function sectionContainerClass(section: WebsiteSection): string {
  return sectionContentWidth(section) === 'full' ? 'container section-container-full' : 'container';
}

export function elementColumn(element: WebsiteElement, index: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = Number(element.layoutColumn) || ((index % columnCount) + 1);
  return Math.min(columnCount, Math.max(1, requested));
}

export function clampElementNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function elementShadowCss(shadow: ElementShadow | undefined): string {
  if (shadow === 'sm') return '0 4px 12px rgba(0,0,0,.18)';
  if (shadow === 'md') return '0 10px 24px rgba(0,0,0,.24)';
  if (shadow === 'lg') return '0 18px 40px rgba(0,0,0,.3)';
  if (shadow === 'xl') return '0 28px 70px rgba(0,0,0,.38)';
  return 'none';
}

export function containerColumn(container: WebsiteElementContainer, fallback: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = Number(container.layoutColumn) || fallback;
  return Math.min(columnCount, Math.max(1, requested));
}

export function containerColumnSpan(container: WebsiteElementContainer, column: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = clampElementNumber(container.columnSpan, 1, 1, columnCount);
  return Math.min(requested, Math.max(1, columnCount - column + 1));
}

export function containerVisualCss(container: WebsiteElementContainer): string {
  return [
    ...containerLayoutCss(container),
    `background:${container.backgroundColor || 'transparent'}`,
    `padding:${clampElementNumber(container.padding, 20, 0, 120)}px`,
    `border-radius:${clampElementNumber(container.borderRadius, 16, 0, 120)}px`,
    `border:${clampElementNumber(container.borderWidth, 1, 0, 16)}px solid ${container.borderColor || 'transparent'}`,
    `box-shadow:${elementShadowCss(container.shadow)}`,
    'width:100%',
    'min-width:0',
  ].join(';');
}

export function cloneSymbolElement(element: WebsiteElement): WebsiteElement {
  const cloned = JSON.parse(JSON.stringify(element)) as WebsiteElement;
  delete cloned.containerId;
  delete cloned.symbolId;
  delete cloned.layoutColumn;
  return cloned;
}

export function elementVisualCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const fontSize = clampElementNumber(style.fontSize, 0, 0, 240);
  const fontWeight = clampElementNumber(style.fontWeight, 0, 0, 1000);
  const padding = clampElementNumber(style.padding, 0, 0, 160);
  const radius = clampElementNumber(style.borderRadius, 0, 0, 160);
  const lineHeight = clampElementNumber(style.lineHeight, 0, 0.7, 4);
  const letterSpacing = clampElementNumber(style.letterSpacing, 0, -10, 30);
  const opacity = clampElementNumber(style.opacity, 1, 0, 1);
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const positionX = clampElementNumber(style.positionX, 0, -4000, 4000);
  const positionY = clampElementNumber(style.positionY, 0, -4000, 4000);
  const borderWidth = clampElementNumber(style.borderWidth, 0, 0, 24);
  const borderStyle = style.borderStyle === 'dashed' || style.borderStyle === 'dotted' ? style.borderStyle : 'solid';
  return [
    `color:${style.color || 'inherit'}${suffix}`,
    `background-color:${style.backgroundColor || 'transparent'}${suffix}`,
    `font-size:${fontSize ? `${fontSize}px` : 'inherit'}${suffix}`,
    `font-weight:${fontWeight || 'inherit'}${suffix}`,
    `text-align:${style.textAlign || 'inherit'}${suffix}`,
    `line-height:${lineHeight || 'normal'}${suffix}`,
    `letter-spacing:${letterSpacing}px${suffix}`,
    `padding:${padding}px${suffix}`,
    `border-radius:${radius}px${suffix}`,
    `border-width:${borderWidth}px${suffix}`,
    `border-style:${borderWidth ? borderStyle : 'none'}${suffix}`,
    `border-color:${style.borderColor || 'transparent'}${suffix}`,
    `box-shadow:${elementShadowCss(style.shadow)}${suffix}`,
    `opacity:${opacity}${suffix}`,
    `transform:translate3d(${positionX}px,calc(${positionY}px + var(--tayar-parallax-y,0px)),0) rotate(${rotate}deg)${suffix}`,
    ...elementConstraintCss(style, suffix),
  ].join(';');
}

export function elementHoverCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const rotate = clampElementNumber(style.rotate, 0, -180, 180);
  const positionX = clampElementNumber(style.positionX, 0, -4000, 4000);
  const positionY = clampElementNumber(style.positionY, 0, -4000, 4000);
  const scale = clampElementNumber(style.hoverScale, 1, 0.5, 1.6);
  const hoverOpacity = clampElementNumber(style.hoverOpacity, style.opacity ?? 1, 0, 1);
  const rules = [
    `transform:translate3d(${positionX}px,calc(${positionY}px + var(--tayar-parallax-y,0px)),0) rotate(${rotate}deg) scale(${scale})${suffix}`,
    `opacity:${hoverOpacity}${suffix}`,
  ];
  if (style.hoverBackgroundColor) rules.push(`background-color:${style.hoverBackgroundColor}${suffix}`);
  if (style.hoverColor) rules.push(`color:${style.hoverColor}${suffix}`);
  if (style.hoverShadow) rules.push(`box-shadow:${elementShadowCss(style.hoverShadow)}${suffix}`);
  return rules.join(';');
}

export { elementAnimationEasing, elementAnimationTransform, normalizeElementAnimation } from './editor-motion';

export function elementRevealCss(style: WebsiteElement['style'], important = false, trigger: WebsiteElement['animationTrigger'] = 'scroll'): string {
  const suffix = important ? ' !important' : '';
  const animation = normalizeElementAnimation(style.animation);
  if (animation === 'none' || trigger === 'hover' || trigger === 'click') {
    return `opacity:1${suffix};transform:none${suffix};transition-property:none${suffix}`;
  }
  const duration = clampElementNumber(style.animationDuration, 650, 100, 4000);
  const delay = clampElementNumber(style.animationDelay, 0, 0, 5000);
  const distance = clampElementNumber(style.animationDistance, 36, 0, 300);
  return [
    `opacity:0${suffix}`,
    `transform:${elementAnimationTransform(animation, distance)}${suffix}`,
    `transition-property:opacity,transform${suffix}`,
    `transition-duration:${duration}ms${suffix}`,
    `transition-delay:${delay}ms${suffix}`,
    `transition-timing-function:${elementAnimationEasing(style.animationEasing)}${suffix}`,
    animation === 'blur-in' ? `filter:blur(${Math.max(2, Math.min(30, distance / 2))}px)${suffix}` : '',
    `will-change:opacity,transform${suffix}`,
  ].join(';');
}

export function elementRevealVisibleCss(style: WebsiteElement['style'], important = false): string {
  const suffix = important ? ' !important' : '';
  const animation = normalizeElementAnimation(style.animation);
  if (animation === 'none') return `opacity:1${suffix};transform:none${suffix}`;
  return `opacity:1${suffix};transform:none${suffix};filter:none${suffix}`;
}

export function elementMotionAttributes(element: WebsiteElement, style: WebsiteElement['style']): string {
  const trigger = element.animationTrigger === 'load' || element.animationTrigger === 'hover' || element.animationTrigger === 'click' ? element.animationTrigger : 'scroll';
  return [
    'data-tayar-animated',
    `data-tayar-animation="${escapeHtml(normalizeElementAnimation(style.animation))}"`,
    `data-tayar-animation-trigger="${trigger}"`,
    `data-tayar-animation-once="${element.animationOnce === false ? 'false' : 'true'}"`,
    `data-tayar-animation-duration="${clampElementNumber(style.animationDuration, 650, 100, 4000)}"`,
    `data-tayar-animation-delay="${clampElementNumber(style.animationDelay, 0, 0, 5000)}"`,
    `data-tayar-animation-distance="${clampElementNumber(style.animationDistance, 36, 0, 300)}"`,
    `data-tayar-animation-easing="${escapeHtml(elementAnimationEasing(style.animationEasing))}"`,
    `data-tayar-animation-iterations="${Math.round(clampElementNumber(style.animationIterations, 1, 1, 20))}"`,
    `data-tayar-parallax="${clampElementNumber(style.parallaxSpeed, 0, -1, 1)}"`,
  ].join(' ');
}

export function buildDesktopElementAnimationCss(sections: WebsiteSection[]): string {
  const rules: string[] = [];
  sections.forEach((section) => {
    (section.elements || []).forEach((element) => {
      const style = effectiveStyle(element, 'desktop');
      const selector = `[data-tayar-element="${cssAttributeValue(element.id)}"]`;
      rules.push(`.tayar-js ${selector}{${elementRevealCss(style, false, element.animationTrigger)}}`);
      rules.push(`.tayar-js ${selector}.tayar-visible{${elementRevealVisibleCss(style)}}`);
    });
  });
  return rules.join('\n');
}

export function elementColumnSpan(style: WebsiteElement['style'], column: number, columnCount: number): number {
  if (columnCount <= 1) return 1;
  const requested = clampElementNumber(style.columnSpan, 1, 1, columnCount);
  return Math.min(requested, Math.max(1, columnCount - column + 1));
}

export function elementSlotCss(style: WebsiteElement['style'], column: number, columnCount: number, important = false): string {
  const suffix = important ? ' !important' : '';
  const span = elementColumnSpan(style, column, columnCount);
  const align = style.alignSelf === 'start' || style.alignSelf === 'center' || style.alignSelf === 'end' || style.alignSelf === 'stretch'
    ? style.alignSelf
    : 'auto';
  const maxWidth = clampElementNumber(style.maxWidth, 0, 0, 2000);
  const minWidth = clampElementNumber(style.minWidth, 0, 0, 2400);
  const marginTop = clampElementNumber(style.marginTop, 0, -200, 400);
  const marginRight = clampElementNumber(style.marginRight, 0, -200, 400);
  const marginBottom = clampElementNumber(style.marginBottom, 0, -200, 400);
  const marginLeft = clampElementNumber(style.marginLeft, 0, -200, 400);
  const order = clampElementNumber(style.order, 0, -50, 50);
  const flexGrow = clampElementNumber(style.flexGrow, 0, 0, 20);
  const flexShrink = clampElementNumber(style.flexShrink, 1, 0, 20);
  return [
    `display:${style.hidden ? 'none' : 'flex'}${suffix}`,
    `order:${order}${suffix}`,
    `margin:${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px${suffix}`,
    `max-width:${maxWidth ? `${maxWidth}px` : 'none'}${suffix}`,
    `min-width:${minWidth ? `${minWidth}px` : '0'}${suffix}`,
    `flex-grow:${flexGrow}${suffix}`,
    `flex-shrink:${flexShrink}${suffix}`,
    `align-self:${align}${suffix}`,
    `justify-self:${align}${suffix}`,
    `grid-column:${columnCount > 1 ? `${column} / span ${span}` : '1 / span 1'}${suffix}`,
  ].join(';');
}

export function cssAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function buildDesktopElementHoverCss(sections: WebsiteSection[]): string {
  const rules: string[] = [];
  sections.forEach((section) => {
    (section.elements || []).forEach((element) => {
      const selector = `[data-tayar-element="${cssAttributeValue(element.id)}"]>.tayar-element:hover`;
      rules.push(`${selector}{${elementHoverCss(effectiveStyle(element, 'desktop'))}}`);
    });
  });
  return rules.join('\n');
}

export function buildResponsiveSectionCss(sections: WebsiteSection[]): string {
  const buildRules = (device: Device) => {
    const rules: string[] = [];
    sections.forEach((section) => {
      const style = section.responsive?.[device];
      if (!style) return;
      const selector = `[data-tayar-section-id="${cssAttributeValue(section.id)}"]`;
      const sectionRules: string[] = [];
      const minHeight = Number(style.minHeight);
      const paddingY = Number(style.sectionPaddingY);
      const paddingX = Number(style.sectionPaddingX);
      const layoutGap = Number(style.layoutGap);

      if (Number.isFinite(minHeight)) sectionRules.push(`min-height:${Math.min(1200, Math.max(0, minHeight))}px!important`);
      if (Number.isFinite(paddingY)) {
        const safe = Math.min(240, Math.max(0, paddingY));
        sectionRules.push(`padding-top:${safe}px!important`, `padding-bottom:${safe}px!important`);
      }
      if (Number.isFinite(paddingX)) {
        const safe = Math.min(160, Math.max(0, paddingX));
        sectionRules.push(`padding-left:${safe}px!important`, `padding-right:${safe}px!important`);
      }
      if (sectionRules.length) rules.push(`${selector}{${sectionRules.join(';')}}`);
      if (Number.isFinite(layoutGap)) {
        const safe = Math.min(80, Math.max(0, layoutGap));
        rules.push(`${selector} .element-stack,${selector} .section-layout{gap:${safe}px!important}`);
      }
    });
    return rules.join('\n');
  };

  return `@media(max-width:900px){\n${buildRules('tablet')}\n}\n@media(max-width:700px){\n${buildRules('mobile')}\n}`;
}

export function buildResponsiveElementCss(sections: WebsiteSection[]): string {
  const buildRules = (device: Device) => {
    const rules: string[] = [];
    sections.forEach((section) => {
      const configuredColumns = sectionColumnCount(section.layout);
      const columns = device === 'mobile' ? 1 : device === 'tablet' && configuredColumns === 3 ? 2 : configuredColumns;
      (section.elements || []).forEach((element, index) => {
        const column = columns === 1 ? 1 : Math.min(columns, elementColumn(element, index, configuredColumns));
        const style = effectiveStyle(element, device);
        const selector = `[data-tayar-element="${cssAttributeValue(element.id)}"]`;
        rules.push(`${selector}{${elementSlotCss(style, column, columns, true)}}`);
        rules.push(`.tayar-js ${selector}{${elementRevealCss(style, true, element.animationTrigger)}}`);
        rules.push(`.tayar-js ${selector}.tayar-visible{${elementRevealVisibleCss(style, true)}}`);
        rules.push(`${selector}>.tayar-element{${elementVisualCss(style, true)}}`);
        rules.push(`${selector}>.tayar-element:hover{${elementHoverCss(style, true)}}`);
      });
    });
    return rules.join('\n');
  };

  return `@media(max-width:900px){\n${buildRules('tablet')}\n}\n@media(max-width:700px){\n${buildRules('mobile')}\n}`;
}

export function sectionElementsToHtml(section: WebsiteSection, homeSlug: string, excludeButton = false, language: Language = 'en'): string {
  const elements = (section.elements || []).filter((element) => !excludeButton || element.type !== 'button');
  const columns = sectionColumnCount(section.layout);
  const gap = sectionLayoutGap(section);
  const align = sectionLayoutAlign(section);
  const containerClass = columns === 1 ? 'element-stack' : 'section-layout';
  const containerAttrs = columns === 1
    ? `style="gap:${gap}px;align-items:${align};--layout-align:${align}"`
    : `data-cols="${columns}" style="--layout-cols:${columns};--layout-gap:${gap}px;--layout-align:${align}"`;
  const containers = (section.containers || []).filter((container) => elements.some((element) => element.containerId === container.id));
  const renderedContainers = new Set<string>();
  const items: string[] = [];

  elements.forEach((element, index) => {
    const container = element.containerId ? containers.find((item) => item.id === element.containerId) : undefined;
    if (container) {
      if (renderedContainers.has(container.id)) return;
      renderedContainers.add(container.id);
      const members = elements.filter((item) => item.containerId === container.id);
      const fallbackColumn = elementColumn(element, index, columns);
      const column = containerColumn(container, fallbackColumn, columns);
      const span = containerColumnSpan(container, column, columns);
      const children = members.map((member) => {
        const style = effectiveStyle(member, 'desktop');
        return `<div class="container-element-item" data-tayar-element="${escapeHtml(member.id)}" ${elementMotionAttributes(member, style)} style="${elementSlotCss(style, 1, 1)}">${elementToHtml(member, homeSlug, 'desktop', language)}</div>`;
      }).join('\n');
      const containerColumns = Math.round(clampElementNumber(container.columns, 2, 1, 12));
      items.push(`<div class="layout-item container-slot" data-column="${column}" data-tayar-container="${escapeHtml(container.id)}" style="grid-column:${columns > 1 ? `${column} / span ${span}` : '1 / span 1'}"><div class="tayar-container" data-layout="${container.layout}" data-columns="${containerColumns}" style="${containerVisualCss(container)}">${children}</div></div>`);
      return;
    }

    const column = elementColumn(element, index, columns);
    const style = effectiveStyle(element, 'desktop');
    items.push(`<div class="layout-item" data-tayar-element="${escapeHtml(element.id)}" ${elementMotionAttributes(element, style)} data-column="${column}" style="${elementSlotCss(style, column, columns)}">${elementToHtml(element, homeSlug, 'desktop', language)}</div>`);
  });

  return `<div class="${containerClass}" ${containerAttrs}>${items.join('\n')}</div>`;
}

export function cloneSectionWithFreshIds(source: WebsiteSection, siblingSections: WebsiteSection[] = []): WebsiteSection {
  const cloned = JSON.parse(JSON.stringify(source)) as WebsiteSection;
  const containerIdMap = new Map<string, string>();
  const containers = (cloned.containers || []).map((container) => {
    const id = `container-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    containerIdMap.set(container.id, id);
    return { ...container, id };
  });
  const sourceAnchor = cloned.anchorId?.trim() || '';
  const usedAnchors = new Set(siblingSections.map((section) => section.anchorId?.trim().toLocaleLowerCase()).filter(Boolean));
  let anchorId = sourceAnchor;
  let anchorSuffix = 1;
  while (anchorId && usedAnchors.has(anchorId.toLocaleLowerCase())) {
    anchorId = `${sourceAnchor}-copy${anchorSuffix === 1 ? '' : `-${anchorSuffix}`}`;
    anchorSuffix += 1;
  }
  return {
    ...cloned,
    id: `${cloned.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    anchorId: anchorId || undefined,
    containers,
    elements: (cloned.elements || []).map((element) => ({
      ...element,
      id: `${element.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      containerId: element.containerId ? containerIdMap.get(element.containerId) : undefined,
    })),
    formFields: cloned.formFields?.map((field) => ({
      ...field,
      id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      options: field.options ? [...field.options] : undefined,
    })),
  };
}

export function createPage(name = 'New Page', slug = 'page'): WebsitePage {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    slug,
    sections: [createSection('hero'), createSection('contact')],
    showInNavigation: true,
    seoTitle: '',
    seoDescription: '',
    socialImage: '',
    canonicalUrl: '',
    language: 'en',
    translationKey: '',
    noIndex: false,
  };
}

export interface PageTemplateDefinition {
  id: string;
  name: string;
  description: string;
  sectionTypes: SectionType[];
  heroTitle: string;
  heroText: string;
  heroButton: string;
}

export interface SectionTemplateDefinition {
  id: string;
  name: string;
  description: string;
  type: SectionType;
  title: string;
  text: string;
  buttonText?: string;
}

export const PAGE_TEMPLATES: PageTemplateDefinition[] = [
  { id: 'business', name: 'Business', description: 'Professional company page with services and trust sections.', sectionTypes: ['hero', 'services', 'about', 'testimonials', 'contact', 'footer'], heroTitle: 'Build a Business Customers Trust', heroText: 'Present your company, services and proof in a clear professional website built to generate enquiries.', heroButton: 'Work With Us' },
  { id: 'landing', name: 'Landing Page', description: 'Conversion-focused page for a product, offer or campaign.', sectionTypes: ['hero', 'features', 'pricing', 'testimonials', 'contact', 'footer'], heroTitle: 'One Offer. One Clear Next Step.', heroText: 'Turn campaign traffic into action with a focused landing page built around your strongest offer.', heroButton: 'Get Started' },
  { id: 'portfolio', name: 'Portfolio', description: 'Personal or studio page focused on work, credibility and contact.', sectionTypes: ['hero', 'about', 'features', 'testimonials', 'contact', 'footer'], heroTitle: 'Work That Speaks for Itself', heroText: 'Show your best projects, explain your approach and give future clients an easy way to reach you.', heroButton: 'View My Work' },
  { id: 'ecommerce', name: 'E-commerce', description: 'Storefront-style page for products, offers and customer trust.', sectionTypes: ['hero', 'features', 'services', 'testimonials', 'pricing', 'contact', 'footer'], heroTitle: 'Products Worth Coming Back For', heroText: 'Introduce your collection, highlight what makes it different and guide shoppers toward your best offers.', heroButton: 'Shop Now' },
  { id: 'restaurant', name: 'Restaurant', description: 'Restaurant page for menu highlights, story, reviews and reservations.', sectionTypes: ['hero', 'about', 'services', 'testimonials', 'contact', 'footer'], heroTitle: 'A Table Worth Booking', heroText: 'Showcase your food, atmosphere and story while making it easy for guests to plan their next visit.', heroButton: 'Book a Table' },
  { id: 'saas', name: 'SaaS / Software', description: 'Software product page with features, plans and social proof.', sectionTypes: ['hero', 'features', 'pricing', 'testimonials', 'about', 'contact', 'footer'], heroTitle: 'Software That Makes Work Simpler', heroText: 'Explain the product fast, demonstrate the value and give teams a clear path from interest to signup.', heroButton: 'Start Free' },
  { id: 'agency', name: 'Agency', description: 'Creative or digital agency page built around services and results.', sectionTypes: ['hero', 'services', 'features', 'testimonials', 'about', 'contact', 'footer'], heroTitle: 'Ideas Turned Into Measurable Growth', heroText: 'Position your agency, showcase capabilities and make your strongest results impossible to miss.', heroButton: 'Start a Project' },
  { id: 'real-estate', name: 'Real Estate', description: 'Property-focused page for listings, expertise and lead generation.', sectionTypes: ['hero', 'features', 'services', 'about', 'testimonials', 'contact', 'footer'], heroTitle: 'Find the Right Place to Call Home', heroText: 'Present featured properties, local expertise and a direct path for buyers and sellers to contact you.', heroButton: 'Explore Properties' },
  { id: 'personal-cv', name: 'Personal / CV', description: 'Professional personal site for experience, skills and opportunities.', sectionTypes: ['hero', 'about', 'features', 'testimonials', 'contact', 'footer'], heroTitle: 'Experience, Skills and Work in One Place', heroText: 'Create a professional home for your background, strengths and the work you want to be known for.', heroButton: 'Contact Me' },
  { id: 'local-services', name: 'Local Services', description: 'Lead-focused page for trades, repair, cleaning and local professionals.', sectionTypes: ['hero', 'services', 'features', 'testimonials', 'contact', 'footer'], heroTitle: 'Reliable Local Service When You Need It', heroText: 'Explain what you do, where you work and why local customers should choose you for the job.', heroButton: 'Request a Quote' },
  { id: 'event', name: 'Event', description: 'Event or conference page for agenda, value and registration.', sectionTypes: ['hero', 'features', 'about', 'pricing', 'testimonials', 'contact', 'footer'], heroTitle: 'The Event People Will Talk About', heroText: 'Build excitement, communicate the agenda and turn interested visitors into registered attendees.', heroButton: 'Register Now' },
  { id: 'fitness', name: 'Fitness / Coach', description: 'Coach, gym or trainer page for programs, proof and enquiries.', sectionTypes: ['hero', 'services', 'features', 'pricing', 'testimonials', 'contact', 'footer'], heroTitle: 'Train With a Plan That Moves You Forward', heroText: 'Present your coaching, programs and client results with a clear path to join or book a consultation.', heroButton: 'Start Training' },
];

export const SECTION_TEMPLATES: SectionTemplateDefinition[] = [
  { id: 'hero-launch', name: 'Launch Hero', description: 'Strong opening section for a product or service launch.', type: 'hero', title: 'Launch Your Next Big Idea', text: 'Turn visitors into customers with a clear offer, a strong message and one focused action.', buttonText: 'Get Started' },
  { id: 'services-pro', name: 'Services Showcase', description: 'Professional services section for agencies and local businesses.', type: 'services', title: 'Services Built Around Your Goals', text: 'Show customers exactly how you can help them and why your approach is different.', buttonText: 'View Services' },
  { id: 'proof', name: 'Social Proof', description: 'Trust-building testimonial section.', type: 'testimonials', title: 'Trusted by Customers', text: 'Highlight real customer experiences and make your offer easier to trust.', buttonText: 'See More' },
  { id: 'cta-contact', name: 'Contact CTA', description: 'Focused contact section for turning interest into leads.', type: 'contact', title: 'Ready to Start?', text: 'Make the next step easy. Tell us what you need and we will get back to you.', buttonText: 'Contact Us' },
];

export function createSectionFromTemplate(template: SectionTemplateDefinition): WebsiteSection {
  const section = createSection(template.type);
  const elements = section.elements.map((element) => {
    if (element.type === 'heading') return { ...element, content: template.title };
    if (element.type === 'text') return { ...element, content: template.text };
    if (element.type === 'button' && template.buttonText) return { ...element, content: template.buttonText };
    return element;
  });
  return {
    ...section,
    title: template.title,
    description: template.text,
    buttonText: template.buttonText ?? section.buttonText,
    elements,
  };
}

export function normalizeAnchorId(value: string, fallback = 'section'): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export function sectionDomId(section: WebsiteSection): string {
  return normalizeAnchorId(section.anchorId || section.type, section.type);
}

export function videoSource(value: string): { kind: 'iframe' | 'video'; src: string } | null {
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  const youtube = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (youtube) return { kind: 'iframe', src: `https://www.youtube.com/embed/${youtube[1]}` };
  const vimeo = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: 'video', src: raw };
}

export function resolveBuilderHref(value: string, homeSlug = 'home'): string {
  if (!value.startsWith('page:')) return value || '#';
  const slug = normalizeSlug(value.slice(5));
  return slug === normalizeSlug(homeSlug) ? 'index.html' : `${slug}.html`;
}

export function safeFormRedirectHref(value: string, homeSlug = 'home'): string {
  const resolved = resolveBuilderHref(value || '', homeSlug).trim();
  if (!resolved || resolved === '#') return '';
  if (/^(?:https?:\/\/|\/|\.\.?\/|#)/i.test(resolved)) return resolved;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(resolved)) return resolved;
  return '';
}

export function pageHref(page: WebsitePage, homePageId: string, currentPage?: WebsitePage): string {
  const targetPath = page.outputPath || (page.id === homePageId ? 'index.html' : `${normalizeSlug(page.slug)}.html`);
  const currentPath = currentPage?.outputPath || 'index.html';
  return relativeWebsitePageHref(currentPath, targetPath);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


export function normalizeFormFieldName(value: string, fallback = 'field'): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

export function formFieldToHtml(field: WebsiteFormField): string {
  const name = escapeHtml(normalizeFormFieldName(field.name, 'field'));
  const label = escapeHtml(field.label || field.name || 'Field');
  const placeholder = escapeHtml(field.placeholder || '');
  const required = field.required ? ' required' : '';

  if (field.type === 'checkbox') {
    return `<label class="form-checkbox"><input name="${name}" type="checkbox"${required}><span>${label}</span></label>`;
  }

  if (field.type === 'textarea') {
    return `<label class="form-field"><span>${label}${field.required ? ' *' : ''}</span><textarea name="${name}" placeholder="${placeholder}" maxlength="4000"${required}></textarea></label>`;
  }

  if (field.type === 'select') {
    const options = (field.options || []).filter(Boolean).map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
    return `<label class="form-field"><span>${label}${field.required ? ' *' : ''}</span><select name="${name}"${required}><option value="">${placeholder || 'Choose an option'}</option>${options}</select></label>`;
  }

  const inputType = field.type === 'email' || field.type === 'tel' ? field.type : 'text';
  const autocomplete = field.type === 'email' ? ' autocomplete="email"' : field.type === 'tel' ? ' autocomplete="tel"' : '';
  return `<label class="form-field"><span>${label}${field.required ? ' *' : ''}</span><input name="${name}" type="${inputType}" placeholder="${placeholder}" maxlength="300"${autocomplete}${required}></label>`;
}

export function normalizeSiteUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

export function downloadTextFile(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
    centralSize += centralHeader.length;
  });

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

export function parseRichRows(value: string): Array<{ title: string; body: string }> {
  return (value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const separator = line.indexOf('|');
      if (separator < 0) return { title: `Item ${index + 1}`, body: line };
      return {
        title: line.slice(0, separator).trim() || `Item ${index + 1}`,
        body: line.slice(separator + 1).trim(),
      };
    });
}

export function safeEmbedUrl(value: string): string {
  const raw = value.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function sanitizeCustomHtml(value: string): string {
  return (value || '')
    .replace(/<\s*(script|object|embed|base|meta|link)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|object|embed|base|meta|link)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

export function elementToHtml(element: WebsiteElement, homeSlug: string, device: Device = 'desktop', language: Language = 'en'): string {
  const tr = (text: string) => localizeUi(text, language);
  const html = (text: string) => escapeHtml(tr(text));
  const style = effectiveStyle(element, device);
  const css = elementVisualCss(style);
  const value = escapeHtml(element.content || '');
  if (element.type === 'heading') return `<h2 class="tayar-element" style="${css}">${value}</h2>`;
  if (element.type === 'text') return `<p class="lead tayar-element" style="${css}">${value}</p>`;
  if (element.type === 'button') return `<a class="btn tayar-element" href="${escapeHtml(resolveBuilderHref(element.href || '#', homeSlug))}" style="${css}">${value}</a>`;
  if (element.type === 'list') {
    const items = (element.content || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return `<ul class="builder-list tayar-element" style="${css}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  if (element.type === 'divider') return `<hr class="builder-divider tayar-element" style="${css}">`;
  if (element.type === 'spacer') {
    const height = Math.max(8, Math.min(320, (clampElementNumber(style.padding, 24, 0, 160) || 24) * 2));
    return `<div class="builder-spacer tayar-element" aria-hidden="true" style="${css};height:${height}px"></div>`;
  }
  if (element.type === 'video') {
    const source = videoSource(element.src || '');
    if (!source) return `<div class="builder-video-placeholder tayar-element" style="${css}">${html('Add a YouTube, Vimeo or direct video URL')}</div>`;
    if (source.kind === 'iframe') return `<div class="builder-video tayar-element" style="${css}"><iframe src="${escapeHtml(source.src)}" title="${value || html('Video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    return `<video class="builder-video-file tayar-element" src="${escapeHtml(source.src)}" controls preload="metadata" style="${css}"></video>`;
  }
  if (element.type === 'accordion') {
    const rows = parseRichRows(element.content);
    return `<div class="builder-accordion tayar-element" style="${css}">${rows.map((row, index) => `<details${index === 0 ? ' open' : ''}><summary>${escapeHtml(row.title)}</summary><div>${escapeHtml(row.body)}</div></details>`).join('')}</div>`;
  }
  if (element.type === 'tabs') {
    const rows = parseRichRows(element.content);
    const safeId = element.id.replace(/[^a-zA-Z0-9_-]/g, '-');
    const inputs = rows.map((row, index) => `<input class="tayar-tab-input" type="radio" name="tabs-${safeId}" id="tabs-${safeId}-${index}"${index === 0 ? ' checked' : ''}>`).join('');
    const labels = rows.map((row, index) => `<label for="tabs-${safeId}-${index}">${escapeHtml(row.title)}</label>`).join('');
    const panels = rows.map((row, index) => `<div class="tayar-tab-panel" data-tab-panel="${index}">${escapeHtml(row.body)}</div>`).join('');
    const selectors = rows.map((_, index) => `#tabs-${safeId}-${index}:checked ~ .tayar-tab-panels [data-tab-panel="${index}"]{display:block}`).join('');
    return `<div class="builder-tabs tayar-element" style="${css}"><style>${selectors}</style>${inputs}<div class="tayar-tab-labels">${labels}</div><div class="tayar-tab-panels">${panels}</div></div>`;
  }
  if (element.type === 'gallery') {
    const images = (element.content || '').split(/\r?\n/).map((item) => safeEmbedUrl(item)).filter(Boolean);
    return `<div class="builder-gallery tayar-element" style="${css}">${images.map((src, index) => `<img src="${escapeHtml(src)}" alt="${html('Gallery image')} ${index + 1}" loading="lazy">`).join('')}</div>`;
  }
  if (element.type === 'embed') {
    const source = safeEmbedUrl(element.src || '');
    if (!source) return `<div class="builder-embed-placeholder tayar-element" style="${css}">${html('Add a map or embed URL')}</div>`;
    return `<div class="builder-embed tayar-element" style="${css}"><iframe src="${escapeHtml(source)}" title="${value || html('Embedded content')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`;
  }
  if (element.type === 'countdown') {
    const [rawTarget, ...labelParts] = (element.content || '').split('|');
    const target = rawTarget.trim();
    const label = labelParts.join('|').trim() || tr('Countdown');
    return `<div class="builder-countdown tayar-element" data-tayar-countdown data-target="${escapeHtml(target)}" style="${css}"><p class="countdown-label">${escapeHtml(label)}</p><div class="countdown-grid"><span><strong data-unit="days">00</strong><small>${html('Days')}</small></span><span><strong data-unit="hours">00</strong><small>${html('Hours')}</small></span><span><strong data-unit="minutes">00</strong><small>${html('Minutes')}</small></span><span><strong data-unit="seconds">00</strong><small>${html('Seconds')}</small></span></div></div>`;
  }
  if (element.type === 'stats') {
    const rows = parseRichRows(element.content);
    return `<div class="builder-stats tayar-element" style="${css}">${rows.map((row) => `<div class="stat-card"><strong data-tayar-counter data-target="${escapeHtml(row.title)}">0</strong><span>${escapeHtml(row.body)}</span></div>`).join('')}</div>`;
  }
  if (element.type === 'testimonials-slider') {
    const rows = parseRichRows(element.content);
    return `<div class="builder-testimonials tayar-element" data-tayar-testimonials style="${css}"><div class="testimonial-track">${rows.map((row, index) => `<article class="testimonial-slide${index === 0 ? ' active' : ''}" data-slide="${index}"><p>“${escapeHtml(row.body)}”</p><strong>— ${escapeHtml(row.title)}</strong></article>`).join('')}</div><div class="testimonial-controls"><button type="button" data-testimonial-prev aria-label="${html('Previous testimonial')}">←</button><span data-testimonial-position>1 / ${Math.max(rows.length, 1)}</span><button type="button" data-testimonial-next aria-label="${html('Next testimonial')}">→</button></div></div>`;
  }
  if (element.type === 'code') {
    return `<div class="builder-custom-html tayar-element" style="${css}">${sanitizeCustomHtml(element.content)}</div>`;
  }
  if (element.type === 'image' && element.src) return `<img class="builder-image tayar-element" src="${escapeHtml(element.src)}" alt="${value}" loading="lazy" decoding="async" style="${css}">`;
  return '';
}

export function sectionToHtml(section: WebsiteSection, homeSlug: string, leadCapture?: LeadCaptureConfig, language: Language = 'en'): string {
  const tr = (text: string) => localizeUi(text, language);
  const html = (text: string) => escapeHtml(tr(text));
  const sectionId = escapeHtml(sectionDomId(section));
  if (section.type === 'contact') {
    const submitElement = (section.elements || []).find((element) => element.type === 'button');
    const submitLabel = escapeHtml(submitElement?.content || section.buttonText || tr('Send Message'));
    const enabled = Boolean(leadCapture?.projectId && leadCapture?.supabaseUrl && leadCapture?.supabaseAnonKey);
    const setupMessage = enabled ? '' : tr('Lead capture is disabled in previews and activates on a published cloud website.');
    const submitButton = submitElement
      ? (() => {
          const submitStyle = effectiveStyle(submitElement, 'desktop');
          return `<div class="layout-item" data-tayar-element="${escapeHtml(submitElement.id)}" ${elementMotionAttributes(submitElement, submitStyle)} data-column="1" style="${elementSlotCss(submitStyle, 1, 1)}"><button class="btn tayar-element" type="submit" style="${elementVisualCss(submitStyle)}"${enabled ? '' : ' disabled'}>${submitLabel}</button></div>`;
        })()
      : `<button class="btn" type="submit"${enabled ? '' : ' disabled'}>${submitLabel}</button>`;

    return `
<section id="${sectionId}" data-tayar-section-id="${escapeHtml(section.id)}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    ${sectionElementsToHtml(section, homeSlug, true, language)}
    <form class="contact-box" data-tayar-lead-form data-success-message="${escapeHtml(section.formSuccessMessage || tr('Thanks! Your message has been sent.'))}" data-success-action="${section.formSuccessAction === 'redirect' ? 'redirect' : 'message'}" data-redirect-url="${escapeHtml(section.formRedirectUrl ? safeFormRedirectHref(section.formRedirectUrl, homeSlug) : '')}">
      <label class="tayar-honeypot" aria-hidden="true">${html('Company')}<input name="_tayar_company" type="text" tabindex="-1" autocomplete="off"></label>
      ${(section.formFields ?? createDefaultContactFormFields()).map(formFieldToHtml).join('\n      ')}
      ${submitButton}
      <p class="form-status" data-form-status aria-live="polite">${escapeHtml(setupMessage)}</p>
    </form>
  </div>
</section>`;
  }

  if (section.elements?.length) {
    return `\n<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">\n  <div class="${sectionContainerClass(section)}">${sectionElementsToHtml(section, homeSlug)}</div>\n</section>`;
  }
  const title = escapeHtml(section.title);
  const description = escapeHtml(section.description);
  const button = section.buttonText
    ? `<a class="btn" href="${escapeHtml(section.buttonUrl || '#')}">${escapeHtml(section.buttonText)}</a>`
    : '';

  if (section.type === 'footer') {
    return `
<footer id="${sectionId}" data-tayar-section-id="${escapeHtml(section.id)}" class="section footer" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
</footer>`;
  }

  if (section.type === 'features') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">${html('Features')}</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><div class="icon">01</div><h3>${html('Fast')}</h3><p>${html('Built for speed and a smooth user experience.')}</p></article>
      <article class="card"><div class="icon">02</div><h3>${html('Powerful')}</h3><p>${html('Flexible tools that help your business grow.')}</p></article>
      <article class="card"><div class="icon">03</div><h3>${html('Easy')}</h3><p>${html('Simple experiences your customers understand.')}</p></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'services') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">${html('Services')}</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><h3>${html('Consulting')}</h3><p>${html('Professional guidance tailored to your goals.')}</p></article>
      <article class="card"><h3>${html('Development')}</h3><p>${html('Modern digital solutions built for your business.')}</p></article>
      <article class="card"><h3>${html('Support')}</h3><p>${html('Reliable help when you need it most.')}</p></article>
    </div>
    ${button}
  </div>
</section>`;
  }

  if (section.type === 'pricing') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">${html('Pricing')}</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="pricing">
      <article class="price"><h3>${html('Starter')}</h3><strong>$9</strong><p>${html('For getting started.')}</p><a class="btn secondary" href="${escapeHtml(section.buttonUrl || '#')}">${html('Choose')}</a></article>
      <article class="price featured"><h3>Pro</h3><strong>$29</strong><p>${html('For growing businesses.')}</p><a class="btn" href="${escapeHtml(section.buttonUrl || '#')}">${html('Choose')}</a></article>
      <article class="price"><h3>${html('Business')}</h3><strong>$79</strong><p>${html('For advanced needs.')}</p><a class="btn secondary" href="${escapeHtml(section.buttonUrl || '#')}">${html('Choose')}</a></article>
    </div>
  </div>
</section>`;
  }

  if (section.type === 'testimonials') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">${html('Testimonials')}</span>
    <h2>${title}</h2>
    <p class="lead">${description}</p>
    <div class="cards">
      <article class="card"><p>“${html('Amazing experience and excellent results.')}”</p><strong>— Alex</strong></article>
      <article class="card"><p>“${html('Professional, simple and exactly what we needed.')}”</p><strong>— Sarah</strong></article>
      <article class="card"><p>“${html('The easiest way to present our business online.')}”</p><strong>— Daniel</strong></article>
    </div>
    ${button}
  </div>
</section>`;
  }


  if (section.type === 'about') {
    return `
<section id="${sectionId}" class="section" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)} split">
    <div>
      <span class="eyebrow">${html('About')}</span>
      <h2>${title}</h2>
      <p class="lead">${description}</p>
      ${button}
    </div>
    <div class="visual" style="border-color:${section.accent}55">
      <span style="background:${section.accent}">${html('About')}</span>
    </div>
  </div>
</section>`;
  }

  return `
<section id="${sectionId}" class="section hero" style="${sectionInlineCss(section)}">
  <div class="${sectionContainerClass(section)}">
    <span class="eyebrow">${html('Your Brand')}</span>
    <h1>${title}</h1>
    <p class="lead">${description}</p>
    ${button}
  </div>
</section>`;
}

export function buildFullHtml(
  sections: WebsiteSection[],
  options: {
    language: Language;
    title: string;
    description: string;
    pages: WebsitePage[];
    homePageId: string;
    currentPageId: string;
    siteName: string;
    keywords?: string[];
    canonicalUrl?: string;
    faviconUrl?: string;
    socialImageUrl?: string;
    noIndex?: boolean;
    alternateLinks?: Array<{ language: Language; href: string; isDefault?: boolean }>;
    theme?: WebsiteTheme;
    headerConfig?: WebsiteHeaderConfig;
    footerConfig?: WebsiteFooterConfig;
    siteEnhancements?: WebsiteSiteEnhancements;
    productionConfig?: WebsiteProductionConfig;
    leadProjectId?: string | null;
    analyticsProjectId?: string | null;
    analyticsEnabled?: boolean;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  }
): string {
  const theme = normalizeTheme(options.theme);
  const desktopElementHoverCss = buildDesktopElementHoverCss(sections);
  const desktopElementAnimationCss = buildDesktopElementAnimationCss(sections);
  const responsiveSectionCss = buildResponsiveSectionCss(sections);
  const responsiveElementCss = buildResponsiveElementCss(sections);
  const headerConfig = normalizeHeaderConfig(options.headerConfig);
  const footerConfig = normalizeFooterConfig(options.footerConfig);
  const siteEnhancements = normalizeSiteEnhancements(options.siteEnhancements);
  const productionConfig = normalizeProductionConfig(options.productionConfig);
  const runtimeText = (text: string) => localizeUi(text, options.language);
  const runtimeHtml = (text: string) => escapeHtml(runtimeText(text));
  const runtimeJs = (text: string) => JSON.stringify(runtimeText(text)).replace(/</g, '\\u003c');
  const defaultHomePage = options.pages.find((page) => page.id === options.homePageId) || options.pages[0];
  const homePage = options.pages.find((page) => defaultHomePage?.translationKey
    && page.translationKey === defaultHomePage.translationKey
    && normalizePageLanguage(page.language, options.language) === options.language) || defaultHomePage;
  const homeSlug = homePage?.slug || 'home';
  const leadCapture: LeadCaptureConfig | undefined = options.leadProjectId && options.supabaseUrl && options.supabaseAnonKey
    ? {
        projectId: options.leadProjectId,
        supabaseUrl: options.supabaseUrl,
        supabaseAnonKey: options.supabaseAnonKey,
      }
    : undefined;
  const body = sections.map((section) => sectionToHtml(section, homeSlug, leadCapture, options.language)).join('\n');
  const faqItems = sections.flatMap((section) => (section.elements || []).filter((element) => element.type === 'accordion').flatMap((element) => parseRichRows(element.content))).slice(0, 50);
  const faqSchema = faqItems.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.title, acceptedAnswer: { '@type': 'Answer', text: item.body } })) }).replace(/</g, '\\u003c')}</script>` : '';
  const direction = options.language === 'ar' ? 'rtl' : 'ltr';
  const navigationPages = options.pages.filter((page) =>
    page.showInNavigation !== false && normalizePageLanguage(page.language, options.language) === options.language
  );
  const currentPage = options.pages.find((page) => page.id === options.currentPageId);
  const translationKey = currentPage?.translationKey?.trim();
  const translationPages = translationKey
    ? options.pages.filter((page) => page.translationKey?.trim() === translationKey)
    : [];
  const brandLabel = headerConfig.brandText.trim() || options.siteName;
  const headerLogo = headerConfig.logoUrl
    ? `<img class="site-logo" src="${escapeHtml(headerConfig.logoUrl)}" alt="${escapeHtml(brandLabel)}">`
    : '';
  const headerCta = headerConfig.showCta
    ? `<a class="site-cta" href="${escapeHtml(resolveBuilderHref(headerConfig.ctaHref, homeSlug))}">${escapeHtml(headerConfig.ctaLabel)}</a>`
    : '';
  const searchTrigger = siteEnhancements.siteSearch
    ? `<button class="site-search-trigger" type="button" data-site-search-open aria-label="${runtimeHtml('Search website')}">⌕ <span>${runtimeHtml('Search')}</span></button>`
    : '';
  const languageSwitcher = headerConfig.languageSwitcher && translationPages.length > 1
    ? `<div class="site-language-switcher" aria-label="${runtimeHtml('Language')}">${translationPages.map((page) => {
        const lang = normalizePageLanguage(page.language, options.language);
        return `<a href="${escapeHtml(pageHref(page, options.homePageId, currentPage))}" hreflang="${lang}"${page.id === options.currentPageId ? ' class="active"' : ''}>${escapeHtml(languageCodeLabel(lang))}</a>`;
      }).join('')}</div>`
    : '';
  const navigation = headerConfig.enabled
    ? `<nav class="site-nav${headerConfig.sticky ? ' sticky' : ''}${headerConfig.mobileMenu ? ' mobile-menu' : ''}" data-tayar-mobile-nav><a class="site-brand" href="${escapeHtml(pageHref(homePage, options.homePageId, currentPage))}"><span class="site-brand-wrap">${headerLogo}<span>${escapeHtml(brandLabel)}</span></span></a>${headerConfig.mobileMenu ? `<button class="site-menu-toggle" type="button" aria-expanded="false" aria-label="${runtimeHtml('Toggle navigation')}"><span aria-hidden="true">☰</span><span>${runtimeHtml('Menu')}</span></button>` : ''}<div class="site-links">${navigationPages.map((page) => `<a href="${escapeHtml(pageHref(page, options.homePageId, currentPage))}"${page.id === options.currentPageId ? ' class="active"' : ''}>${escapeHtml(page.name)}</a>`).join('')}${languageSwitcher}${searchTrigger}${headerCta}</div></nav>`
    : '';

  const navigationScript = headerConfig.enabled && headerConfig.mobileMenu ? `<script>
(() => {
  document.querySelectorAll('[data-tayar-mobile-nav]').forEach((nav) => {
    const button = nav.querySelector('.site-menu-toggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const open = nav.classList.toggle('menu-open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('.site-links a').forEach((link) => link.addEventListener('click', () => {
      nav.classList.remove('menu-open');
      button.setAttribute('aria-expanded', 'false');
    }));
  });
})();
</script>` : '';

  const socialLinks = [
    ['Instagram', footerConfig.instagramUrl],
    ['Facebook', footerConfig.facebookUrl],
    ['LinkedIn', footerConfig.linkedinUrl],
    ['X', footerConfig.xUrl],
  ].filter((item) => item[1]);
  const footerNavigation = footerConfig.showNavigation
    ? navigationPages.map((page) => `<a href="${escapeHtml(pageHref(page, options.homePageId, currentPage))}">${escapeHtml(page.name)}</a>`).join('')
    : '';
  const footerSocials = socialLinks
    .map(([label, href]) => `<a href="${escapeHtml(safeSocialUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`)
    .join('');
  const footerText = footerConfig.text.trim() || `© ${new Date().getFullYear()} ${options.siteName}. All rights reserved.`;
  const globalFooter = footerConfig.enabled
    ? `<footer class="global-site-footer"><div class="footer-inner"><div><strong>${escapeHtml(brandLabel)}</strong><p>${escapeHtml(footerText)}</p></div>${footerNavigation ? `<div class="footer-links">${footerNavigation}</div>` : ''}${footerSocials ? `<div class="footer-socials">${footerSocials}</div>` : ''}</div></footer>`
    : '';

  const leadScript = leadCapture ? `<script>
(() => {
  const endpoint = ${JSON.stringify(leadCapture.supabaseUrl + '/rest/v1/rpc/submit_website_form')};
  const anonKey = ${JSON.stringify(leadCapture.supabaseAnonKey)};
  const projectId = ${JSON.stringify(leadCapture.projectId)};

  document.querySelectorAll('[data-tayar-lead-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('[data-form-status]');
      const submitButton = form.querySelector('button[type="submit"]');
      const formData = new FormData(form);
      const values = {};
      const params = new URLSearchParams(location.search);
      form.querySelectorAll('[name]').forEach((field) => {
        const name = field.getAttribute('name');
        if (!name) return;
        if (field instanceof HTMLInputElement && field.type === 'checkbox') {
          values[name] = field.checked;
          return;
        }
        values[name] = String(formData.get(name) || '');
      });
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
        const value = params.get(key);
        if (value) values['_' + key] = value.slice(0, 300);
      });
      if (document.referrer) values._referrer = String(document.referrer).slice(0, 500);
      values._page_language = document.documentElement.lang || '';

      if (status) status.textContent = 'Sending…';
      if (submitButton) submitButton.disabled = true;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: 'Bearer ' + anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_project_id: projectId,
            p_form_data: values,
            p_page_path: (location.pathname + location.search).slice(0, 500),
          }),
        });

        if (!response.ok) throw new Error('Lead submission failed');
        form.reset();
        const successAction = form.dataset.successAction || 'message';
        const redirectUrl = form.dataset.redirectUrl || '';
        if (typeof window.tayarTrackEvent === 'function') {
          window.tayarTrackEvent('form_submit', { page: location.pathname, language: document.documentElement.lang || '', success_action: successAction });
        }
        if (successAction === 'redirect' && redirectUrl) {
          if (status) status.textContent = 'Thanks! Redirecting…';
          window.setTimeout(() => location.assign(redirectUrl), 250);
        } else if (status) {
          status.textContent = form.dataset.successMessage || 'Thanks! Your message has been sent.';
        }
      } catch {
        if (status) status.textContent = 'Could not send your message. Please try again.';
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  });
})();
</script>` : '';

  const analyticsEnabled = Boolean(
    options.analyticsEnabled && options.analyticsProjectId && options.supabaseUrl && options.supabaseAnonKey
  );
  const analyticsScript = analyticsEnabled ? `<script>
(() => {
  const endpoint = ${JSON.stringify((options.supabaseUrl || '') + '/rest/v1/rpc/track_website_page_view')};
  const eventEndpoint = ${JSON.stringify((options.supabaseUrl || '') + '/rest/v1/rpc/track_website_event')};
  const anonKey = ${JSON.stringify(options.supabaseAnonKey || '')};
  const projectId = ${JSON.stringify(options.analyticsProjectId || '')};
  const storageKey = 'tayar.analytics.session';
  let sessionId = '';

  try {
    sessionId = sessionStorage.getItem(storageKey) || '';
    if (!sessionId) {
      sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
      sessionStorage.setItem(storageKey, sessionId);
    }
  } catch {
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  window.tayarTrackEvent = (eventType, eventData = {}) => {
    fetch(eventEndpoint, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_project_id: projectId,
        p_page_path: (location.pathname + location.search).slice(0, 500),
        p_referrer: String(document.referrer || '').slice(0, 500),
        p_session_id: sessionId.slice(0, 100),
        p_event_type: String(eventType || '').slice(0, 40),
        p_event_data: eventData || {},
      }),
    }).catch(() => {});
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;
    if (!target.matches('.btn,.site-cta,.floating-cta,[data-popup-cta]')) return;
    window.tayarTrackEvent('cta_click', {
      text: String(target.textContent || '').trim().slice(0, 120),
      href: target instanceof HTMLAnchorElement ? target.href.slice(0, 500) : '',
    });
  });

  fetch(endpoint, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_project_id: projectId,
      p_page_path: (location.pathname + location.search).slice(0, 500),
      p_referrer: String(document.referrer || '').slice(0, 500),
      p_session_id: sessionId.slice(0, 100),
    }),
  }).catch(() => {});
})();
</script>` : '';

  const cookieBanner = siteEnhancements.cookieBanner
    ? `<div class="tayar-cookie-banner" data-tayar-cookie hidden><p>${escapeHtml(siteEnhancements.cookieText)}</p><button type="button" data-cookie-accept>${escapeHtml(siteEnhancements.cookieButtonLabel)}</button></div>`
    : '';
  const scrollProgress = siteEnhancements.scrollProgress ? '<div class="tayar-scroll-progress" data-scroll-progress></div>' : '';
  const backToTop = siteEnhancements.backToTop ? `<button class="tayar-back-to-top" type="button" data-back-to-top aria-label="${runtimeHtml('Back to top')}">↑</button>` : '';
  const announcementBar = siteEnhancements.announcementBar
    ? `<aside class="tayar-announcement" role="status"><span>${escapeHtml(siteEnhancements.announcementText)}</span>${siteEnhancements.announcementHref && siteEnhancements.announcementHref !== '#' ? `<a href="${escapeHtml(resolveBuilderHref(siteEnhancements.announcementHref, homeSlug))}">${escapeHtml(siteEnhancements.announcementLinkLabel)}</a>` : ''}</aside>`
    : '';
  const popupModal = siteEnhancements.popupEnabled
    ? `<div class="tayar-popup-backdrop" data-tayar-popup hidden><div class="tayar-popup" role="dialog" aria-modal="true" aria-label="${escapeHtml(siteEnhancements.popupTitle)}"><button class="tayar-popup-close" type="button" data-popup-close aria-label="${runtimeHtml('Close')}">×</button><h2>${escapeHtml(siteEnhancements.popupTitle)}</h2><p>${escapeHtml(siteEnhancements.popupText)}</p><a class="btn" href="${escapeHtml(resolveBuilderHref(siteEnhancements.popupButtonHref, homeSlug))}">${escapeHtml(siteEnhancements.popupButtonLabel)}</a></div></div>`
    : '';
  const floatingCta = siteEnhancements.floatingCta
    ? `<a class="tayar-floating-cta" href="${escapeHtml(resolveBuilderHref(siteEnhancements.floatingCtaHref, homeSlug))}">${escapeHtml(siteEnhancements.floatingCtaLabel)}</a>`
    : '';
  const shareButtons = siteEnhancements.shareButtons
    ? `<div class="tayar-share-tools" data-share-tools><button type="button" data-share-native>${runtimeHtml('Share')}</button><button type="button" data-share-copy>${runtimeHtml('Copy link')}</button></div>`
    : '';
  const lightbox = siteEnhancements.galleryLightbox
    ? `<div class="tayar-lightbox" data-tayar-lightbox hidden><button type="button" data-lightbox-close aria-label="${runtimeHtml('Close image')}">×</button><img data-lightbox-image alt="${runtimeHtml('Gallery preview')}"></div>`
    : '';
  const searchIndex = options.pages.map((page) => ({
    title: page.name,
    href: pageHref(page, options.homePageId, currentPage),
    text: page.sections.flatMap((section) => [section.title, section.description, ...(section.elements || []).map((element) => element.content || '')]).join(' ').replace(/\s+/g, ' ').trim().slice(0, 6000),
  }));
  const searchOverlay = siteEnhancements.siteSearch
    ? `<div class="tayar-search-overlay" data-site-search hidden><div class="tayar-search-dialog" role="dialog" aria-modal="true" aria-label="${runtimeHtml('Search website')}"><div class="tayar-search-head"><strong>${runtimeHtml('Search this site')}</strong><button type="button" data-site-search-close aria-label="${runtimeHtml('Close search')}">×</button></div><input data-site-search-input type="search" placeholder="${runtimeHtml('Search pages…')}" autocomplete="off"><div class="tayar-search-results" data-site-search-results><p>${runtimeHtml('Start typing to search.')}</p></div></div></div>`
    : '';
  const searchIndexJson = JSON.stringify(searchIndex).replace(/</g, '\\u003c');

  const interactiveWidgetsScript = `<script>
(() => {
  document.querySelectorAll('[data-tayar-countdown]').forEach((root) => {
    const target = new Date(root.getAttribute('data-target') || '').getTime();
    const units = { days: root.querySelector('[data-unit="days"]'), hours: root.querySelector('[data-unit="hours"]'), minutes: root.querySelector('[data-unit="minutes"]'), seconds: root.querySelector('[data-unit="seconds"]') };
    const render = () => {
      const diff = Number.isFinite(target) ? Math.max(0, target - Date.now()) : 0;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (units.days) units.days.textContent = String(days).padStart(2, '0');
      if (units.hours) units.hours.textContent = String(hours).padStart(2, '0');
      if (units.minutes) units.minutes.textContent = String(minutes).padStart(2, '0');
      if (units.seconds) units.seconds.textContent = String(seconds).padStart(2, '0');
    };
    render();
    window.setInterval(render, 1000);
  });

  const animateCounter = (node) => {
    if (node.dataset.counted === 'true') return;
    node.dataset.counted = 'true';
    const raw = node.getAttribute('data-target') || '0';
    const match = raw.match(/-?\\d+(?:\\.\\d+)?/);
    if (!match) { node.textContent = raw; return; }
    const target = Number(match[0]);
    const prefix = raw.slice(0, match.index || 0);
    const suffix = raw.slice((match.index || 0) + match[0].length);
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const value = target * (1 - Math.pow(1 - progress, 3));
      const formatted = Number.isInteger(target) ? Math.round(value) : value.toFixed(1);
      node.textContent = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counters = Array.from(document.querySelectorAll('[data-tayar-counter]'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { animateCounter(entry.target); observer.unobserve(entry.target); } }), { threshold: .35 });
    counters.forEach((node) => observer.observe(node));
  } else counters.forEach(animateCounter);

  document.querySelectorAll('[data-tayar-testimonials]').forEach((root) => {
    const slides = Array.from(root.querySelectorAll('[data-slide]'));
    if (!slides.length) return;
    let index = 0;
    const position = root.querySelector('[data-testimonial-position]');
    const show = (next) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
      if (position) position.textContent = (index + 1) + ' / ' + slides.length;
    };
    root.querySelector('[data-testimonial-prev]')?.addEventListener('click', () => show(index - 1));
    root.querySelector('[data-testimonial-next]')?.addEventListener('click', () => show(index + 1));
    if (slides.length > 1) window.setInterval(() => show(index + 1), 6500);
    show(0);
  });

  const cookie = document.querySelector('[data-tayar-cookie]');
  if (cookie) {
    let accepted = false;
    try { accepted = localStorage.getItem('tayar.cookie.accepted') === 'yes'; } catch {}
    if (!accepted) cookie.hidden = false;
    cookie.querySelector('[data-cookie-accept]')?.addEventListener('click', () => {
      try { localStorage.setItem('tayar.cookie.accepted', 'yes'); } catch {}
      cookie.hidden = true;
    });
  }

  const progress = document.querySelector('[data-scroll-progress]');
  const back = document.querySelector('[data-back-to-top]');
  const updateScrollUi = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const ratio = Math.max(0, Math.min(1, scrollY / max));
    if (progress) progress.style.transform = 'scaleX(' + ratio + ')';
    if (back) back.classList.toggle('visible', scrollY > 420);
  };
  addEventListener('scroll', updateScrollUi, { passive: true });
  back?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  updateScrollUi();

  const popup = document.querySelector('[data-tayar-popup]');
  if (popup) {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('tayar.popup.dismissed') === 'yes'; } catch {}
    const closePopup = () => {
      popup.hidden = true;
      try { sessionStorage.setItem('tayar.popup.dismissed', 'yes'); } catch {}
    };
    popup.querySelector('[data-popup-close]')?.addEventListener('click', closePopup);
    popup.addEventListener('click', (event) => { if (event.target === popup) closePopup(); });
    if (!dismissed) window.setTimeout(() => { popup.hidden = false; }, ${Math.round(siteEnhancements.popupDelaySeconds * 1000)});
  }

  const lightbox = document.querySelector('[data-tayar-lightbox]');
  const lightboxImage = lightbox?.querySelector('[data-lightbox-image]');
  if (lightbox && lightboxImage) {
    const close = () => { lightbox.hidden = true; lightboxImage.removeAttribute('src'); };
    document.querySelectorAll('.builder-gallery img').forEach((image) => {
      image.setAttribute('tabindex', '0');
      image.setAttribute('role', 'button');
      const open = () => { lightboxImage.setAttribute('src', image.getAttribute('src') || ''); lightbox.hidden = false; };
      image.addEventListener('click', open);
      image.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    lightbox.querySelector('[data-lightbox-close]')?.addEventListener('click', close);
    lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); });
  }

  document.querySelector('[data-share-native]')?.addEventListener('click', async () => {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  });
  document.querySelector('[data-share-copy]')?.addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = ${runtimeJs('Copied')};
      window.setTimeout(() => { event.currentTarget.textContent = ${runtimeJs('Copy link')}; }, 1600);
    } catch {}
  });

  const searchOverlay = document.querySelector('[data-site-search]');
  const searchInput = searchOverlay?.querySelector('[data-site-search-input]');
  const searchResults = searchOverlay?.querySelector('[data-site-search-results]');
  const searchData = ${searchIndexJson};
  const closeSearch = () => { if (searchOverlay) searchOverlay.hidden = true; };
  document.querySelectorAll('[data-site-search-open]').forEach((button) => button.addEventListener('click', () => {
    if (!searchOverlay) return;
    searchOverlay.hidden = false;
    window.setTimeout(() => searchInput?.focus(), 0);
  }));
  searchOverlay?.querySelector('[data-site-search-close]')?.addEventListener('click', closeSearch);
  searchOverlay?.addEventListener('click', (event) => { if (event.target === searchOverlay) closeSearch(); });
  searchInput?.addEventListener('input', () => {
    if (!searchResults) return;
    const query = String(searchInput.value || '').trim().toLowerCase();
    if (query.length < 2) { searchResults.innerHTML = '<p>' + ${runtimeJs('Type at least 2 characters.')} + '</p>'; return; }
    const matches = searchData.filter((item) => (item.title + ' ' + item.text).toLowerCase().includes(query)).slice(0, 8);
    searchResults.innerHTML = matches.length
      ? matches.map((item) => '<a href="' + item.href.replace(/"/g, '&quot;') + '"><strong>' + item.title.replace(/</g, '&lt;') + '</strong><span>' + item.text.slice(0, 150).replace(/</g, '&lt;') + '</span></a>').join('')
      : '<p>' + ${runtimeJs('No matching pages found.')} + '</p>';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeSearch(); if (popup && !popup.hidden) popup.hidden = true; if (lightbox && !lightbox.hidden) lightbox.hidden = true; }
  });
})();
</script>`;

  const motionScript = `<script>
(() => {
  const items = Array.from(document.querySelectorAll('[data-tayar-animated]'));
  if (!items.length) return;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    items.forEach((item) => item.classList.add('tayar-visible'));
    return;
  }

  const byTrigger = (trigger) => items.filter((item) => (item.getAttribute('data-tayar-animation-trigger') || 'scroll') === trigger);
  const loadItems = byTrigger('load');
  requestAnimationFrame(() => loadItems.forEach((item) => item.classList.add('tayar-visible')));

  const scrollItems = byTrigger('scroll');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const item = entry.target;
        if (entry.isIntersecting) {
          item.classList.add('tayar-visible');
          if (item.getAttribute('data-tayar-animation-once') !== 'false') observer.unobserve(item);
        } else if (item.getAttribute('data-tayar-animation-once') === 'false') {
          item.classList.remove('tayar-visible');
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    scrollItems.forEach((item) => observer.observe(item));
  } else scrollItems.forEach((item) => item.classList.add('tayar-visible'));

  const playMotion = (item) => {
    const animation = item.getAttribute('data-tayar-animation') || 'none';
    if (animation === 'none' || typeof item.animate !== 'function') return;
    const distance = Math.max(0, Math.min(300, Number(item.getAttribute('data-tayar-animation-distance')) || 36));
    let transform = 'none';
    if (animation === 'fade-up' || animation === 'slide-up') transform = 'translate3d(0,' + distance + 'px,0)';
    if (animation === 'fade-down' || animation === 'slide-down') transform = 'translate3d(0,-' + distance + 'px,0)';
    if (animation === 'fade-left' || animation === 'slide-left') transform = 'translate3d(' + distance + 'px,0,0)';
    if (animation === 'fade-right' || animation === 'slide-right') transform = 'translate3d(-' + distance + 'px,0,0)';
    if (animation === 'zoom-in') transform = 'scale(.86)';
    if (animation === 'zoom-out') transform = 'scale(1.14)';
    if (animation === 'flip-in') transform = 'perspective(900px) rotateX(-18deg)';
    if (animation === 'bounce-in') transform = 'translate3d(0,24px,0) scale(.94)';
    const blur = animation === 'blur-in' ? 'blur(' + Math.max(2, Math.min(30, distance / 2)) + 'px)' : 'none';
    item.getAnimations().forEach((running) => running.cancel());
    item.animate(
      [{ opacity: animation === 'fade' || animation.startsWith('fade') || animation === 'blur-in' ? 0 : .35, transform, filter: blur }, { opacity: 1, transform: 'none', filter: 'none' }],
      {
        duration: Math.max(100, Math.min(4000, Number(item.getAttribute('data-tayar-animation-duration')) || 650)),
        delay: Math.max(0, Math.min(5000, Number(item.getAttribute('data-tayar-animation-delay')) || 0)),
        easing: item.getAttribute('data-tayar-animation-easing') || 'cubic-bezier(.22,1,.36,1)',
        iterations: Math.max(1, Math.min(20, Number(item.getAttribute('data-tayar-animation-iterations')) || 1)),
      },
    );
  };
  byTrigger('hover').forEach((item) => item.addEventListener('pointerenter', () => playMotion(item)));
  byTrigger('click').forEach((item) => item.addEventListener('click', () => playMotion(item)));

  const parallaxItems = items.filter((item) => Math.abs(Number(item.getAttribute('data-tayar-parallax')) || 0) >= .01);
  if (parallaxItems.length) {
    let scheduled = false;
    const updateParallax = () => {
      scheduled = false;
      const viewportCenter = window.innerHeight / 2;
      parallaxItems.forEach((item) => {
        const speed = Math.max(-1, Math.min(1, Number(item.getAttribute('data-tayar-parallax')) || 0));
        const rect = item.getBoundingClientRect();
        const offset = Math.max(-160, Math.min(160, (rect.top + rect.height / 2 - viewportCenter) * speed * -.12));
        const visual = item.querySelector(':scope > .tayar-element');
        if (visual) visual.style.setProperty('--tayar-parallax-y', offset.toFixed(2) + 'px');
      });
    };
    const scheduleParallax = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(updateParallax);
    };
    addEventListener('scroll', scheduleParallax, { passive: true });
    addEventListener('resize', scheduleParallax, { passive: true });
    scheduleParallax();
  }
})();
</script>`;

  const customCss = sanitizeCustomCss(productionConfig.customCss);
  const verificationTags = [
    productionConfig.googleVerification ? `<meta name="google-site-verification" content="${escapeHtml(productionConfig.googleVerification)}">` : '',
    productionConfig.bingVerification ? `<meta name="msvalidate.01" content="${escapeHtml(productionConfig.bingVerification)}">` : '',
  ].filter(Boolean).join('\n');
  const organizationUrl = normalizeSiteUrl(productionConfig.organizationUrl) || options.canonicalUrl || '';
  const structuredSchemas: Record<string, unknown>[] = [];
  if (productionConfig.organizationSchema) {
    structuredSchemas.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: productionConfig.organizationName || options.siteName,
      ...(organizationUrl ? { url: organizationUrl } : {}),
      ...(productionConfig.organizationLogo ? { logo: productionConfig.organizationLogo } : {}),
    });
  }
  if (productionConfig.localBusinessSchema) {
    structuredSchemas.push({
      '@context': 'https://schema.org',
      '@type': productionConfig.localBusinessType || 'LocalBusiness',
      name: productionConfig.organizationName || options.siteName,
      ...(organizationUrl ? { url: organizationUrl } : {}),
      ...(productionConfig.organizationLogo ? { image: productionConfig.organizationLogo } : {}),
      ...(productionConfig.localBusinessPhone ? { telephone: productionConfig.localBusinessPhone } : {}),
      ...(productionConfig.localBusinessAddress ? { address: productionConfig.localBusinessAddress } : {}),
    });
  }
  const productionSchema = structuredSchemas.length
    ? `<script type="application/ld+json">${JSON.stringify(structuredSchemas.length === 1 ? structuredSchemas[0] : structuredSchemas).replace(/</g, '\\u003c')}</script>`
    : '';
  const ga4Head = options.analyticsEnabled && productionConfig.ga4Id
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(productionConfig.ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(productionConfig.ga4Id)});</script>`
    : '';
  const gtmHead = options.analyticsEnabled && productionConfig.gtmId
    ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer',${JSON.stringify(productionConfig.gtmId)});</script>`
    : '';
  const gtmBody = options.analyticsEnabled && productionConfig.gtmId
    ? `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeHtml(productionConfig.gtmId)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`
    : '';
  const metaPixelHead = options.analyticsEnabled && productionConfig.metaPixelId
    ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(productionConfig.metaPixelId)});fbq('track','PageView');</script>`
    : '';
  const metaPixelBody = options.analyticsEnabled && productionConfig.metaPixelId
    ? `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${escapeHtml(productionConfig.metaPixelId)}&ev=PageView&noscript=1" alt=""></noscript>`
    : '';
  const plausibleHead = options.analyticsEnabled && productionConfig.plausibleDomain
    ? `<script defer data-domain="${escapeHtml(productionConfig.plausibleDomain)}" src="https://plausible.io/js/script.js"></script>`
    : '';
  const maintenanceBody = productionConfig.maintenanceMode
    ? `<main class="tayar-maintenance"><div><span>${runtimeHtml('Maintenance')}</span><h1>${escapeHtml(productionConfig.maintenanceTitle)}</h1><p>${escapeHtml(productionConfig.maintenanceText)}</p></div></main>`
    : '';

  return `<!DOCTYPE html>
<html lang="${options.language}" dir="${direction}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action 'self' https:;">
<script>document.documentElement.classList.add('tayar-js')</script>
<title>${escapeHtml(options.title)}</title>
<meta name="description" content="${escapeHtml(options.description)}">
<meta name="robots" content="${options.noIndex ? 'noindex,nofollow' : 'index,follow'}">
${options.keywords?.length ? `<meta name="keywords" content="${escapeHtml(options.keywords.join(', '))}">` : ''}
${options.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">` : ''}
${(options.alternateLinks || []).map((item) => `<link rel="alternate" hreflang="${item.language}" href="${escapeHtml(item.href)}">`).join('\n')}
${(options.alternateLinks || []).find((item) => item.isDefault) ? `<link rel="alternate" hreflang="x-default" href="${escapeHtml((options.alternateLinks || []).find((item) => item.isDefault)?.href || '')}">` : ''}
${options.faviconUrl ? `<link rel="icon" href="${escapeHtml(options.faviconUrl)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(options.siteName)}">
<meta property="og:title" content="${escapeHtml(options.title)}">
<meta property="og:description" content="${escapeHtml(options.description)}">
${options.canonicalUrl ? `<meta property="og:url" content="${escapeHtml(options.canonicalUrl)}">` : ''}
${options.socialImageUrl ? `<meta property="og:image" content="${escapeHtml(options.socialImageUrl)}">` : ''}
<meta name="twitter:card" content="${options.socialImageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(options.title)}">
<meta name="twitter:description" content="${escapeHtml(options.description)}">
${options.socialImageUrl ? `<meta name="twitter:image" content="${escapeHtml(options.socialImageUrl)}">` : ''}
${verificationTags}
${faqSchema}
${productionSchema}
${ga4Head}
${gtmHead}
${metaPixelHead}
${plausibleHead}
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:${theme.fontFamily},Arial,sans-serif;background:${theme.backgroundColor};color:${theme.textColor};line-height:1.6}
a{text-decoration:none}
:focus-visible{outline:3px solid ${theme.primaryColor};outline-offset:3px}
.tayar-skip-link{position:fixed;left:12px;top:12px;z-index:500;transform:translateY(-160%);background:${theme.secondaryColor};color:${theme.textColor};border:1px solid ${theme.primaryColor};border-radius:10px;padding:9px 12px;font-weight:800}.tayar-skip-link:focus{transform:none}
.site-nav{position:relative;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 24px;background:${headerConfig.backgroundColor};border-bottom:1px solid ${headerConfig.borderColor};backdrop-filter:blur(16px)}
.site-nav.sticky{position:sticky}.site-brand{color:${headerConfig.textColor};font-weight:800;font-size:${headerConfig.brandSize}px}.site-brand-wrap{display:inline-flex;align-items:center;gap:10px}.site-logo{width:34px;height:34px;border-radius:10px;object-fit:cover}.site-menu-toggle{display:none;border:1px solid ${headerConfig.borderColor};background:#ffffff0d;color:${headerConfig.textColor};padding:8px 11px;border-radius:${theme.buttonRadius}px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;align-items:center;gap:7px}.site-links{display:flex;align-items:center;gap:${headerConfig.navGap}px;flex-wrap:wrap}.site-links a{color:${headerConfig.textColor};font-size:${headerConfig.navSize}px;font-weight:600;opacity:.82}.site-links a:hover{color:${headerConfig.hoverColor};opacity:1}.site-links a.active{color:${headerConfig.activeColor};opacity:1}.site-links .site-cta{background:${headerConfig.ctaBackgroundColor};color:${headerConfig.ctaTextColor};padding:9px 14px;border-radius:${theme.buttonRadius}px;opacity:1}.site-language-switcher{display:flex;align-items:center;gap:4px;padding:3px;border:1px solid ${headerConfig.borderColor};border-radius:999px}.site-language-switcher a{min-width:32px;padding:3px 7px;border-radius:999px;text-align:center;font-size:11px!important;opacity:.75}.site-language-switcher a.active{background:${headerConfig.ctaBackgroundColor};color:${headerConfig.ctaTextColor}!important;opacity:1}
.section{padding:${theme.sectionSpacing}px 24px;color:${theme.textColor}}
.container{width:min(${theme.contentWidth}px,100%);margin:auto;text-align:center}
.section-container-full{width:100%;max-width:none}
.hero{min-height:650px;display:flex;align-items:center;justify-content:center}
h1{font-size:clamp(44px,7vw,82px);line-height:1.05;margin:16px 0;font-weight:800}
h2{font-size:clamp(32px,5vw,56px);line-height:1.1;margin:12px 0 18px;font-weight:800}
h3{font-size:22px;margin-bottom:8px}
.lead{max-width:720px;margin:0 auto 30px;color:${theme.mutedTextColor};font-size:18px}
.eyebrow{display:inline-block;color:var(--accent);font-weight:800;font-size:12px;letter-spacing:2px}
.btn{display:inline-block;margin-top:10px;background:var(--accent);color:#fff;padding:13px 22px;border-radius:${theme.buttonRadius}px;font-weight:700;box-shadow:0 10px 30px #0003}
.btn.secondary{background:#ffffff12;border:1px solid #ffffff20}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:950px;margin:40px auto}
.card,.price{padding:28px;border:1px solid #ffffff16;background:#ffffff08;border-radius:20px;text-align:left}
.card p,.price p{color:${theme.mutedTextColor}}
.icon{color:var(--accent);font-weight:900;margin-bottom:15px}
.pricing{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:900px;margin:40px auto}
.price strong{font-size:42px;display:block;margin:12px 0}
.price.featured{border-color:var(--accent);transform:translateY(-8px)}
.split{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center;text-align:left}
.split .lead{margin-left:0}
.visual{height:300px;border:2px solid;border-radius:28px;background:linear-gradient(135deg,#ffffff10,#ffffff03);display:flex;align-items:center;justify-content:center}
.visual span{padding:18px 25px;border-radius:15px;font-weight:900}
.contact-box{max-width:600px;margin:35px auto;display:grid;gap:12px}.tayar-honeypot{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
.contact-box input,.contact-box textarea,.contact-box select{width:100%;padding:15px;border-radius:12px;border:1px solid #ffffff18;background:#ffffff08;color:#fff;outline:none}
.contact-box textarea{min-height:130px;resize:vertical}
.form-field{display:grid;gap:7px;text-align:left}.form-field>span{font-size:12px;font-weight:700;color:${theme.mutedTextColor}}.form-checkbox{display:flex;align-items:center;gap:10px;text-align:left;color:${theme.mutedTextColor}}.form-checkbox input{width:auto}.contact-box select option{color:#111827}
.contact-box .btn{border:0;cursor:pointer}
.contact-box .btn:disabled{cursor:not-allowed;opacity:.55}
.form-status{min-height:20px;color:${theme.mutedTextColor};font-size:13px;text-align:center}
.footer{padding:45px 24px;text-align:center}
.footer h2{font-size:24px}
.footer p{color:${theme.mutedTextColor}}
.global-site-footer{padding:34px 24px;background:${theme.secondaryColor};border-top:1px solid #ffffff14}.footer-inner{width:min(${theme.contentWidth}px,100%);margin:auto;display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:28px;align-items:start}.footer-inner p{margin-top:6px;color:${theme.mutedTextColor};font-size:13px}.footer-links,.footer-socials{display:flex;flex-wrap:wrap;gap:14px}.footer-links a,.footer-socials a{color:${theme.mutedTextColor};font-size:13px;font-weight:600}.footer-links a:hover,.footer-socials a:hover{color:${theme.textColor}}
.element-stack{display:flex;flex-direction:column;align-items:center;gap:20px}
.section-layout{display:grid;grid-template-columns:repeat(var(--layout-cols),minmax(0,1fr));gap:var(--layout-gap);justify-items:var(--layout-align);align-items:start}
.layout-item{min-width:0;width:100%;display:flex;flex-direction:column;align-items:var(--layout-align,center)}
.layout-item>*{max-width:100%}
.tayar-container{max-width:100%}.container-element-item{min-width:0;display:flex;flex-direction:column}.tayar-container[data-layout="stack"]>.container-element-item{width:100%}
.tayar-element{transition:transform .2s ease,opacity .2s ease,background-color .2s ease,color .2s ease,box-shadow .2s ease,border-color .2s ease}
${desktopElementAnimationCss}
${desktopElementHoverCss}
.builder-image{display:block;max-width:100%;height:auto;margin:auto}.builder-list{padding-left:1.4em;text-align:left}.builder-list li+li{margin-top:.55em}.builder-divider{display:block;height:2px;border:0;margin:8px auto}.builder-spacer{display:block}.builder-video,.builder-video-file{display:block;max-width:100%;margin:auto;overflow:hidden}.builder-video{aspect-ratio:16/9}.builder-video iframe{width:100%;height:100%;border:0;display:block}.builder-video-file{width:100%;height:auto}.builder-video-placeholder{display:flex;min-height:180px;align-items:center;justify-content:center;border:1px dashed #ffffff30;color:${theme.mutedTextColor};padding:24px;text-align:center}.builder-accordion{width:100%;text-align:left}.builder-accordion details{border:1px solid #ffffff18;border-radius:12px;padding:0 16px;background:#ffffff06}.builder-accordion details+details{margin-top:10px}.builder-accordion summary{cursor:pointer;padding:14px 0;font-weight:800}.builder-accordion details>div{padding:0 0 16px;color:${theme.mutedTextColor}}.builder-tabs{width:100%}.tayar-tab-input{position:absolute;opacity:0;pointer-events:none}.tayar-tab-labels{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.tayar-tab-labels label{cursor:pointer;border:1px solid #ffffff18;border-radius:10px;padding:9px 13px;font-weight:700;background:#ffffff08}.tayar-tab-panels{border:1px solid #ffffff18;border-radius:14px;background:#ffffff06;padding:18px;text-align:left}.tayar-tab-panel{display:none;color:${theme.mutedTextColor}}.builder-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%}.builder-gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block}.builder-embed{width:100%;aspect-ratio:16/9;overflow:hidden}.builder-embed iframe{width:100%;height:100%;border:0;display:block}.builder-embed-placeholder{display:flex;min-height:220px;align-items:center;justify-content:center;border:1px dashed #ffffff30;color:${theme.mutedTextColor};padding:24px;text-align:center}.builder-custom-html{width:100%}.builder-countdown{width:100%}.countdown-label{margin-bottom:14px;font-weight:700}.countdown-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.countdown-grid span{display:grid;gap:2px;border:1px solid #ffffff18;background:#0002;border-radius:12px;padding:14px 8px}.countdown-grid strong{font-size:clamp(22px,4vw,38px);line-height:1}.countdown-grid small{font-size:10px;text-transform:uppercase;opacity:.6}.builder-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%}.stat-card{border:1px solid #ffffff18;background:#0002;border-radius:14px;padding:20px;text-align:center}.stat-card strong{display:block;font-size:clamp(28px,5vw,48px);line-height:1}.stat-card span{display:block;margin-top:8px;color:${theme.mutedTextColor};font-size:13px}.builder-testimonials{width:100%}.testimonial-slide{display:none;border:1px solid #ffffff18;background:#0002;border-radius:16px;padding:24px;text-align:center}.testimonial-slide.active{display:block}.testimonial-slide p{font-size:18px;font-style:italic}.testimonial-slide strong{display:block;margin-top:14px}.testimonial-controls{margin-top:12px;display:flex;align-items:center;justify-content:center;gap:12px}.testimonial-controls button{width:36px;height:36px;border-radius:999px;border:1px solid #ffffff20;background:#ffffff0d;color:inherit;cursor:pointer}.site-search-trigger{border:1px solid ${headerConfig.borderColor};background:transparent;color:${headerConfig.textColor};padding:8px 11px;border-radius:10px;font:inherit;cursor:pointer}.tayar-announcement{display:flex;align-items:center;justify-content:center;gap:14px;padding:9px 18px;background:${theme.primaryColor};color:#fff;font-size:13px;font-weight:700;text-align:center}.tayar-announcement a{color:#fff;text-decoration:underline}.tayar-popup-backdrop,.tayar-search-overlay,.tayar-lightbox{position:fixed;inset:0;z-index:150;display:flex;align-items:center;justify-content:center;padding:20px;background:#020617cc;backdrop-filter:blur(8px)}.tayar-popup-backdrop[hidden],.tayar-search-overlay[hidden],.tayar-lightbox[hidden]{display:none}.tayar-popup{position:relative;width:min(520px,100%);border:1px solid #ffffff20;border-radius:22px;background:${theme.secondaryColor};padding:34px;color:${theme.textColor};box-shadow:0 30px 100px #000b;text-align:center}.tayar-popup h2{font-size:32px}.tayar-popup p{margin:12px auto;color:${theme.mutedTextColor};max-width:440px}.tayar-popup-close,.tayar-search-head button,.tayar-lightbox button{position:absolute;right:14px;top:12px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer}.tayar-floating-cta{position:fixed;left:20px;bottom:20px;z-index:92;background:${theme.primaryColor};color:#fff;padding:12px 18px;border-radius:${theme.buttonRadius}px;font-weight:800;box-shadow:0 14px 40px #0006}.tayar-share-tools{position:fixed;right:18px;top:50%;z-index:88;display:flex;flex-direction:column;gap:8px;transform:translateY(-50%)}.tayar-share-tools button{border:1px solid #ffffff20;background:${theme.secondaryColor};color:${theme.textColor};padding:9px 11px;border-radius:10px;font-weight:700;cursor:pointer}.tayar-lightbox img{max-width:min(1200px,94vw);max-height:88vh;object-fit:contain;border-radius:16px;box-shadow:0 30px 100px #000}.builder-gallery img{cursor:zoom-in}.tayar-search-dialog{position:relative;width:min(720px,100%);max-height:80vh;overflow:auto;border:1px solid #ffffff20;border-radius:20px;background:${theme.secondaryColor};padding:22px;color:${theme.textColor};box-shadow:0 30px 100px #000b}.tayar-search-head{display:flex;align-items:center;justify-content:space-between;padding-right:34px;margin-bottom:14px}.tayar-search-head button{top:10px}.tayar-search-dialog input{width:100%;border:1px solid #ffffff20;border-radius:12px;background:#ffffff08;color:${theme.textColor};padding:13px 14px;outline:none}.tayar-search-results{display:grid;gap:8px;margin-top:14px}.tayar-search-results>a{display:grid;gap:4px;border:1px solid #ffffff16;border-radius:12px;padding:12px;color:${theme.textColor};background:#ffffff05}.tayar-search-results>a span,.tayar-search-results p{color:${theme.mutedTextColor};font-size:12px}.tayar-cookie-banner{position:fixed;left:18px;right:18px;bottom:18px;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:18px;max-width:850px;margin:auto;padding:16px 18px;border:1px solid #ffffff20;background:${theme.secondaryColor};color:${theme.textColor};border-radius:16px;box-shadow:0 18px 60px #0008}.tayar-cookie-banner[hidden]{display:none}.tayar-cookie-banner p{font-size:13px;color:${theme.mutedTextColor}}.tayar-cookie-banner button{border:0;background:${theme.primaryColor};color:#fff;padding:9px 14px;border-radius:${theme.buttonRadius}px;font-weight:700;cursor:pointer}.tayar-scroll-progress{position:fixed;left:0;top:0;z-index:120;width:100%;height:3px;transform:scaleX(0);transform-origin:left center;background:${theme.primaryColor};pointer-events:none}.tayar-back-to-top{position:fixed;right:20px;bottom:20px;z-index:90;width:44px;height:44px;border-radius:999px;border:1px solid #ffffff22;background:${theme.secondaryColor};color:${theme.textColor};font-size:20px;cursor:pointer;opacity:0;pointer-events:none;transform:translateY(12px);transition:.2s}.tayar-back-to-top.visible{opacity:1;pointer-events:auto;transform:none}@media(max-width:700px){.builder-gallery{grid-template-columns:1fr}.tayar-tab-labels{flex-direction:column}.tayar-tab-labels label{width:100%}.builder-stats{grid-template-columns:1fr}.countdown-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.tayar-cookie-banner{align-items:stretch;flex-direction:column}.tayar-back-to-top{right:14px;bottom:14px}.tayar-floating-cta{left:14px;bottom:14px}.tayar-share-tools{right:10px;top:auto;bottom:72px;transform:none}.tayar-announcement{align-items:flex-start;flex-direction:column;gap:3px;text-align:left}.site-search-trigger span{display:none}.tayar-popup{padding:30px 22px}.tayar-popup h2{font-size:27px}}
@media(max-width:900px){.section-layout[data-cols="3"]{grid-template-columns:repeat(2,minmax(0,1fr))}.section-layout[data-cols="3"] .layout-item[data-column="3"]{grid-column:2!important}.tayar-container[data-layout="grid"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}.tayar-container[data-layout="grid"][data-columns="1"]{grid-template-columns:1fr!important}}
@media(max-width:700px){
.site-nav{align-items:flex-start;flex-direction:column}.site-nav.mobile-menu{align-items:center;flex-direction:row;flex-wrap:wrap}.site-nav.mobile-menu .site-menu-toggle{display:inline-flex;margin-left:auto}.site-nav.mobile-menu .site-links{display:none;width:100%;flex-direction:column;align-items:stretch;gap:8px;padding-top:10px}.site-nav.mobile-menu.menu-open .site-links{display:flex}.site-nav.mobile-menu .site-links a{display:block;width:100%;padding:9px 4px}.site-nav:not(.mobile-menu) .site-links{gap:12px}.footer-inner{grid-template-columns:1fr}.footer-links,.footer-socials{gap:10px}
.section{padding:65px 18px}
.section-layout{grid-template-columns:1fr!important}.section-layout .layout-item{grid-column:1!important}.tayar-container[data-layout="row"]{flex-direction:column!important}.tayar-container[data-layout="grid"]{grid-template-columns:1fr!important}
.cards,.pricing,.split{grid-template-columns:1fr}
.price.featured{transform:none}
h1{font-size:45px}
}
${responsiveSectionCss}
${responsiveElementCss}
@media(prefers-reduced-motion:reduce){.tayar-js [data-tayar-animated]{opacity:1!important;transform:none!important;transition:none!important;will-change:auto!important}}
.tayar-maintenance{min-height:100vh;display:grid;place-items:center;padding:32px;background:${theme.backgroundColor};color:${theme.textColor};text-align:center}.tayar-maintenance>div{width:min(720px,100%)}.tayar-maintenance span{display:inline-block;margin-bottom:14px;color:${theme.primaryColor};font-weight:900;text-transform:uppercase;letter-spacing:.16em;font-size:12px}.tayar-maintenance h1{font-size:clamp(42px,8vw,78px)}.tayar-maintenance p{max-width:640px;margin:18px auto;color:${theme.mutedTextColor};font-size:18px}
${customCss}
</style>
</head>
<body>
${gtmBody}
${metaPixelBody}
${productionConfig.maintenanceMode ? maintenanceBody : `<a class="tayar-skip-link" href="#tayar-main-content">${runtimeHtml('Skip to content')}</a>${scrollProgress}
${announcementBar}
${navigation}
<main id="tayar-main-content">${body}</main>
${globalFooter}
${floatingCta}
${shareButtons}
${searchOverlay}
${popupModal}
${lightbox}
${cookieBanner}
${backToTop}
${navigationScript}
${leadScript}
${analyticsScript}
${interactiveWidgetsScript}
${motionScript}`}
</body>
</html>`;
}

export function effectiveStyle(element: WebsiteElement, device: Device) {
  return { ...element.style, ...(element.responsive?.[device] || {}) };
}

export function effectiveSectionStyle(section: WebsiteSection, device: Device): WebsiteSection {
  return { ...section, ...(section.responsive?.[device] || {}) };
}
