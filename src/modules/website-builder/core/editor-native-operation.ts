import type { EditorCommand } from './editor-command';
import {
  commandAddContainer,
  commandDuplicateElement,
  commandDuplicatePage,
  commandDuplicateSection,
  commandAddElement,
  commandAddFormField,
  commandAddPage,
  commandAddSection,
  commandAssignElementContainer,
  commandMoveElement,
  commandMoveFormField,
  commandMovePage,
  commandMoveSection,
  commandRemoveContainer,
  commandRemoveElement,
  commandRemoveFormField,
  commandRemovePage,
  commandRemoveSection,
  commandSetHomePage,
  commandUpdateContainer,
  commandUpdateElement,
  commandUpdateFormField,
  commandUpdateHeader,
  commandUpdatePage,
  commandUpdateSection,
  commandUpdateSeo,
  commandUpdateTheme,
  type EditorCommandAdapterOptions,
  type EditorInsertPosition,
} from './editor-command-adapters';
import {
  commandCreateSymbol,
  commandDetachSymbol,
  commandInsertSymbol,
} from './editor-symbol-commands';
import {
  commandCopyElementStyle,
  commandCopySectionStyle,
  commandRepairAccessibility,
  commandRepairResponsive,
  commandRestyleSite,
} from './editor-design-commands';
import type {
  EditorElementLike,
  EditorPageLike,
  EditorProjectLike,
  EditorSectionLike,
} from './editor-model';

export type EditorNativeOperationAction =
  | 'add_page'
  | 'duplicate_page'
  | 'update_page'
  | 'remove_page'
  | 'move_page'
  | 'set_home_page'
  | 'add_section'
  | 'duplicate_section'
  | 'update_section'
  | 'remove_section'
  | 'move_section'
  | 'add_element'
  | 'duplicate_element'
  | 'update_element'
  | 'remove_element'
  | 'move_element'
  | 'add_container'
  | 'update_container'
  | 'remove_container'
  | 'assign_element_container'
  | 'add_form_field'
  | 'update_form_field'
  | 'remove_form_field'
  | 'move_form_field'
  | 'create_symbol'
  | 'insert_symbol'
  | 'detach_symbol'
  | 'copy_element_style'
  | 'copy_section_style'
  | 'repair_responsive'
  | 'repair_accessibility'
  | 'restyle_site'
  | 'update_theme'
  | 'update_seo'
  | 'update_header';

export interface EditorNativeOperation {
  action: EditorNativeOperationAction;
  source?: 'manual' | 'ai' | 'system';
  pageId?: string;
  sectionId?: string;
  elementId?: string;
  containerId?: string;
  formFieldId?: string;
  symbolId?: string;
  symbolName?: string;
  sourceElementId?: string;
  sourceSectionId?: string;
  page?: EditorPageLike;
  section?: EditorSectionLike;
  element?: EditorElementLike;
  container?: { id: string; [key: string]: unknown };
  formField?: { id: string; [key: string]: unknown };
  changes?: Record<string, unknown>;
  position?: EditorInsertPosition;
}

export interface AdaptNativeOperationResult<P> {
  ok: boolean;
  command?: EditorCommand<P>;
  error?: string;
}

function requireText(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required for this operation`);
  if (normalized !== value) throw new Error(`${label} cannot contain surrounding whitespace`);
  return normalized;
}

function adapterOptions(operation: EditorNativeOperation, index: number): EditorCommandAdapterOptions {
  return {
    source: operation.source || 'ai',
    id: `native-${operation.action}-${index}`,
  };
}

export function adaptEditorNativeOperation<P extends EditorProjectLike>(
  operation: EditorNativeOperation,
  index = 0,
): AdaptNativeOperationResult<P> {
  const options = adapterOptions(operation, index);
  try {
    switch (operation.action) {
      case 'add_page':
        if (!operation.page) throw new Error('page is required for add_page');
        return { ok: true, command: commandAddPage<P>(operation.page, operation.position, options) };
      case 'duplicate_page':
        return { ok: true, command: commandDuplicatePage<P>(requireText(operation.pageId, 'pageId'), operation.changes || {}, operation.position, options) };
      case 'update_page':
        return { ok: true, command: commandUpdatePage<P>(requireText(operation.pageId, 'pageId'), operation.changes || {}, options) };
      case 'remove_page':
        return { ok: true, command: commandRemovePage<P>(requireText(operation.pageId, 'pageId'), options) };
      case 'move_page':
        return { ok: true, command: commandMovePage<P>(requireText(operation.pageId, 'pageId'), operation.position || {}, options) };
      case 'set_home_page':
        return { ok: true, command: commandSetHomePage<P>(requireText(operation.pageId, 'pageId'), options) };
      case 'add_section':
        if (!operation.section) throw new Error('section is required for add_section');
        return { ok: true, command: commandAddSection<P>(requireText(operation.pageId, 'pageId'), operation.section, operation.position, options) };
      case 'duplicate_section':
        return { ok: true, command: commandDuplicateSection<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), operation.changes || {}, operation.position, options) };
      case 'update_section':
        return { ok: true, command: commandUpdateSection<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), operation.changes || {}, options) };
      case 'remove_section':
        return { ok: true, command: commandRemoveSection<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), options) };
      case 'move_section':
        return { ok: true, command: commandMoveSection<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), operation.position || {}, options) };
      case 'add_element':
        if (!operation.element) throw new Error('element is required for add_element');
        return { ok: true, command: commandAddElement<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), operation.element, operation.position, options) };
      case 'duplicate_element':
        return { ok: true, command: commandDuplicateElement<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.elementId, 'elementId'), operation.changes || {}, operation.position, options) };
      case 'update_element':
        return { ok: true, command: commandUpdateElement<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.elementId, 'elementId'), operation.changes || {}, options) };
      case 'remove_element':
        return { ok: true, command: commandRemoveElement<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.elementId, 'elementId'), options) };
      case 'move_element':
        return { ok: true, command: commandMoveElement<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.elementId, 'elementId'), operation.position || {}, options) };
      case 'add_container':
        if (!operation.container) throw new Error('container is required for add_container');
        return { ok: true, command: commandAddContainer<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), operation.container, options) };
      case 'update_container':
        return { ok: true, command: commandUpdateContainer<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.containerId, 'containerId'), operation.changes || {}, options) };
      case 'remove_container':
        return { ok: true, command: commandRemoveContainer<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.containerId, 'containerId'), options) };
      case 'assign_element_container':
        return { ok: true, command: commandAssignElementContainer<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.elementId, 'elementId'), operation.containerId, options) };
      case 'add_form_field':
        if (!operation.formField) throw new Error('formField is required for add_form_field');
        return { ok: true, command: commandAddFormField<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), operation.formField, operation.position, options) };
      case 'update_form_field':
        return { ok: true, command: commandUpdateFormField<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.formFieldId, 'formFieldId'), operation.changes || {}, options) };
      case 'remove_form_field':
        return { ok: true, command: commandRemoveFormField<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.formFieldId, 'formFieldId'), options) };
      case 'move_form_field':
        return { ok: true, command: commandMoveFormField<P>(requireText(operation.pageId, 'pageId'), requireText(operation.sectionId, 'sectionId'), requireText(operation.formFieldId, 'formFieldId'), operation.position || {}, options) };
      case 'create_symbol':
        return { ok: true, command: commandCreateSymbol<P>(
          requireText(operation.pageId, 'pageId'),
          requireText(operation.sectionId, 'sectionId'),
          requireText(operation.elementId, 'elementId'),
          { symbolId: operation.symbolId, name: operation.symbolName },
          options,
        ) };
      case 'insert_symbol':
        return { ok: true, command: commandInsertSymbol<P>(
          requireText(operation.pageId, 'pageId'),
          requireText(operation.sectionId, 'sectionId'),
          requireText(operation.symbolId, 'symbolId'),
          operation.position || {},
          options,
        ) };
      case 'detach_symbol':
        return { ok: true, command: commandDetachSymbol<P>(
          requireText(operation.pageId, 'pageId'),
          requireText(operation.sectionId, 'sectionId'),
          requireText(operation.elementId, 'elementId'),
          options,
        ) };
      case 'copy_element_style':
        return { ok: true, command: commandCopyElementStyle<P>(
          requireText(operation.sourceElementId, 'sourceElementId'),
          requireText(operation.pageId, 'pageId'),
          requireText(operation.sectionId, 'sectionId'),
          requireText(operation.elementId, 'elementId'),
          options,
        ) };
      case 'copy_section_style':
        return { ok: true, command: commandCopySectionStyle<P>(
          requireText(operation.sourceSectionId, 'sourceSectionId'),
          requireText(operation.pageId, 'pageId'),
          requireText(operation.sectionId, 'sectionId'),
          options,
        ) };
      case 'repair_responsive':
        return { ok: true, command: commandRepairResponsive<P>(operation.pageId, options) };
      case 'repair_accessibility':
        return { ok: true, command: commandRepairAccessibility<P>(operation.pageId, options) };
      case 'restyle_site':
        return { ok: true, command: commandRestyleSite<P>(operation.changes || {}, options) };
      case 'update_theme':
        return { ok: true, command: commandUpdateTheme<P>(operation.changes || {}, options) };
      case 'update_seo':
        return { ok: true, command: commandUpdateSeo<P>(operation.changes || {}, options) };
      case 'update_header':
        return { ok: true, command: commandUpdateHeader<P>(operation.changes || {}, options) };
      default:
        return { ok: false, error: 'Unsupported native editor operation' };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Native editor operation could not be adapted',
    };
  }
}

export function adaptEditorNativeOperations<P extends EditorProjectLike>(
  operations: EditorNativeOperation[],
  maxOperations = 60,
) {
  const limit = Math.max(1, Math.min(200, Math.round(maxOperations)));
  const commands: EditorCommand<P>[] = [];
  const errors: string[] = [];

  operations.slice(0, limit).forEach((operation, index) => {
    const result = adaptEditorNativeOperation<P>(operation, index);
    if (result.ok && result.command) commands.push(result.command);
    else errors.push(`Operation ${index + 1} (${operation.action}): ${result.error || 'invalid'}`);
  });

  return {
    ok: errors.length === 0,
    commands,
    errors,
    truncated: operations.length > limit,
  };
}
