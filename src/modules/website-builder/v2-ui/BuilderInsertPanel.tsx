import type { ChangeEvent } from 'react';
import type {
  EditorInsertCatalogItem,
  EditorInsertCategory,
} from '../core/editor-insert-catalog';

import {
  EDITOR_INSERT_CATALOG,
  filterEditorInsertCatalog,
} from '../core/editor-insert-catalog';

export interface BuilderInsertPanelProps {
  query?: string;
  category?: EditorInsertCategory;
  catalog?: EditorInsertCatalogItem[];
  onQueryChange?(query: string): void;
  onCategoryChange?(category?: EditorInsertCategory): void;
  onInsert(item: EditorInsertCatalogItem): void;
}

const CATEGORIES: Array<{
  id?: EditorInsertCategory;
  label: string;
}> = [
  { label: 'All' },
  { id: 'layout', label: 'Layout' },
  { id: 'content', label: 'Text' },
  { id: 'media', label: 'Media' },
  { id: 'forms', label: 'Forms' },
  { id: 'advanced', label: 'More' },
];

export function BuilderInsertPanel({
  query = '',
  category,
  catalog = EDITOR_INSERT_CATALOG,
  onQueryChange,
  onCategoryChange,
  onInsert,
}: BuilderInsertPanelProps) {
  const items =
    filterEditorInsertCatalog(
      query,
      category,
      catalog,
    );

  return (
    <div className="tayar-v2-insert-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Insert</strong>
      </div>

      <div className="tayar-v2-panel-search">
        <input
          type="search"
          value={query}
          placeholder="Search"
          aria-label="Search elements"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onQueryChange?.(
              event.currentTarget.value,
            )
          }
        />
      </div>

      <div
        className="tayar-v2-chip-row"
        role="group"
        aria-label="Category"
      >
        {CATEGORIES.map((item) => (
          <button
            key={item.id || 'all'}
            type="button"
            aria-pressed={
              category === item.id ||
              (!category && !item.id)
            }
            onClick={() =>
              onCategoryChange?.(
                item.id,
              )
            }
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
            title={item.description}
            onClick={() => onInsert(item)}
          >
            <span className="tayar-v2-insert-card__icon">
              +
            </span>

            <span className="tayar-v2-insert-card__title">
              {item.label}
            </span>
          </button>
        ))}

        {!items.length && (
          <div className="tayar-v2-empty-panel">
            No results
          </div>
        )}
      </div>
    </div>
  );
}
