import { useLocalizer } from '@/lib/ui-localization';
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
  const l = useLocalizer();
  return (
    <div className="tayar-v2-components-panel">
      <div className="tayar-v2-panel-heading">
        <strong>{l('Components')}</strong>
        <span>{symbols.length}</span>
      </div>

      <div className="tayar-v2-empty-panel">
        Components are reusable linked elements. Create one from the selected element, insert it anywhere, and linked copies stay in sync. Detach makes only the selected copy independent.
      </div>

      <div className="tayar-v2-panel-actions">
        <button
          type="button"
          disabled={!canCreate}
          onClick={onCreate}
          title={canCreate ? 'Create a reusable linked component from the selected element' : 'Select a normal element first'}
        >
          Create component
        </button>
        <button
          type="button"
          disabled={!canDetach}
          onClick={onDetach}
          title={canDetach ? 'Detach the selected linked instance' : 'Select a linked component instance first'}
        >
          Detach selected
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
            Select an element on the canvas, then choose “Create component”.
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
