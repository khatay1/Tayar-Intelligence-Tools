import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditorCanvasOverlayItem } from '../core/editor-canvas-overlay';
import { selectionForEditorCanvasTarget } from '../core/editor-canvas-overlay';
import type { EditorShellContract } from '../core/editor-shell-contract';

export type CanvasResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export interface CanvasResizeCommit {
  item: EditorCanvasOverlayItem;
  handle: CanvasResizeHandle;
  deltaX: number;
  deltaY: number;
  width: number;
  height: number;
}

export interface BuilderCanvasOverlayProps {
  shell: EditorShellContract;
  items: EditorCanvasOverlayItem[];
  onHover?(id?: string): void;
  onResizeCommit?(change: CanvasResizeCommit): void;
}

function overlayStyle(item: EditorCanvasOverlayItem): CSSProperties {
  return {
    left: `${item.rect.x}px`,
    top: `${item.rect.y}px`,
    width: `${Math.max(1, item.rect.width)}px`,
    height: `${Math.max(1, item.rect.height)}px`,
  };
}

function resizePreview(
  item: EditorCanvasOverlayItem,
  handle: CanvasResizeHandle,
  deltaX: number,
  deltaY: number,
) {
  const fromLeft = handle === 'nw' || handle === 'sw';
  const fromTop = handle === 'nw' || handle === 'ne';
  const minWidth = item.kind === 'section' ? 120 : 24;
  const minHeight = item.kind === 'section' ? 48 : 16;
  const width = Math.max(minWidth, item.rect.width + (fromLeft ? -deltaX : deltaX));
  const height = Math.max(minHeight, item.rect.height + (fromTop ? -deltaY : deltaY));
  const effectiveDeltaX = fromLeft ? item.rect.width - width : width - item.rect.width;
  const effectiveDeltaY = fromTop ? item.rect.height - height : height - item.rect.height;
  return {
    width,
    height,
    left: item.rect.x + (fromLeft ? effectiveDeltaX : 0),
    top: item.rect.y + (fromTop ? effectiveDeltaY : 0),
    deltaX: effectiveDeltaX,
    deltaY: effectiveDeltaY,
  };
}

export function BuilderCanvasOverlay({ shell, items, onHover, onResizeCommit }: BuilderCanvasOverlayProps) {
  const [resizePreviewById, setResizePreviewById] = useState<Record<string, CSSProperties>>({});
  const resizeRef = useRef<{
    item: EditorCanvasOverlayItem;
    handle: CanvasResizeHandle;
    pointerId: number;
    startX: number;
    startY: number;
    latestX: number;
    latestY: number;
  } | null>(null);

  const beginResize = (
    event: ReactPointerEvent<HTMLElement>,
    item: EditorCanvasOverlayItem,
    handle: CanvasResizeHandle,
  ) => {
    if (!onResizeCommit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      item,
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
    };
  };

  const moveResize = (event: ReactPointerEvent<HTMLElement>) => {
    const session = resizeRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    session.latestX = event.clientX;
    session.latestY = event.clientY;
    const preview = resizePreview(
      session.item,
      session.handle,
      event.clientX - session.startX,
      event.clientY - session.startY,
    );
    setResizePreviewById((current) => ({
      ...current,
      [session.item.id]: {
        left: `${preview.left}px`,
        top: `${preview.top}px`,
        width: `${preview.width}px`,
        height: `${preview.height}px`,
      },
    }));
  };

  const finishResize = (event: ReactPointerEvent<HTMLElement>) => {
    const session = resizeRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const preview = resizePreview(
      session.item,
      session.handle,
      session.latestX - session.startX,
      session.latestY - session.startY,
    );
    resizeRef.current = null;
    setResizePreviewById((current) => {
      const next = { ...current };
      delete next[session.item.id];
      return next;
    });
    onResizeCommit?.({
      item: session.item,
      handle: session.handle,
      deltaX: preview.deltaX,
      deltaY: preview.deltaY,
      width: preview.width,
      height: preview.height,
    });
  };

  return (
    <div className="tayar-v2-canvas-overlay" aria-hidden="true">
      {items.map((item) => {
        const highlighted = item.selected || item.active;
        return (
          <button
            key={item.id}
            type="button"
            tabIndex={-1}
            className="tayar-v2-canvas-overlay__target"
            data-kind={item.kind}
            data-selected={item.selected ? 'true' : 'false'}
            data-active={item.active ? 'true' : 'false'}
            data-resizable={onResizeCommit ? 'true' : 'false'}
            style={{ ...overlayStyle(item), ...resizePreviewById[item.id] }}
            onPointerEnter={() => onHover?.(item.id)}
            onPointerLeave={() => onHover?.(undefined)}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              shell.actions.onSelect(selectionForEditorCanvasTarget(item));
            }}
          >
            {highlighted && (
              <span className="tayar-v2-canvas-overlay__label">
                {item.label || item.kind}
              </span>
            )}
            {item.selected && (
              <>
                {(['nw', 'ne', 'sw', 'se'] as CanvasResizeHandle[]).map((handle) => (
                  <i
                    key={handle}
                    className={`tayar-v2-canvas-overlay__handle tayar-v2-canvas-overlay__handle--${handle}`}
                    data-handle={handle}
                    onPointerDown={(event) => beginResize(event, item, handle)}
                    onPointerMove={moveResize}
                    onPointerUp={finishResize}
                    onPointerCancel={finishResize}
                  />
                ))}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
