import { CANVAS_POSITION_LIMIT } from './editor-canvas-geometry';

export type CanvasArrangement = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  | 'distribute-horizontal' | 'distribute-vertical';

export interface ArrangementItem {
  id: string;
  rect: { left: number; top: number; width: number; height: number };
  x: number;
  y: number;
}

export interface ArrangementPosition { x?: number; y?: number }

/** Convert viewport measurements to document offsets once, at the current zoom. */
export function arrangeCanvasElements(
  items: readonly ArrangementItem[],
  action: CanvasArrangement,
  scale: number,
): Map<string, ArrangementPosition> {
  const positions = new Map<string, ArrangementPosition>();
  const distribute = action.startsWith('distribute');
  if (items.length < (distribute ? 3 : 2) || !Number.isFinite(scale) || scale <= 0) return positions;
  if (new Set(items.map((item) => item.id)).size !== items.length || items.some(({ id, rect, x, y }) =>
    !id || ![rect.left, rect.top, rect.width, rect.height, x, y].every(Number.isFinite)
    || rect.width < 0 || rect.height < 0)) return positions;

  const horizontal = ['left', 'center', 'right', 'distribute-horizontal'].includes(action);
  const axis = horizontal ? 'x' : 'y';
  const start = (item: ArrangementItem) => horizontal ? item.rect.left : item.rect.top;
  const size = (item: ArrangementItem) => horizontal ? item.rect.width : item.rect.height;
  const end = (item: ArrangementItem) => start(item) + size(item);
  let changed = false;
  const place = (item: ArrangementItem, delta: number) => {
    // Keep fractional offsets on stationary anchors.
    const current = item[axis];
    const next = Math.abs(delta) < 0.01 ? current : Math.round(current + delta / scale);
    const bounded = Math.max(-CANVAS_POSITION_LIMIT, Math.min(CANVAS_POSITION_LIMIT, next));
    positions.set(item.id, { [axis]: bounded });
    changed ||= bounded !== current;
  };

  if (distribute) {
    const ordered = [...items].sort((a, b) => start(a) - start(b));
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const gap = (end(last) - start(first) - ordered.reduce((sum, item) => sum + size(item), 0)) / (ordered.length - 1);
    let cursor = start(first);
    ordered.forEach((item, index) => {
      place(item, index === 0 || index === ordered.length - 1 ? 0 : cursor - start(item));
      cursor += size(item) + gap;
    });
  } else {
    const min = Math.min(...items.map(start));
    const max = Math.max(...items.map(end));
    items.forEach((item) => {
      if (action === 'left' || action === 'top') place(item, min - start(item));
      else if (action === 'right' || action === 'bottom') place(item, max - end(item));
      else if (action === 'center' || action === 'middle') place(item, (min + max - size(item)) / 2 - start(item));
    });
  }
  return changed ? positions : new Map();
}
