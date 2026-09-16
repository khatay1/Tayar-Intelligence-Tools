export const CANVAS_GRID_SIZE = 8;
export const CANVAS_POSITION_LIMIT = 4000;
export const CANVAS_ALIGNMENT_THRESHOLD = 6;
export const CANVAS_SPACING_THRESHOLD = 6;
export const CANVAS_RESIZE_SNAP_STEP = 5;
export const CANVAS_MIN_VISIBLE_SIZE = 24;

export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasSpacingGuide {
  axis: 'x' | 'y';
  gap: number;
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
  crossPosition: number;
}

export interface CanvasSnapGuides {
  horizontal: boolean;
  vertical: boolean;
  horizontalPosition?: number;
  verticalPosition?: number;
  spacing?: CanvasSpacingGuide;
}

export interface CanvasAlignmentTargets {
  x: number[];
  y: number[];
  bounds?: CanvasBounds[];
}

function clampCanvasCoordinate(value: number): number {
  return Math.max(-CANVAS_POSITION_LIMIT, Math.min(CANVAS_POSITION_LIMIT, value));
}

function containCanvasPosition({ position, startPosition, elementStart, elementSize, sectionStart, sectionSize }: {
  position: number; startPosition: number; elementStart: number; elementSize: number; sectionStart: number; sectionSize: number;
}): number {
  const minimumVisible = Math.min(CANVAS_MIN_VISIBLE_SIZE, Math.max(1, elementSize));
  const minimumElementStart = sectionStart - elementSize + minimumVisible;
  const maximumElementStart = sectionStart + sectionSize - minimumVisible;
  const proposedElementStart = elementStart + (position - startPosition);
  const containedElementStart = Math.max(minimumElementStart, Math.min(maximumElementStart, proposedElementStart));
  return position + (containedElementStart - proposedElementStart);
}

export function resolveCanvasResize({ startWidth, startPositionX, deltaX, hostWidth, edge, precisionMode = false }: {
  startWidth: number; startPositionX: number; deltaX: number; hostWidth: number; edge: 'left' | 'right'; precisionMode?: boolean;
}): { width: number; positionX: number } {
  const safeHostWidth = Math.max(1, hostWidth);
  const deltaPercent = (deltaX / safeHostWidth) * 100;
  const rawWidth = startWidth + (edge === 'right' ? deltaPercent : -deltaPercent);
  const snapStep = precisionMode ? 1 : CANVAS_RESIZE_SNAP_STEP;
  const width = Math.max(10, Math.min(100, Math.round(rawWidth / snapStep) * snapStep));
  const anchoredPositionX = edge === 'left' ? startPositionX + (((startWidth - width) / 100) * safeHostWidth) : startPositionX;
  return { width, positionX: clampCanvasCoordinate(Math.round(anchoredPositionX)) };
}

function closestAlignment(movingAnchors: number[], targets: number[]): { correction: number; position: number } | null {
  let closest: { correction: number; position: number; distance: number } | null = null;
  for (const movingAnchor of movingAnchors) {
    for (const target of targets) {
      const correction = target - movingAnchor;
      const distance = Math.abs(correction);
      if (distance > CANVAS_ALIGNMENT_THRESHOLD || (closest && distance >= closest.distance)) continue;
      closest = { correction, position: target, distance };
    }
  }
  return closest ? { correction: closest.correction, position: closest.position } : null;
}

function boundsEnd(bounds: CanvasBounds, axis: 'x' | 'y'): number {
  return axis === 'x' ? bounds.left + bounds.width : bounds.top + bounds.height;
}
function boundsStart(bounds: CanvasBounds, axis: 'x' | 'y'): number { return axis === 'x' ? bounds.left : bounds.top; }
function boundsSize(bounds: CanvasBounds, axis: 'x' | 'y'): number { return axis === 'x' ? bounds.width : bounds.height; }
function boundsCrossCenter(bounds: CanvasBounds, axis: 'x' | 'y'): number {
  return axis === 'x' ? bounds.top + (bounds.height / 2) : bounds.left + (bounds.width / 2);
}

function closestEqualSpacing(moving: CanvasBounds, siblings: CanvasBounds[], axis: 'x' | 'y'):
  { correction: number; guide: CanvasSpacingGuide } | null {
  const movingStart = boundsStart(moving, axis);
  const movingEnd = boundsEnd(moving, axis);
  const before = siblings.filter((item) => boundsEnd(item, axis) <= movingStart).sort((a, b) => boundsEnd(b, axis) - boundsEnd(a, axis));
  const after = siblings.filter((item) => boundsStart(item, axis) >= movingEnd).sort((a, b) => boundsStart(a, axis) - boundsStart(b, axis));
  if (!before.length || !after.length) return null;
  const previous = before[0];
  const next = after[0];
  const available = boundsStart(next, axis) - boundsEnd(previous, axis) - boundsSize(moving, axis);
  if (available < 0) return null;
  const targetGap = available / 2;
  const currentBeforeGap = movingStart - boundsEnd(previous, axis);
  const correction = targetGap - currentBeforeGap;
  if (Math.abs(correction) > CANVAS_SPACING_THRESHOLD) return null;
  const snappedStart = movingStart + correction;
  const snappedEnd = snappedStart + boundsSize(moving, axis);
  return {
    correction,
    guide: {
      axis,
      gap: Math.round(targetGap),
      beforeStart: boundsEnd(previous, axis),
      beforeEnd: snappedStart,
      afterStart: snappedEnd,
      afterEnd: boundsStart(next, axis),
      crossPosition: Math.round((boundsCrossCenter(previous, axis) + boundsCrossCenter(moving, axis) + boundsCrossCenter(next, axis)) / 3),
    },
  };
}

export function resolveCanvasDragPosition({ startX, startY, deltaX, deltaY, precisionMode = false, elementBounds, sectionBounds, alignmentTargets, containToSection = true }: {
  startX: number; startY: number; deltaX: number; deltaY: number; precisionMode?: boolean; elementBounds?: CanvasBounds; sectionBounds?: CanvasBounds; alignmentTargets?: CanvasAlignmentTargets; containToSection?: boolean;
}): { x: number; y: number; guides: CanvasSnapGuides } {
  let resolvedDeltaX = deltaX;
  let resolvedDeltaY = deltaY;
  const guides: CanvasSnapGuides = { horizontal: false, vertical: false };

  if (!precisionMode && elementBounds && sectionBounds) {
    const sectionCenterX = sectionBounds.left + (sectionBounds.width / 2);
    const sectionCenterY = sectionBounds.top + (sectionBounds.height / 2);
    const movingX = [elementBounds.left + deltaX, elementBounds.left + (elementBounds.width / 2) + deltaX, elementBounds.left + elementBounds.width + deltaX];
    const movingY = [elementBounds.top + deltaY, elementBounds.top + (elementBounds.height / 2) + deltaY, elementBounds.top + elementBounds.height + deltaY];
    const xAlignment = closestAlignment(movingX, [sectionCenterX, ...(alignmentTargets?.x || [])]);
    const yAlignment = closestAlignment(movingY, [sectionCenterY, ...(alignmentTargets?.y || [])]);
    if (xAlignment) { resolvedDeltaX += xAlignment.correction; guides.vertical = true; guides.verticalPosition = xAlignment.position; }
    if (yAlignment) { resolvedDeltaY += yAlignment.correction; guides.horizontal = true; guides.horizontalPosition = yAlignment.position; }

    if (alignmentTargets?.bounds?.length) {
      const movingBounds = { ...elementBounds, left: elementBounds.left + resolvedDeltaX, top: elementBounds.top + resolvedDeltaY };
      if (!guides.vertical) {
        const spacingX = closestEqualSpacing(movingBounds, alignmentTargets.bounds, 'x');
        if (spacingX) { resolvedDeltaX += spacingX.correction; guides.spacing = spacingX.guide; }
      }
      if (!guides.horizontal && !guides.spacing) {
        const spacingY = closestEqualSpacing(movingBounds, alignmentTargets.bounds, 'y');
        if (spacingY) { resolvedDeltaY += spacingY.correction; guides.spacing = spacingY.guide; }
      }
    }
  }

  let rawX = clampCanvasCoordinate(Math.round(startX + resolvedDeltaX));
  let rawY = clampCanvasCoordinate(Math.round(startY + resolvedDeltaY));
  if (containToSection && elementBounds && sectionBounds) {
    rawX = clampCanvasCoordinate(Math.round(containCanvasPosition({ position: rawX, startPosition: startX, elementStart: elementBounds.left, elementSize: elementBounds.width, sectionStart: sectionBounds.left, sectionSize: sectionBounds.width })));
    rawY = clampCanvasCoordinate(Math.round(containCanvasPosition({ position: rawY, startPosition: startY, elementStart: elementBounds.top, elementSize: elementBounds.height, sectionStart: sectionBounds.top, sectionSize: sectionBounds.height })));
  }
  if (precisionMode) return { x: rawX, y: rawY, guides };
  return {
    x: guides.vertical || guides.spacing?.axis === 'x' ? rawX : clampCanvasCoordinate(Math.round(rawX / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE),
    y: guides.horizontal || guides.spacing?.axis === 'y' ? rawY : clampCanvasCoordinate(Math.round(rawY / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE),
    guides,
  };
}
