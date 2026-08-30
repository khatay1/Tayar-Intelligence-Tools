import type { ReactNode } from 'react';
import type { EditorInsertCatalogItem, EditorInsertCategory } from '../core/editor-insert-catalog';
import type { EditorMediaAsset, EditorMediaFilter } from '../core/editor-media-library';
import type { EditorShellContract } from '../core/editor-shell-contract';
import type { EditorLeftPanel } from '../core/editor-layout';
import { BuilderHistoryPanel } from './BuilderHistoryPanel';
import { BuilderInsertPanel } from './BuilderInsertPanel';
import { BuilderLayersPanel } from './BuilderLayersPanel';
import { BuilderMediaPanel } from './BuilderMediaPanel';
import { BuilderPagesPanel } from './BuilderPagesPanel';

export interface BuilderPanelRouterProps {
  shell: EditorShellContract;
  aiPanel?: ReactNode;
  insertQuery?: string;
  insertCategory?: EditorInsertCategory;
  onInsertQueryChange?(query: string): void;
  onInsertCategoryChange?(category?: EditorInsertCategory): void;
  onInsert?(item: EditorInsertCatalogItem): void;
  mediaAssets?: EditorMediaAsset[];
  mediaFilter?: EditorMediaFilter;
  onMediaFilterChange?(filter: EditorMediaFilter): void;
  onMediaSelect?(asset: EditorMediaAsset): void;
  onMediaUpload?(): void;
  onGenerateMediaWithAI?(): void;
}

export function BuilderPanelRouter(props: BuilderPanelRouterProps) {
  return function renderPanel(panel: EditorLeftPanel): ReactNode {
    if (panel === 'pages') return <BuilderPagesPanel shell={props.shell} />;
    if (panel === 'layers') return <BuilderLayersPanel shell={props.shell} />;
    if (panel === 'history') return <BuilderHistoryPanel shell={props.shell} />;
    if (panel === 'insert') {
      return <BuilderInsertPanel
        query={props.insertQuery}
        category={props.insertCategory}
        onQueryChange={props.onInsertQueryChange}
        onCategoryChange={props.onInsertCategoryChange}
        onInsert={props.onInsert || (() => undefined)}
      />;
    }
    if (panel === 'media') {
      return <BuilderMediaPanel
        assets={props.mediaAssets || []}
        filter={props.mediaFilter}
        onFilterChange={props.onMediaFilterChange}
        onSelect={props.onMediaSelect || (() => undefined)}
        onUpload={props.onMediaUpload}
        onGenerateWithAI={props.onGenerateMediaWithAI}
      />;
    }
    return props.aiPanel || <div className="tayar-v2-empty-panel">Tayar AI panel slot</div>;
  };
}
