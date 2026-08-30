import type { EditorInsertCatalogItem, EditorInsertCategory } from '../core/editor-insert-catalog';
import { EDITOR_INSERT_CATALOG, filterEditorInsertCatalog } from '../core/editor-insert-catalog';

export interface BuilderInsertPanelProps {
  query?: string;
  category?: EditorInsertCategory;
  catalog?: EditorInsertCatalogItem[];
  onQueryChange?(query: string): void;
  onCategoryChange?(category?: EditorInsertCategory): void;
  onInsert(item: EditorInsertCatalogItem): void;
}

const CATEGORIES: Array<{ id?: EditorInsertCategory; label: string }> = [
  { label: 'All' },
  { id: 'layout', label: 'Layout' },
  { id: 'content', label: 'Content' },
  { id: 'media', label: 'Media' },
  { id: 'forms', label: 'Forms' },
  { id: 'advanced', label: 'Advanced' },
];

export function BuilderInsertPanel({
  query = '',
  category,
  catalog = EDITOR_INSERT_CATALOG,
  onQueryChange,
  onCategoryChange,
  onInsert,
}: BuilderInsertPanelProps) {
  const items = filterEditorInsertCatalog(query, category, catalog);
  return (
    <div className="tayar-v2-insert-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Insert</strong>
        <span>{items.length} blocks</span>
      </div>
      <div className="tayar-v2-panel-search">
        <input
          type="search"
          value={query}
          placeholder="Search elements"
          aria-label="Search insert elements"
          onChange={(event: any) => onQueryChange?.(event.target.value)}
        />
      </div>
      <div className="tayar-v2-chip-row" role="group" aria-label="Insert category">
        {CATEGORIES.map((item) => (
          <button
            key={item.id || 'all'}
            type="button"
            aria-pressed={category === item.id || (!category && !item.id)}
            onClick={() => onCategoryChange?.(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="tayar-v2-insert-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="tayar-v2-insert-card"
            onClick={() => onInsert(item)}
          >
            <span className="tayar-v2-insert-card__title">
              {item.label}{item.recommended ? <small>Recommended</small> : null}
            </span>
            <span>{item.description}</span>
          </button>
        ))}
        {!items.length && <div className="tayar-v2-empty-panel">No matching elements.</div>}
      </div>
    </div>
  );
}
