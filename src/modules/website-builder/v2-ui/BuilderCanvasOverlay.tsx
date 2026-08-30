import type { EditorCanvasOverlayItem } from '../core/editor-canvas-overlay';
import { selectionForEditorCanvasTarget } from '../core/editor-canvas-overlay';
import type { EditorShellContract } from '../core/editor-shell-contract';

export interface BuilderCanvasOverlayProps {
  shell: EditorShellContract;
  items: EditorCanvasOverlayItem[];
  onHover?(id?: string): void;
}

export function BuilderCanvasOverlay({ shell, items, onHover }: BuilderCanvasOverlayProps) {
  return (
    <div className="tayar-v2-canvas-overlay" aria-hidden="true">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          tabIndex={-1}
          className="tayar-v2-canvas-overlay__target"
          data-kind={item.kind}
          data-selected={item.selected ? 'true' : 'false'}
          data-active={item.active ? 'true' : 'false'}
          style={{
            left: `${item.rect.x}px`,
            top: `${item.rect.y}px`,
            width: `${item.rect.width}px`,
            height: `${item.rect.height}px`,
          }}
          onMouseEnter={() => onHover?.(item.id)}
          onMouseLeave={() => onHover?.(undefined)}
          onClick={() => shell.actions.onSelect(selectionForEditorCanvasTarget(item))}
        >
          {(item.selected || item.active) && <span>{item.label || item.kind}</span>}
        </button>
      ))}
    </div>
  );
}
