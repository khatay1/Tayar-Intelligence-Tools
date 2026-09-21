import type { ElementStyle, WebsiteElementContainer } from './types';

function bounded(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function containerLayoutCss(container: WebsiteElementContainer): string[] {
  const direction = container.layout === 'row' ? 'row' : 'column';
  const align = container.align === 'start' ? 'flex-start' : container.align === 'end' ? 'flex-end' : container.align === 'stretch' ? 'stretch' : 'center';
  const justify = container.justify === 'start' ? 'flex-start' : container.justify === 'end' ? 'flex-end' : container.justify === 'between' ? 'space-between' : 'center';
  const gap = bounded(container.gap, 16, 0, 80);
  const rowGap = bounded(container.rowGap, gap, 0, 80);
  const columns = Math.round(bounded(container.columns, 2, 1, 12));
  return [
    `display:${container.layout === 'grid' ? 'grid' : 'flex'}`,
    `flex-direction:${direction}`,
    `flex-wrap:${container.wrap === false ? 'nowrap' : 'wrap'}`,
    `grid-template-columns:${container.layout === 'grid' ? `repeat(${columns},minmax(0,1fr))` : 'none'}`,
    `column-gap:${gap}px`,
    `row-gap:${rowGap}px`,
    `align-items:${align}`,
    `justify-content:${justify}`,
  ];
}

export function elementConstraintCss(style: ElementStyle, suffix = ''): string[] {
  const width = bounded(style.width, 0, 0, 100);
  const minWidth = bounded(style.minWidth, 0, 0, 2400);
  const height = bounded(style.height, 0, 0, 2400);
  const minHeight = bounded(style.minHeight, 0, 0, 2400);
  const maxHeight = bounded(style.maxHeight, 0, 0, 2400);
  const aspectRatio = bounded(style.aspectRatio, 0, 0.1, 10);
  return [
    `width:${width ? `${width}%` : 'auto'}${suffix}`,
    `min-width:${minWidth ? `${minWidth}px` : '0'}${suffix}`,
    `height:${height ? `${height}px` : 'auto'}${suffix}`,
    `min-height:${minHeight ? `${minHeight}px` : '0'}${suffix}`,
    `max-height:${maxHeight ? `${maxHeight}px` : 'none'}${suffix}`,
    `aspect-ratio:${aspectRatio || 'auto'}${suffix}`,
  ];
}
