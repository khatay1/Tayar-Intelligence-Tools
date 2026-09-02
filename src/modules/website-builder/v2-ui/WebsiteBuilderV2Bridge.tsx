import { useLocalizer } from '@/lib/ui-localization';
﻿import {
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  createEditorControllerState,
} from '../core/editor-controller';

import {
  createEditorShellContract,
  type EditorShellAdapterCallbacks,
} from '../core/editor-shell-adapter';

import type {
  EditorInspectorTab,
  EditorLeftPanel,
  EditorPreviewDevice,
} from '../core/editor-layout';

import type {
  EditorContainerLike,
  EditorElementLike,
  EditorPageLike,
  EditorProjectLike,
  EditorSectionLike,
} from '../core/editor-model';

import type {
  EditorSelection,
} from '../core/editor-selection';

import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

import type {
  EditorInsertCatalogItem,
} from '../core/editor-insert-catalog';

import type {
  EditorMediaAsset,
} from '../core/editor-media-library';

import type {
  EditorNativeOperation,
} from '../core/editor-native-operation';

import {
  createElement as createWebsiteElement,
  createSection as createWebsiteSection,
} from '../core/defaults';

import type {
  SectionType,
  WebsiteElementType,
} from '../core/types';

import {
  BuilderV2NativeBridge,
} from './BuilderV2NativeBridge';

import './website-builder-v2.css';

export interface WebsiteBuilderV2BridgeProps {
  canvas: ReactNode;
  aiPanel?: ReactNode;
  topbarTrailingSlot?: ReactNode;
  sitePanel?: ReactNode;
  settingsPanel?: ReactNode;

  symbols?: EditorProjectLike['symbols'];
  onCreateSymbol?(): void;
  onDetachSymbol?(): void;
  onInsertSymbol?(symbolId: string): void;
  onDeleteSymbol?(symbolId: string): void;

  pages: EditorPageLike[];
  homePageId?: string;

  activePageId: string;
  selectedSectionId?: string | null;
  selectedElementId?: string | null;
  selectedContainerId?: string | null;
  selectedFormFieldId?: string | null;

  device: EditorPreviewDevice;

  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  historyEntries?: Array<{
    id: string;
    label: string;
    createdAt: number;
    source: 'manual' | 'ai' | 'system';
  }>;
  futureEntries?: Array<{
    id: string;
    label: string;
    createdAt: number;
    source: 'manual' | 'ai' | 'system';
  }>;

  saving?: boolean;
  publishing?: boolean;
  checking?: boolean;
  saveError?: string;
  publishError?: string;
  checkScore?: number;
  checkErrors?: number;
  checkWarnings?: number;
  lastCheckedAt?: number;
  publishedUrl?: string;
  publishedAt?: number;
  publishedOutdated?: boolean;
  liveVerification?: 'idle' | 'checking' | 'healthy' | 'failed';

  publishBlockers?: string[];

  mediaAssets?: EditorMediaAsset[];

  accent?: string;

  onMediaOpen?(): void;
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

  onApplyOperations(
    operations: EditorNativeOperation[],
    nextSelection?: EditorSelection,
  ): void;

  onRestoreHistoryEntry?(entryId: string): void;

  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onPreview(): void;
  onPublish(): void;
  onRunCheck(): void;

  onSetDevice(
    device: EditorPreviewDevice,
  ): void;

  onSelect(
    selection: EditorSelection,
  ): void;
}

const SECTION_TYPES =
  new Set<SectionType>([
    'hero',
    'features',
    'about',
    'services',
    'pricing',
    'testimonials',
    'contact',
    'footer',
  ]);

function createNativeId(
  prefix: string,
) {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.();

  if (uuid) {
    return `${prefix}-${uuid}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function WebsiteBuilderV2Bridge({
canvas,
  aiPanel,
  topbarTrailingSlot,
  sitePanel,
  settingsPanel,

  symbols = [],
  onCreateSymbol,
  onDetachSymbol,
  onInsertSymbol,
  onDeleteSymbol,

  pages,
  homePageId,

  activePageId,
  selectedSectionId,
  selectedElementId,
  selectedContainerId,
  selectedFormFieldId,

  device,

  dirty,
  canUndo,
  canRedo,
  historyEntries = [],
  futureEntries = [],

  saving,
  publishing,
  checking,
  saveError,
  publishError,
  checkScore,
  checkErrors,
  checkWarnings,
  lastCheckedAt,
  publishedUrl,
  publishedAt,
  publishedOutdated,
  liveVerification,

  publishBlockers = [],

  mediaAssets = [],

  accent = '#7c3aed',

  onMediaOpen,
  onMediaUpload,
  onGenerateMediaWithAI,

  onAddPage,
  onMovePage,
  onDuplicatePage,
  onDeletePage,
  onSetHomePage,

  onMoveSection,
  onDuplicateSection,
  onDeleteSection,

  onMoveElement,
  onDuplicateElement,
  onDeleteElement,

  onApplyOperations,
  onRestoreHistoryEntry,

  onUndo,
  onRedo,
  onSave,
  onPreview,
  onPublish,
  onRunCheck,

  onSetDevice,
  onSelect,
}: WebsiteBuilderV2BridgeProps) {
  const l = useLocalizer();
  const [leftPanel, setLeftPanel] =
    useState<EditorLeftPanel>('pages');

  const [
    inspectorTab,
    setInspectorTab,
  ] =
    useState<EditorInspectorTab>(
      'content',
    );

  const [
    focusMode,
    setFocusMode,
  ] =
    useState(false);

  const [
    leftSidebarOpen,
    setLeftSidebarOpen,
  ] =
    useState(true);

  const [
    inspectorOpen,
    setInspectorOpen,
  ] =
    useState(true);

  const project =
    useMemo<EditorProjectLike>(
      () => ({
        pages,
        homePageId,
        symbols,
      }),
      [
        pages,
        homePageId,
        symbols,
      ],
    );

  const selection =
    useMemo<EditorSelection>(
      () => ({
        pageId:
          activePageId,

        ...(selectedSectionId
          ? {
              sectionId:
                selectedSectionId,
            }
          : {}),

        ...(selectedElementId
          ? {
              elementId:
                selectedElementId,
            }
          : {}),

        ...(!selectedElementId &&
        selectedContainerId
          ? {
              containerId:
                selectedContainerId,
            }
          : {}),

        ...(!selectedElementId &&
        !selectedContainerId &&
        selectedFormFieldId
          ? {
              formFieldId:
                selectedFormFieldId,
            }
          : {}),
      }),
      [
        activePageId,
        selectedSectionId,
        selectedElementId,
        selectedContainerId,
        selectedFormFieldId,
      ],
    );

  const layout =
    useMemo(
      () => ({
        leftSidebarOpen,
        leftPanel,

        inspectorOpen,
        inspectorTab,

        focusMode,

        previewDevice:
          device,
      }),
      [
        leftSidebarOpen,
        leftPanel,
        inspectorOpen,
        inspectorTab,
        focusMode,
        device,
      ],
    );

  const controllerState =
    useMemo(
      () =>
        createEditorControllerState(
          project,
          {
            selection,
            layout,
          },
        ),
      [
        project,
        selection,
        layout,
      ],
    );

  const shellCallbacks =
    useMemo<EditorShellAdapterCallbacks>(
      () => ({
        undo: onUndo,
        redo: onRedo,

        save: onSave,
        preview: onPreview,
        publish: onPublish,
        runCheck: () => {
          setLeftPanel('settings');
          setLeftSidebarOpen(true);
          setFocusMode(false);
          onRunCheck();
        },

        toggleFocus: () =>
          setFocusMode(
            (current) =>
              !current,
          ),

        toggleLeftSidebar: () => {
          setFocusMode(false);

          setLeftSidebarOpen(
            (current) =>
              !current,
          );
        },

        toggleInspector: () => {
          setFocusMode(false);

          setInspectorOpen(
            (current) =>
              !current,
          );
        },

        openLeftPanel: (
          panel,
        ) => {
          setLeftPanel(panel);
          setLeftSidebarOpen(true);
          setFocusMode(false);

          if (
            panel === 'media'
          ) {
            onMediaOpen?.();
          }
        },

        openInspectorTab: (
          tab,
        ) => {
          setInspectorTab(tab);
          setInspectorOpen(true);
          setFocusMode(false);
        },

        setPreviewDevice:
          onSetDevice,

        select:
          onSelect,
      }),
      [
        onUndo,
        onRedo,
        onSave,
        onPreview,
        onPublish,
        onRunCheck,
        onSetDevice,
        onSelect,
        onMediaOpen,
      ],
    );

  const baseShell =
    useMemo(
      () =>
        createEditorShellContract(
          controllerState,
          shellCallbacks,
          {
            saving,
            publishing,
            checking,
            saveError,
            publishError,
            checkScore,
            checkErrors,
            checkWarnings,
            lastCheckedAt,
            publishedUrl,
            publishedAt,
            publishedOutdated,
            liveVerification,
          },
        ),
      [
        controllerState,
        shellCallbacks,
        saving,
        publishing,
        checking,
        saveError,
        publishError,
        checkScore,
        checkErrors,
        checkWarnings,
        lastCheckedAt,
        publishedUrl,
        publishedAt,
        publishedOutdated,
        liveVerification,
      ],
    );

  const shell =
    useMemo<EditorShellContract>(
      () => {
        const blockers =
          publishBlockers.map(
            (
              message,
              index,
            ) => ({
              code:
                `V1_PREFLIGHT_${index + 1}`,

              severity:
                'blocker' as const,

              message,
            }),
          );

        return {
          ...baseShell,

          view: {
            ...baseShell.view,

            dirty,
            canUndo,
            canRedo,

            publish: {
              ...baseShell
                .view
                .publish,

              canPublish:
                blockers.length === 0,

              blockers,
            },

            history: {
              undo: [...historyEntries].reverse().map((entry) => ({
                ...entry,
                direction: 'undo' as const,
              })),
              redo: futureEntries.map((entry) => ({
                ...entry,
                direction: 'redo' as const,
              })),
              latest: historyEntries[historyEntries.length - 1]
                ? {
                    ...historyEntries[historyEntries.length - 1],
                    direction: 'undo' as const,
                  }
                : undefined,
              total: historyEntries.length + futureEntries.length,
            },
          },
        };
      },
      [
        baseShell,
        dirty,
        canUndo,
        canRedo,
        historyEntries,
        futureEntries,
        publishBlockers,
      ],
    );

  const activePage =
    pages.find(
      (page) =>
        page.id ===
        activePageId,
    ) ??
    pages[0];

  function createNativeSection(
    item:
      EditorInsertCatalogItem,
  ): EditorSectionLike {
    const requested =
      item.sectionType as
        | SectionType
        | undefined;

    const type:
      SectionType =
      requested &&
      SECTION_TYPES.has(
        requested,
      )
        ? requested
        : item.id ===
            'contact-form'
          ? 'contact'
          : 'features';

    return createWebsiteSection(
      type,
    ) as unknown as
      EditorSectionLike;
  }

  function createNativeContainer(
    _item:
      EditorInsertCatalogItem,
  ): EditorContainerLike {
    return {
      id:
        createNativeId(
          'container',
        ),

      name:
        'Container',

      layout:
        'stack',

      gap:
        16,

      align:
        'stretch',

      backgroundColor:
        'transparent',

      padding:
        0,

      borderRadius:
        0,

      borderWidth:
        0,

      borderColor:
        '#374151',

      shadow:
        'none',
    };
  }

  function createNativeElement(
    item:
      EditorInsertCatalogItem,

    asset?:
      EditorMediaAsset,
  ): EditorElementLike {
    if (
      !item.elementType ||
      item.elementType ===
        'container'
    ) {
      throw new Error(
        `Invalid V2 element type: ${item.id}`,
      );
    }

    const element =
      createWebsiteElement(
        item.elementType as
          WebsiteElementType,

        accent,
      ) as unknown as
        EditorElementLike;

    if (
      asset &&
      item.elementType ===
        'image'
    ) {
      return {
        ...element,

        src:
          asset.url,

        content:
          asset.alt ||
          asset.name,

        alt:
          asset.alt ||
          asset.name,
      };
    }

    return element;
  }

  return (
    <BuilderV2NativeBridge
      shell={shell}

      project={project}

      selection={
        selection
      }

      brandSlot={
        <div>
          <strong>
            Website Builder
          </strong>

          <small
            style={{
              marginLeft: 8,
              opacity: 0.55,
            }}
          >
            V2
          </small>
        </div>
      }

      topbarCenterSlot={
        <span>
          {activePage?.name ||
            'Website'}
        </span>
      }

      canvas={
        canvas
      }

      topbarTrailingSlot={
        topbarTrailingSlot
      }

      aiPanel={
        aiPanel
      }

      sitePanel={
        sitePanel
      }

      settingsPanel={
        settingsPanel
      }

      symbols={
        symbols
      }

      onCreateSymbol={
        onCreateSymbol
      }

      onDetachSymbol={
        onDetachSymbol
      }

      onInsertSymbol={
        onInsertSymbol
      }

      onDeleteSymbol={
        onDeleteSymbol
      }

      mediaAssets={
        mediaAssets
      }

      onMediaUpload={
        onMediaUpload
      }

      onGenerateMediaWithAI={
        onGenerateMediaWithAI
      }

      onAddPage={onAddPage}
      onMovePage={onMovePage}
      onDuplicatePage={onDuplicatePage}
      onDeletePage={onDeletePage}
      onSetHomePage={onSetHomePage}

      onMoveSection={onMoveSection}
      onDuplicateSection={onDuplicateSection}
      onDeleteSection={onDeleteSection}

      onMoveElement={onMoveElement}
      onDuplicateElement={onDuplicateElement}
      onDeleteElement={onDeleteElement}

      createSection={
        createNativeSection
      }

      createContainer={
        createNativeContainer
      }

      createElement={
        createNativeElement
      }

      onApplyOperations={
        onApplyOperations
      }

      onRestoreHistoryEntry={
        onRestoreHistoryEntry
      }
    />
  );
}

export default WebsiteBuilderV2Bridge;
