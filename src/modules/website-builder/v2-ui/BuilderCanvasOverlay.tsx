import type { CSSProperties } from 'react';
import type { CanvasSnapGuides } from '../core/editor-canvas-geometry';
import type { EditorCanvasOverlayItem } from '../core/editor-canvas-overlay';
import { selectionForEditorCanvasTarget } from '../core/editor-canvas-overlay';
import type { EditorShellContract } from '../core/editor-shell-contract';
import { CanvasSpacingGuide } from './CanvasSpacingGuide';

export interface BuilderCanvasOverlayProps {
  shell: EditorShellContract;
  items: EditorCanvasOverlayItem[];
  guides?: CanvasSnapGuides;
  onHover?(id?: string): void;
}

function overlayStyle(item: EditorCanvasOverlayItem): CSSProperties {
  return {
    left: `${item.rect.x}px`,
    top: `${item.rect.y}px`,
    width: `${Math.max(1, item.rect.width)}px`,
    height: `${Math.max(1, item.rect.height)}px`,
    pointerEvents: item.selected || item.active ? 'none' : 'auto',
  };
}

const snapGuideStyle: CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 35,
  background: '#22d3ee',
  boxShadow: '0 0 0 1px rgba(34,211,238,.16)',
};

export function BuilderCanvasOverlay({ shell, items, guides, onHover }: BuilderCanvasOverlayProps) {
  return (
    <div className="tayar-v2-canvas-overlay" aria-hidden="true">
      {guides?.vertical && Number.isFinite(guides.verticalPosition) && (
        <span
          className="tayar-v2-canvas-overlay__snap-guide tayar-v2-canvas-overlay__snap-guide--vertical"
          style={{ ...snapGuideStyle, left: `${guides.verticalPosition}px`, top: 0, bottom: 0, width: 1 }}
        />
      )}
      {guides?.horizontal && Number.isFinite(guides.horizontalPosition) && (
        <span
          className="tayar-v2-canvas-overlay__snap-guide tayar-v2-canvas-overlay__snap-guide--horizontal"
          style={{ ...snapGuideStyle, top: `${guides.horizontalPosition}px`, left: 0, right: 0, height: 1 }}
        />
      )}
      <CanvasSpacingGuide guide={guides?.spacing} />
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
          </button>
        );
      })}
    </div>
  );
}
