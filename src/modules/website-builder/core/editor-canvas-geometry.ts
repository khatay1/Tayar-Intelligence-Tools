export const CANVAS_GRID_SIZE = 8;
export const CANVAS_POSITION_LIMIT = 4000;
export const CANVAS_ALIGNMENT_THRESHOLD = 6;
export const CANVAS_RESIZE_SNAP_STEP = 5;

export interface CanvasBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasSnapGuides {
  horizontal: boolean;
  vertical: boolean;
  horizontalPosition?: number;
  verticalPosition?: number;
}

export interface CanvasAlignmentTargets {
  x: number[];
  y: number[];
}

function clampCanvasCoordinate(value: number): number {
  return Math.max(-CANVAS_POSITION_LIMIT, Math.min(CANVAS_POSITION_LIMIT, value));
}

export function resolveCanvasResize({
  startWidth,
  startPositionX,
  deltaX,
  hostWidth,
  edge,
  precisionMode = false,
}: {
  startWidth: number;
  startPositionX: number;
  deltaX: number;
  hostWidth: number;
  edge: 'left' | 'right';
  precisionMode?: boolean;
}): { width: number; positionX: number } {
  const safeHostWidth = Math.max(1, hostWidth);
  const deltaPercent = (deltaX / safeHostWidth) * 100;
  const rawWidth = startWidth + (edge === 'right' ? deltaPercent : -deltaPercent);
  const snapStep = precisionMode ? 1 : CANVAS_RESIZE_SNAP_STEP;
  const width = Math.max(10, Math.min(100, Math.round(rawWidth / snapStep) * snapStep));
  const anchoredPositionX = edge === 'left'
    ? startPositionX + (((startWidth - width) / 100) * safeHostWidth)
    : startPositionX;

  return {
    width,
    positionX: clampCanvasCoordinate(Math.round(anchoredPositionX)),
  };
}

function closestAlignment(
  movingAnchors: number[],
  targets: number[],
): { correction: number; position: number } | null {
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

export function resolveCanvasDragPosition({
  startX,
  startY,
  deltaX,
  deltaY,
  precisionMode = false,
  elementBounds,
  sectionBounds,
  alignmentTargets,
}: {
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  precisionMode?: boolean;
  elementBounds?: CanvasBounds;
  sectionBounds?: CanvasBounds;
  alignmentTargets?: CanvasAlignmentTargets;
}): { x: number; y: number; guides: CanvasSnapGuides } {
  let resolvedDeltaX = deltaX;
  let resolvedDeltaY = deltaY;
  const guides: CanvasSnapGuides = { horizontal: false, vertical: false };

  if (!precisionMode && elementBounds && sectionBounds) {
    const sectionCenterX = sectionBounds.left + (sectionBounds.width / 2);
    const sectionCenterY = sectionBounds.top + (sectionBounds.height / 2);
    const movingX = [
      elementBounds.left + deltaX,
      elementBounds.left + (elementBounds.width / 2) + deltaX,
      elementBounds.left + elementBounds.width + deltaX,
    ];
    const movingY = [
      elementBounds.top + deltaY,
      elementBounds.top + (elementBounds.height / 2) + deltaY,
      elementBounds.top + elementBounds.height + deltaY,
    ];
    const xAlignment = closestAlignment(movingX, [sectionCenterX, ...(alignmentTargets?.x || [])]);
    const yAlignment = closestAlignment(movingY, [sectionCenterY, ...(alignmentTargets?.y || [])]);

    if (xAlignment) {
      resolvedDeltaX += xAlignment.correction;
      guides.vertical = true;
      guides.verticalPosition = xAlignment.position;
    }
    if (yAlignment) {
      resolvedDeltaY += yAlignment.correction;
      guides.horizontal = true;
      guides.horizontalPosition = yAlignment.position;
    }
  }

  const rawX = clampCanvasCoordinate(Math.round(startX + resolvedDeltaX));
  const rawY = clampCanvasCoordinate(Math.round(startY + resolvedDeltaY));

  if (precisionMode) return { x: rawX, y: rawY, guides };

  return {
    x: guides.vertical
      ? rawX
      : clampCanvasCoordinate(Math.round(rawX / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE),
    y: guides.horizontal
      ? rawY
      : clampCanvasCoordinate(Math.round(rawY / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE),
    guides,
  };
}
