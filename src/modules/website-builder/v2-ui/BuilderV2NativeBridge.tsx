import { useMemo, useState, type ReactNode } from 'react';
import type {
  EditorContainerLike,
  EditorElementLike,
  EditorProjectLike,
  EditorSectionLike,
  EditorSymbolLike,
} from '../core/editor-model';
import { findEditorElement } from '../core/editor-model';
import {
  EDITOR_INSERT_CATALOG,
  type EditorInsertCatalogItem,
  type EditorInsertCategory,
} from '../core/editor-insert-catalog';
import { planEditorInsertPlacement } from '../core/editor-insert-planner';
import { buildEditorInspectorFields } from '../core/editor-inspector-model';
import { buildEditorInspectorOperation } from '../core/editor-inspector-operation';
import type {
  EditorMediaAsset,
  EditorMediaFilter,
} from '../core/editor-media-library';
import type { EditorNativeOperation } from '../core/editor-native-operation';
import type { EditorSelection } from '../core/editor-selection';
import type { EditorShellContract } from '../core/editor-shell-contract';
import type {
  EditorInspectorTab,
  EditorLeftPanel,
} from '../core/editor-layout';

import { BuilderInspectorFields } from './BuilderInspectorFields';
import { BuilderPanelRouter } from './BuilderPanelRouter';
import { WebsiteBuilderV2Shell } from './WebsiteBuilderV2Shell';

export interface BuilderV2NativeBridgeProps<P extends EditorProjectLike> {
  shell: EditorShellContract;
  project: P;
  selection?: EditorSelection;

  brandSlot?: ReactNode;
  topbarCenterSlot?: ReactNode;
  topbarTrailingSlot?: ReactNode;

  canvas: ReactNode;
  canvasOverlaySlot?: ReactNode;
  aiPanel?: ReactNode;
  sitePanel?: ReactNode;
  settingsPanel?: ReactNode;

  symbols?: EditorSymbolLike[];
  onCreateSymbol?(): void;
  onDetachSymbol?(): void;
  onInsertSymbol?(symbolId: string): void;
  onDeleteSymbol?(symbolId: string): void;

  mediaAssets?: EditorMediaAsset[];

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

  createSection(item: EditorInsertCatalogItem): EditorSectionLike;
  createContainer(item: EditorInsertCatalogItem): EditorContainerLike;

  createElement(
    item: EditorInsertCatalogItem,
    asset?: EditorMediaAsset,
  ): EditorElementLike;

  onApplyOperations(
    operations: EditorNativeOperation[],
    nextSelection?: EditorSelection,
  ): void;
}

const SECTION_INSERT_ITEM =
  EDITOR_INSERT_CATALOG.find((item) => item.id === 'section') ||
  EDITOR_INSERT_CATALOG[0];

const IMAGE_INSERT_ITEM =
  EDITOR_INSERT_CATALOG.find((item) => item.id === 'image') ||
  EDITOR_INSERT_CATALOG[0];

function withContainer(
  element: EditorElementLike,
  containerId?: string,
): EditorElementLike {
  if (!containerId) return element;

  return {
    ...element,
    containerId,
  };
}

export function BuilderV2NativeBridge<P extends EditorProjectLike>(
  props: BuilderV2NativeBridgeProps<P>,
) {
  const {
    shell,
    project,
    selection = {},
    mediaAssets = [],
  } = props;

  const [insertQuery, setInsertQuery] = useState('');

  const [insertCategory, setInsertCategory] =
    useState<EditorInsertCategory | undefined>();

  const [mediaFilter, setMediaFilter] =
    useState<EditorMediaFilter>({});

  const inspectorFields = useMemo(
    () => buildEditorInspectorFields(project, selection),
    [project, selection],
  );

  function applyOperations(
    operations: EditorNativeOperation[],
    nextSelection?: EditorSelection,
  ) {
    if (!operations.length) return;

    const manualOperations =
      operations.map((operation) => ({
        ...operation,
        source: operation.source || 'manual' as const,
      }));

    props.onApplyOperations(
      manualOperations,
      nextSelection,
    );
  }

  function ensureSection(
    item: EditorInsertCatalogItem,
  ): {
    pageId: string;
    sectionId: string;
    containerId?: string;
    operations: EditorNativeOperation[];
  } | undefined {
    const placement =
      planEditorInsertPlacement(
        project,
        selection,
      );

    if (!placement) return undefined;

    if (placement.sectionId) {
      return {
        pageId: placement.pageId,
        sectionId: placement.sectionId,
        containerId: placement.containerId,
        operations: [],
      };
    }

    const section =
      props.createSection(
        item.sectionType
          ? item
          : SECTION_INSERT_ITEM,
      );

    return {
      pageId: placement.pageId,
      sectionId: section.id,

      operations: [
        {
          action: 'add_section',
          pageId: placement.pageId,
          section,
        },
      ],
    };
  }

  function handleInsert(
    item: EditorInsertCatalogItem,
  ) {
    const placement =
      planEditorInsertPlacement(
        project,
        selection,
      );

    if (!placement) return;

    // Section / contact form
    if (item.sectionType) {
      const section =
        props.createSection(item);

      applyOperations(
        [
          {
            action: 'add_section',
            pageId: placement.pageId,
            section,
          },
        ],
        {
          pageId: placement.pageId,
          sectionId: section.id,
        },
      );

      return;
    }

    const target =
      ensureSection(item);

    if (!target) return;

    const operations =
      [...target.operations];

    // Real V2 container
    if (item.elementType === 'container') {
      const container =
        props.createContainer(item);

      operations.push({
        action: 'add_container',
        pageId: target.pageId,
        sectionId: target.sectionId,
        container,
      });

      applyOperations(
        operations,
        {
          pageId: target.pageId,
          sectionId: target.sectionId,
          containerId: container.id,
        },
      );

      return;
    }

    // Real V2 element
    if (item.elementType) {
      const element =
        withContainer(
          props.createElement(item),
          target.containerId,
        );

      operations.push({
        action: 'add_element',
        pageId: target.pageId,
        sectionId: target.sectionId,
        element,
      });

      applyOperations(
        operations,
        {
          pageId: target.pageId,
          sectionId: target.sectionId,
          elementId: element.id,
          containerId: target.containerId,
        },
      );
    }
  }

  function handleMediaSelect(
    asset: EditorMediaAsset,
  ) {
    if (asset.kind !== 'image') return;

    // If an image is currently selected,
    // replace that image directly.
    if (
      selection.pageId &&
      selection.sectionId &&
      selection.elementId
    ) {
      const match =
        findEditorElement(
          project,
          selection.pageId,
          selection.sectionId,
          selection.elementId,
        );

      if (
        match &&
        match.element.type === 'image'
      ) {
        applyOperations(
          [
            {
              action: 'update_element',
              pageId: selection.pageId,
              sectionId: selection.sectionId,
              elementId: selection.elementId,

              changes: {
                src: asset.url,
                content:
                  asset.alt ||
                  asset.name,
                alt:
                  asset.alt ||
                  asset.name,
              },
            },
          ],
          selection,
        );

        return;
      }
    }

    // Otherwise insert a new image in
    // selected container / selected section.
    const target =
      ensureSection(
        IMAGE_INSERT_ITEM,
      );

    if (!target) return;

    const element =
      withContainer(
        props.createElement(
          IMAGE_INSERT_ITEM,
          asset,
        ),
        target.containerId,
      );

    applyOperations(
      [
        ...target.operations,

        {
          action: 'add_element',
          pageId: target.pageId,
          sectionId: target.sectionId,
          element,
        },
      ],
      {
        pageId: target.pageId,
        sectionId: target.sectionId,
        elementId: element.id,
        containerId: target.containerId,
      },
    );
  }

  function handleInspectorChange(
    key: string,
    value: unknown,
  ) {
    const operation =
      buildEditorInspectorOperation(
        project,
        selection,
        key,
        value,
      );

    if (!operation) return;

    applyOperations(
      [operation],
      selection,
    );
  }

  function manualId(prefix: string) {
    const uuid =
      globalThis.crypto?.randomUUID?.();

    return uuid
      ? `${prefix}-${uuid}`
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function handleUngroupContainer(
    sectionId: string,
    containerId: string,
  ) {
    if (!selection.pageId) return;

    const section =
      project.pages
        .find((page) => page.id === selection.pageId)
        ?.sections
        .find((candidate) => candidate.id === sectionId);

    if (!section) return;

    const operations: EditorNativeOperation[] =
      section.elements
        .filter((element) => element.containerId === containerId)
        .map((element) => ({
          action: 'assign_element_container' as const,
          pageId: selection.pageId,
          sectionId,
          elementId: element.id,
          containerId: undefined,
        }));

    operations.push({
      action: 'remove_container',
      pageId: selection.pageId,
      sectionId,
      containerId,
    });

    applyOperations(
      operations,
      {
        pageId: selection.pageId,
        sectionId,
      },
    );
  }

  function formFieldDefaults(
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox',
    index = 0,
  ) {
    const labels = {
      text: 'Text',
      email: 'Email',
      tel: 'Phone',
      textarea: 'Message',
      select: 'Select',
      checkbox: 'Checkbox',
    } as const;

    const id = manualId(`field-${type}`);

    return {
      id,
      name: `${type}_${index + 1}`,
      label: labels[type],
      type,
      placeholder:
        type === 'checkbox'
          ? ''
          : `Enter ${labels[type].toLowerCase()}`,
      required: type === 'email',
      ...(type === 'select'
        ? { options: ['Option 1', 'Option 2'] }
        : {}),
    };
  }

  function handleAddFormField(
    sectionId: string,
    type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox',
  ) {
    if (!selection.pageId) return;

    const section =
      project.pages
        .find((page) => page.id === selection.pageId)
        ?.sections
        .find((candidate) => candidate.id === sectionId);

    const field =
      formFieldDefaults(
        type,
        section?.formFields?.length || 0,
      );

    applyOperations(
      [{
        action: 'add_form_field',
        pageId: selection.pageId,
        sectionId,
        formField: field,
      }],
      {
        pageId: selection.pageId,
        sectionId,
        formFieldId: field.id,
      },
    );
  }

  function handleMoveFormField(
    sectionId: string,
    formFieldId: string,
    direction: 'up' | 'down',
  ) {
    if (!selection.pageId) return;

    const fields =
      project.pages
        .find((page) => page.id === selection.pageId)
        ?.sections
        .find((section) => section.id === sectionId)
        ?.formFields || [];

    const index =
      fields.findIndex(
        (field) => field.id === formFieldId,
      );

    if (index < 0) return;

    const target =
      direction === 'up'
        ? index - 1
        : index + 1;

    if (
      target < 0 ||
      target >= fields.length
    ) {
      return;
    }

    applyOperations(
      [{
        action: 'move_form_field',
        pageId: selection.pageId,
        sectionId,
        formFieldId,
        position: {
          index: target,
        },
      }],
      {
        pageId: selection.pageId,
        sectionId,
        formFieldId,
      },
    );
  }

  function handleDeleteFormField(
    sectionId: string,
    formFieldId: string,
  ) {
    if (!selection.pageId) return;

    applyOperations(
      [{
        action: 'remove_form_field',
        pageId: selection.pageId,
        sectionId,
        formFieldId,
      }],
      {
        pageId: selection.pageId,
        sectionId,
      },
    );
  }

  function handleResetForm(
    sectionId: string,
  ) {
    if (!selection.pageId) return;

    const fields = [
      {
        ...formFieldDefaults('text', 0),
        name: 'name',
        label: 'Name',
        placeholder: 'Your name',
        required: true,
      },
      {
        ...formFieldDefaults('email', 1),
        name: 'email',
        label: 'Email',
        placeholder: 'Your email',
        required: true,
      },
      {
        ...formFieldDefaults('textarea', 2),
        name: 'message',
        label: 'Message',
        placeholder: 'Your message',
        required: true,
      },
    ];

    applyOperations(
      [{
        action: 'update_section',
        pageId: selection.pageId,
        sectionId,
        changes: {
          formFields: fields,
          formSuccessMessage:
            'Thanks! Your message has been sent.',
          formSuccessAction: 'message',
          formRedirectUrl: '',
        },
      }],
      {
        pageId: selection.pageId,
        sectionId,
        formFieldId: fields[0].id,
      },
    );
  }

  const renderLeftPanel = useMemo(
    () =>
      BuilderPanelRouter({
        shell,
        aiPanel: props.aiPanel,
        sitePanel: props.sitePanel,
        settingsPanel: props.settingsPanel,

        symbols: props.symbols,
        canCreateSymbol: Boolean(
          selection.elementId &&
          !project.pages
            .find((page) => page.id === selection.pageId)
            ?.sections
            .find((section) => section.id === selection.sectionId)
            ?.elements
            .find((element) => element.id === selection.elementId)
            ?.symbolId
        ),
        canInsertSymbol: Boolean(selection.sectionId),
        canDetachSymbol: Boolean(
          selection.elementId &&
          project.pages
            .find((page) => page.id === selection.pageId)
            ?.sections
            .find((section) => section.id === selection.sectionId)
            ?.elements
            .find((element) => element.id === selection.elementId)
            ?.symbolId
        ),
        onCreateSymbol: props.onCreateSymbol,
        onDetachSymbol: props.onDetachSymbol,
        onInsertSymbol: props.onInsertSymbol,
        onDeleteSymbol: props.onDeleteSymbol,

        insertQuery,
        insertCategory,

        onInsertQueryChange:
          setInsertQuery,

        onInsertCategoryChange:
          setInsertCategory,

        onInsert:
          handleInsert,

        mediaAssets,
        mediaFilter,

        onMediaFilterChange:
          setMediaFilter,

        onMediaSelect:
          handleMediaSelect,

        onMediaUpload:
          props.onMediaUpload,

        onGenerateMediaWithAI:
          props.onGenerateMediaWithAI,

        onAddPage:
          props.onAddPage,

        onMovePage:
          props.onMovePage,

        onDuplicatePage:
          props.onDuplicatePage,

        onDeletePage:
          props.onDeletePage,

        onSetHomePage:
          props.onSetHomePage,

        onMoveSection:
          props.onMoveSection,

        onDuplicateSection:
          props.onDuplicateSection,

        onDeleteSection:
          props.onDeleteSection,

        onMoveElement:
          props.onMoveElement,

        onDuplicateElement:
          props.onDuplicateElement,

        onDeleteElement:
          props.onDeleteElement,

        onUngroupContainer:
          handleUngroupContainer,

        onAddFormField:
          handleAddFormField,

        onMoveFormField:
          handleMoveFormField,

        onDeleteFormField:
          handleDeleteFormField,

        onResetForm:
          handleResetForm,
      }),
    [
      shell,
      props.aiPanel,
      props.sitePanel,
      props.settingsPanel,
      props.symbols,
      props.onCreateSymbol,
      props.onDetachSymbol,
      props.onInsertSymbol,
      props.onDeleteSymbol,
      props.onMediaUpload,
      props.onGenerateMediaWithAI,
      project,
      selection,
      insertQuery,
      insertCategory,
      mediaAssets,
      mediaFilter,
    ],
  );

  function renderInspector(
    _target:
      EditorShellContract['view']['inspectorTarget'],

    tab:
      EditorInspectorTab,
  ) {
    return (
      <BuilderInspectorFields
        fields={inspectorFields}
        group={tab}
        onChange={handleInspectorChange}
      />
    );
  }

  return (
    <WebsiteBuilderV2Shell
      shell={shell}

      brandSlot={
        props.brandSlot
      }

      topbarCenterSlot={
        props.topbarCenterSlot
      }

      topbarTrailingSlot={
        props.topbarTrailingSlot
      }

      canvas={
        props.canvas
      }

      canvasOverlaySlot={
        props.canvasOverlaySlot
      }

      renderLeftPanel={(
        panel: EditorLeftPanel,
      ) =>
        renderLeftPanel(panel)
      }

      renderInspector={
        renderInspector
      }
    />
  );
}
