import type { EditorSymbolLike } from '../core/editor-model';

export interface BuilderComponentsPanelProps {
  symbols: EditorSymbolLike[];
  canCreate?: boolean;
  canInsert?: boolean;
  canDetach?: boolean;
  onCreate?(): void;
  onDetach?(): void;
  onInsert?(symbolId: string): void;
  onDelete?(symbolId: string): void;
}

export function BuilderComponentsPanel({
  symbols,
  canCreate,
  canInsert,
  canDetach,
  onCreate,
  onDetach,
  onInsert,
  onDelete,
}: BuilderComponentsPanelProps) {
  return (
    <div className="tayar-v2-components-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Components</strong>
        <span>{symbols.length}</span>
      </div>

      <div className="tayar-v2-panel-actions">
        <button type="button" disabled={!canCreate} onClick={onCreate}>
          Save selected element
        </button>
        <button type="button" disabled={!canDetach} onClick={onDetach}>
          Detach
        </button>
      </div>

      <div className="tayar-v2-component-list">
        {symbols.map((symbol) => (
          <div className="tayar-v2-component-row" key={symbol.id}>
            <button
              type="button"
              className="tayar-v2-component-row__insert"
              disabled={!canInsert}
              onClick={() => onInsert?.(symbol.id)}
              title={canInsert ? 'Insert component into the selected section' : 'Select a section or element first'}
            >
              <span>◆</span>
              <span>{symbol.name || 'Component'}</span>
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => onDelete?.(symbol.id)}
              title="Delete component"
            >
              DEL
            </button>
          </div>
        ))}

        {!symbols.length && (
          <div className="tayar-v2-empty-panel">
            Select an element on the canvas, then choose “Save selected element”.
          </div>
        )}

        {symbols.length > 0 && !canInsert && (
          <div className="tayar-v2-empty-panel">
            Select a section or an element on the canvas before inserting a component.
          </div>
        )}
      </div>
    </div>
  );
}

export default BuilderComponentsPanel;
