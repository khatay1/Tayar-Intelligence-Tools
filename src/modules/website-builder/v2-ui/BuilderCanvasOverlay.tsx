import type { CSSProperties } from 'react';
import type { EditorCanvasOverlayItem } from '../core/editor-canvas-overlay';
import { selectionForEditorCanvasTarget } from '../core/editor-canvas-overlay';
import type { EditorShellContract } from '../core/editor-shell-contract';

export interface BuilderCanvasOverlayProps {
  shell: EditorShellContract;
  items: EditorCanvasOverlayItem[];
  onHover?(id?: string): void;
}

function overlayStyle(item: EditorCanvasOverlayItem): CSSProperties {
  return {
    left: `${item.rect.x}px`,
    top: `${item.rect.y}px`,
    width: `${Math.max(1, item.rect.width)}px`,
    height: `${Math.max(1, item.rect.height)}px`,
  };
}

export function BuilderCanvasOverlay({ shell, items, onHover }: BuilderCanvasOverlayProps) {
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
            style={overlayStyle(item)}
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
                <i className="tayar-v2-canvas-overlay__handle tayar-v2-canvas-overlay__handle--nw" />
                <i className="tayar-v2-canvas-overlay__handle tayar-v2-canvas-overlay__handle--ne" />
                <i className="tayar-v2-canvas-overlay__handle tayar-v2-canvas-overlay__handle--sw" />
                <i className="tayar-v2-canvas-overlay__handle tayar-v2-canvas-overlay__handle--se" />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
