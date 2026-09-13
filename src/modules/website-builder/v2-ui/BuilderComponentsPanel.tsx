import { useMemo, useState } from 'react';
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
  onRename?(symbolId: string, name: string): void;
  onDuplicate?(symbolId: string): void;
  onSelectInstance?(symbolId: string): void;
  activeSymbolId?: string;
  instanceCounts?: Record<string, number>;
  disabled?: boolean;
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
  onRename,
  onDuplicate,
  onSelectInstance,
  activeSymbolId,
  instanceCounts = {},
  disabled = false,
}: BuilderComponentsPanelProps) {
  const l = useLocalizer();
  const [query, setQuery] = useState('');
  const visibleSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return symbols;
    return symbols.filter((symbol) => (symbol.name || l('Component')).toLocaleLowerCase().includes(normalizedQuery));
  }, [l, query, symbols]);

  const renameSymbol = (symbol: EditorSymbolLike) => {
    if (!onRename || disabled) return;
    const nextName = window.prompt(l('Component name'), symbol.name || l('Component'))?.trim();
    if (!nextName || nextName === symbol.name) return;
    onRename(symbol.id, nextName.slice(0, 80));
  };
  return (
    <div className="tayar-v2-components-panel" aria-busy={disabled}>
      <div className="tayar-v2-panel-heading">
        <strong>{l('Components')}</strong>
        <span>{symbols.length}</span>
      </div>

      <div className="tayar-v2-empty-panel">{l('Components are reusable linked elements. Create one from the selected element, insert it anywhere, and linked copies stay in sync. Detach makes only the selected copy independent.')}</div>

      <div className="tayar-v2-panel-actions">
        <button
          type="button"
          disabled={disabled || !canCreate || !onCreate}
          onClick={onCreate}
          title={canCreate ? l('Create a reusable linked component from the selected element') : l('Select a normal element first')}
        >{l('Create component')}</button>
        <button
          type="button"
          disabled={disabled || !canDetach || !onDetach}
          onClick={onDetach}
          title={canDetach ? l('Detach the selected linked instance') : l('Select a linked component instance first')}
        >{l('Detach selected')}</button>
      </div>

      {symbols.length > 4 && (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={l('Search components')}
          aria-label={l('Search components')}
          disabled={disabled}
          className="tayar-v2-component-search"
        />
      )}

      <div className="tayar-v2-component-list">
        {visibleSymbols.map((symbol) => (
          <div className="tayar-v2-component-row" key={symbol.id} data-active={activeSymbolId === symbol.id ? 'true' : 'false'}>
            <button
              type="button"
              className="tayar-v2-component-row__insert"
              disabled={disabled || !canInsert || !onInsert}
              onClick={() => onInsert?.(symbol.id)}
              title={canInsert ? l('Insert component into the selected section') : l('Select a section or element first')}
            >
              <span>◆</span>
              <span className="tayar-v2-component-row__meta">
                <strong>{symbol.name || l('Component')}</strong>
                <small>{instanceCounts[symbol.id] || 0} {l('instances')}</small>
              </span>
            </button>
            <button
              type="button"
              disabled={disabled || !onRename}
              onClick={() => renameSymbol(symbol)}
              title={l('Rename component')}
            >{l('REN')}</button>
            <button
              type="button"
              disabled={disabled || !onDuplicate}
              onClick={() => onDuplicate?.(symbol.id)}
              title={l('Duplicate component')}
            >{l('DUP')}</button>
            <button
              type="button"
              disabled={disabled || !onSelectInstance || !instanceCounts[symbol.id]}
              onClick={() => onSelectInstance?.(symbol.id)}
              title={l('Find next instance')}
            >{l('FIND')}</button>
            <button
              type="button"
              className="is-danger"
              disabled={disabled || !onDelete}
              onClick={() => onDelete?.(symbol.id)}
              title={l('Delete component')}
            >{l('DEL')}</button>
          </div>
        ))}

        {!symbols.length && (
          <div className="tayar-v2-empty-panel">{l('Select an element on the canvas, then choose “Create component”.')}</div>
        )}

        {symbols.length > 0 && !visibleSymbols.length && (
          <div className="tayar-v2-empty-panel">{l('No matching components')}</div>
        )}

        {symbols.length > 0 && !canInsert && (
          <div className="tayar-v2-empty-panel">{l('Select a section or an element on the canvas before inserting a component.')}</div>
        )}
      </div>
    </div>
  );
}

export default BuilderComponentsPanel;
