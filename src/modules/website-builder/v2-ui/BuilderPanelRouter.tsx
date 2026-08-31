import type { ReactNode } from 'react';

import type {
  EditorInsertCatalogItem,
  EditorInsertCategory,
} from '../core/editor-insert-catalog';

import type {
  EditorMediaAsset,
  EditorMediaFilter,
} from '../core/editor-media-library';

import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

import type {
  EditorLeftPanel,
} from '../core/editor-layout';

import {
  BuilderHistoryPanel,
} from './BuilderHistoryPanel';

import {
  BuilderComponentsPanel,
} from './BuilderComponentsPanel';

import {
  BuilderInsertPanel,
} from './BuilderInsertPanel';

import {
  BuilderLayersPanel,
} from './BuilderLayersPanel';

import {
  BuilderMediaPanel,
} from './BuilderMediaPanel';

import {
  BuilderPagesPanel,
} from './BuilderPagesPanel';

export interface BuilderPanelRouterProps {
  shell: EditorShellContract;

  aiPanel?: ReactNode;
  sitePanel?: ReactNode;
  settingsPanel?: ReactNode;

  symbols?: Array<{ id: string; name?: string; element: { id: string; [key: string]: unknown }; [key: string]: unknown }>;
  canCreateSymbol?: boolean;
  canDetachSymbol?: boolean;
  onCreateSymbol?(): void;
  onDetachSymbol?(): void;
  onInsertSymbol?(symbolId: string): void;
  onDeleteSymbol?(symbolId: string): void;

  insertQuery?: string;
  insertCategory?: EditorInsertCategory;

  onInsertQueryChange?(
    query: string,
  ): void;

  onInsertCategoryChange?(
    category?: EditorInsertCategory,
  ): void;

  onInsert?(
    item: EditorInsertCatalogItem,
  ): void;

  mediaAssets?: EditorMediaAsset[];
  mediaFilter?: EditorMediaFilter;

  onMediaFilterChange?(
    filter: EditorMediaFilter,
  ): void;

  onMediaSelect?(
    asset: EditorMediaAsset,
  ): void;

  onMediaUpload?(): void;

  onGenerateMediaWithAI?(
    prompt: string,
  ): void | Promise<void>;

  onAddPage?(): void;

  onMovePage?(
    pageId: string,
    direction: 'up' | 'down',
  ): void;

  onDuplicatePage?(): void;
  onDeletePage?(): void;
  onSetHomePage?(): void;

  onMoveSection?(
    sectionId: string,
    direction: 'up' | 'down',
  ): void;

  onDuplicateSection?(
    sectionId: string,
  ): void;

  onDeleteSection?(
    sectionId: string,
  ): void;

  onMoveElement?(
    sectionId: string,
    elementId: string,
    direction: 'up' | 'down',
  ): void;

  onDuplicateElement?(
    sectionId: string,
    elementId: string,
  ): void;

  onDeleteElement?(
    sectionId: string,
    elementId: string,
  ): void;

  onUngroupContainer?(
    sectionId: string,
    containerId: string,
  ): void;

  onAddFormField?(
    sectionId: string,
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox',
  ): void;

  onMoveFormField?(
    sectionId: string,
    formFieldId: string,
    direction: 'up' | 'down',
  ): void;

  onDeleteFormField?(
    sectionId: string,
    formFieldId: string,
  ): void;

  onResetForm?(sectionId: string): void;
}

export function BuilderPanelRouter(
  props: BuilderPanelRouterProps,
) {
  return function renderPanel(
    panel: EditorLeftPanel,
  ): ReactNode {
    if (panel === 'ai') {
      return (
        <div className="tayar-v2-ai-panel-host">
          {props.aiPanel || (
            <div className="tayar-v2-empty-panel">
              Tayar AI is loading...
            </div>
          )}
        </div>
      );
    }

    if (panel === 'pages') {
      return (
        <BuilderPagesPanel
          shell={props.shell}
          onAddPage={props.onAddPage}
          onMovePage={props.onMovePage}
          onDuplicatePage={props.onDuplicatePage}
          onDeletePage={props.onDeletePage}
          onSetHomePage={props.onSetHomePage}
        />
      );
    }

    if (panel === 'layers') {
      return (
        <BuilderLayersPanel
          shell={props.shell}
          onMoveSection={props.onMoveSection}
          onDuplicateSection={props.onDuplicateSection}
          onDeleteSection={props.onDeleteSection}
          onMoveElement={props.onMoveElement}
          onDuplicateElement={props.onDuplicateElement}
          onDeleteElement={props.onDeleteElement}
          onUngroupContainer={props.onUngroupContainer}
          onAddFormField={props.onAddFormField}
          onMoveFormField={props.onMoveFormField}
          onDeleteFormField={props.onDeleteFormField}
          onResetForm={props.onResetForm}
        />
      );
    }

    if (panel === 'components') {
      return (
        <BuilderComponentsPanel
          symbols={(props.symbols || []) as any}
          canCreate={props.canCreateSymbol}
          canDetach={props.canDetachSymbol}
          onCreate={props.onCreateSymbol}
          onDetach={props.onDetachSymbol}
          onInsert={props.onInsertSymbol}
          onDelete={props.onDeleteSymbol}
        />
      );
    }

    if (panel === 'site') {
      return props.sitePanel || (
        <div className="tayar-v2-empty-panel">
          Site controls are loading...
        </div>
      );
    }

    if (panel === 'settings') {
      return props.settingsPanel || (
        <div className="tayar-v2-empty-panel">
          Settings are loading...
        </div>
      );
    }

    if (panel === 'history') {
      return (
        <BuilderHistoryPanel
          shell={props.shell}
        />
      );
    }

    if (panel === 'insert') {
      return (
        <BuilderInsertPanel
          query={
            props.insertQuery
          }
          category={
            props.insertCategory
          }
          onQueryChange={
            props.onInsertQueryChange
          }
          onCategoryChange={
            props.onInsertCategoryChange
          }
          onInsert={
            props.onInsert ||
            (() => undefined)
          }
        />
      );
    }

    if (panel === 'media') {
      return (
        <BuilderMediaPanel
          assets={
            props.mediaAssets ||
            []
          }
          filter={
            props.mediaFilter
          }
          onFilterChange={
            props.onMediaFilterChange
          }
          onSelect={
            props.onMediaSelect ||
            (() => undefined)
          }
          onUpload={
            props.onMediaUpload
          }
          onGenerateWithAI={
            props.onGenerateMediaWithAI
          }
        />
      );
    }

    return (
      props.aiPanel || (
        <div className="tayar-v2-empty-panel">
          Tayar AI
        </div>
      )
    );
  };
}
