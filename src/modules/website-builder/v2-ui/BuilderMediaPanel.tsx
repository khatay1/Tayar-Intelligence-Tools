import type { EditorMediaAsset, EditorMediaFilter } from '../core/editor-media-library';
import { filterEditorMediaAssets } from '../core/editor-media-library';

export interface BuilderMediaPanelProps {
  assets: EditorMediaAsset[];
  filter?: EditorMediaFilter;
  onFilterChange?(filter: EditorMediaFilter): void;
  onSelect(asset: EditorMediaAsset): void;
  onUpload?(): void;
  onGenerateWithAI?(): void;
}

export function BuilderMediaPanel({
  assets,
  filter = {},
  onFilterChange,
  onSelect,
  onUpload,
  onGenerateWithAI,
}: BuilderMediaPanelProps) {
  const visible = filterEditorMediaAssets(assets, filter);
  return (
    <div className="tayar-v2-media-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Media</strong>
        <span>{visible.length} items</span>
      </div>
      <div className="tayar-v2-panel-actions">
        {onUpload && <button type="button" onClick={onUpload}>Upload</button>}
        {onGenerateWithAI && <button type="button" onClick={onGenerateWithAI}>Generate with AI</button>}
      </div>
      <div className="tayar-v2-panel-search">
        <input
          type="search"
          value={filter.query || ''}
          placeholder="Search media"
          aria-label="Search media"
          onChange={(event: any) => onFilterChange?.({ ...filter, query: event.target.value })}
        />
      </div>
      <div className="tayar-v2-media-grid">
        {visible.map((asset) => (
          <button key={asset.id} type="button" className="tayar-v2-media-card" onClick={() => onSelect(asset)}>
            <span className="tayar-v2-media-card__preview" data-kind={asset.kind}>
              {asset.kind === 'image' ? <img src={asset.url} alt={asset.alt || asset.name} loading="lazy" /> : <span>{asset.kind.toUpperCase()}</span>}
            </span>
            <span className="tayar-v2-media-card__name">{asset.name}</span>
            <small>{asset.origin}</small>
          </button>
        ))}
        {!visible.length && <div className="tayar-v2-empty-panel">No media yet.</div>}
      </div>
    </div>
  );
}
