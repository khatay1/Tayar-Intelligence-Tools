import { useLocalizer } from '@/lib/ui-localization';
import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

export interface BuilderLayersPanelProps {
  shell: EditorShellContract;

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

export function BuilderLayersPanel({
  shell,
  onMoveSection,
  onDuplicateSection,
  onDeleteSection,
  onMoveElement,
  onDuplicateElement,
  onDeleteElement,
  onUngroupContainer,
  onAddFormField,
  onMoveFormField,
  onDeleteFormField,
  onResetForm,
}: BuilderLayersPanelProps) {
  const l = useLocalizer();
  const pages =
    shell.view.navigation;
  const mutationBusy = Boolean(
    shell.status.mutating || shell.status.saving || shell.status.publishing || shell.status.checking,
  );

  const page =
    pages.find(
      (candidate) =>
        candidate.selected,
    ) ||
    pages[0];

  if (!page) {
    return (
      <div className="tayar-v2-empty-panel">
        {l('No page')}
      </div>
    );
  }

  return (
    <div className="tayar-v2-layers-panel" aria-busy={mutationBusy}>
      <div className="tayar-v2-panel-heading">
        <strong>{l('Layers')}</strong>
      </div>

      <div className="tayar-v2-layer-tree">
        {page.sections.map(
          (section, sectionIndex) => (
            <section
              key={section.id}
              className="tayar-v2-layer-section"
              data-selected={
                section.selected
                  ? 'true'
                  : 'false'
              }
            >
              <button
                type="button"
                className="tayar-v2-layer-section__row"
                onClick={() =>
                  shell.actions.onSelect({
                    pageId:
                      page.id,

                    sectionId:
                      section.id,
                  })
                }
              >
                <span>
                  {section.label}
                </span>
              </button>

              {section.selected && (
                <div className="tayar-v2-direct-actions tayar-v2-direct-actions--section">
                  <button
                    type="button"
                    disabled={mutationBusy || !onMoveSection || sectionIndex === 0}
                    aria-label={l('Move up')}
                    title={l('Move up')}
                    onClick={() =>
                      onMoveSection?.(
                        section.id,
                        'up',
                      )
                    }
                  >
                    UP
                  </button>

                  <button
                    type="button"
                    disabled={
                      mutationBusy ||
                      !onMoveSection ||
                      sectionIndex === page.sections.length - 1
                    }
                    aria-label={l('Move down')}
                    title={l('Move down')}
                    onClick={() =>
                      onMoveSection?.(
                        section.id,
                        'down',
                      )
                    }
                  >
                    DN
                  </button>

                  <button
                    type="button"
                    disabled={mutationBusy || !onDuplicateSection}
                    aria-label={l('Copy')}
                    title={l('Copy')}
                    onClick={() =>
                      onDuplicateSection?.(
                        section.id,
                      )
                    }
                  >
                    COPY
                  </button>

                  <button
                    type="button"
                    className="is-danger"
                    disabled={mutationBusy || !onDeleteSection || page.sections.length <= 1}
                    aria-label={l('Delete')}
                    title={l('Delete')}
                    onClick={() =>
                      onDeleteSection?.(
                        section.id,
                      )
                    }
                  >
                    DEL
                  </button>
                </div>
              )}

              {section.containers.length > 0 && (
                <div className="tayar-v2-layer-group">
                  <div className="tayar-v2-layer-group__title">
                    {l('Containers')}
                  </div>

                  {section.containers.map(
                    (container) => (
                      <div
                        key={container.id}
                        className="tayar-v2-layer-element-wrap"
                        data-selected={
                          container.selected
                            ? 'true'
                            : 'false'
                        }
                      >
                        <button
                          type="button"
                          className="tayar-v2-layer-child tayar-v2-layer-child--container"
                          aria-current={
                            container.selected
                              ? 'true'
                              : undefined
                          }
                          onClick={() =>
                            shell.actions.onSelect({
                              pageId:
                                page.id,

                              sectionId:
                                section.id,

                              containerId:
                                container.id,
                            })
                          }
                        >
                          <span aria-hidden="true">
                            ▦
                          </span>

                          <span>
                            {container.label}
                          </span>
                        </button>

                        {container.selected && (
                          <div className="tayar-v2-direct-actions tayar-v2-direct-actions--element">
                            <button
                              type="button"
                              className="is-danger"
                              disabled={mutationBusy || !onUngroupContainer}
                              title={l('UNGROUP')}
                              onClick={() =>
                                onUngroupContainer?.(
                                  section.id,
                                  container.id,
                                )
                              }
                            >
                              {l('UNGROUP')}
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}

              <div className="tayar-v2-layer-elements">
                {section.elements.map(
                  (
                    element,
                    elementIndex,
                  ) => (
                    <div
                      key={element.id}
                      className="tayar-v2-layer-element-wrap"
                      data-selected={
                        element.selected
                          ? 'true'
                          : 'false'
                      }
                    >
                      <button
                        type="button"
                        className="tayar-v2-layer-element"
                        aria-current={
                          element.selected
                            ? 'true'
                            : undefined
                        }
                        onClick={() =>
                          shell.actions.onSelect({
                            pageId:
                              page.id,

                            sectionId:
                              section.id,

                            elementId:
                              element.id,
                          })
                        }
                      >
                        <span>
                          {element.label}
                        </span>

                        {element.symbolLinked && (
                          <span title={l('Component')}>
                            ◆
                          </span>
                        )}
                      </button>

                      {element.selected && (
                        <div className="tayar-v2-direct-actions tayar-v2-direct-actions--element">
                          <button
                            type="button"
                            disabled={mutationBusy || !onMoveElement || elementIndex === 0}
                            aria-label={l('Move up')}
                            title={l('Move up')}
                            onClick={() =>
                              onMoveElement?.(
                                section.id,
                                element.id,
                                'up',
                              )
                            }
                          >
                            {l('UP')}
                          </button>

                          <button
                            type="button"
                            disabled={
                              mutationBusy ||
                              !onMoveElement ||
                              elementIndex === section.elements.length - 1
                            }
                            aria-label={l('Move down')}
                            title={l('Move down')}
                            onClick={() =>
                              onMoveElement?.(
                                section.id,
                                element.id,
                                'down',
                              )
                            }
                          >
                            {l('DN')}
                          </button>

                          <button
                            type="button"
                            disabled={mutationBusy || !onDuplicateElement}
                            aria-label={l('Copy')}
                            title={l('Copy')}
                            onClick={() =>
                              onDuplicateElement?.(
                                section.id,
                                element.id,
                              )
                            }
                          >
                            {l('COPY')}
                          </button>

                          <button
                            type="button"
                            className="is-danger"
                            disabled={mutationBusy || !onDeleteElement || section.elements.length <= 1}
                            aria-label={l('Delete')}
                            title={l('Delete')}
                            onClick={() =>
                              onDeleteElement?.(
                                section.id,
                                element.id,
                              )
                            }
                          >
                            {l('DEL')}
                          </button>
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>

              {section.type === 'contact' && (
                <div className="tayar-v2-layer-group">
                  <div className="tayar-v2-layer-group__title tayar-v2-layer-group__title--actions">
                    <span>{l('Form fields')}</span>
                    <button
                      type="button"
                      disabled={mutationBusy || !onResetForm}
                      title={l('Reset')}
                      onClick={() => onResetForm?.(section.id)}
                    >
                      {l('Reset')}
                    </button>
                  </div>

                  {section.formFields.map(
                    (formField, formFieldIndex) => (
                      <div
                        key={formField.id}
                        className="tayar-v2-layer-element-wrap"
                        data-selected={
                          formField.selected
                            ? 'true'
                            : 'false'
                        }
                      >
                        <button
                          type="button"
                          className="tayar-v2-layer-child tayar-v2-layer-child--form"
                          aria-current={
                            formField.selected
                              ? 'true'
                              : undefined
                          }
                          onClick={() =>
                            shell.actions.onSelect({
                              pageId:
                                page.id,

                              sectionId:
                                section.id,

                              formFieldId:
                                formField.id,
                            })
                          }
                        >
                          <span aria-hidden="true">
                            ◫
                          </span>

                          <span>
                            {formField.label}
                          </span>

                          <small>
                            {l(formField.type)}
                          </small>
                        </button>

                        {formField.selected && (
                          <div className="tayar-v2-direct-actions tayar-v2-direct-actions--element">
                            <button
                              type="button"
                              disabled={mutationBusy || !onMoveFormField || formFieldIndex === 0}
                              aria-label={l('Move up')}
                              title={l('Move up')}
                              onClick={() =>
                                onMoveFormField?.(
                                  section.id,
                                  formField.id,
                                  'up',
                                )
                              }
                            >
                              UP
                            </button>
                            <button
                              type="button"
                              disabled={
                                mutationBusy ||
                                !onMoveFormField ||
                                formFieldIndex === section.formFields.length - 1
                              }
                              aria-label={l('Move down')}
                              title={l('Move down')}
                              onClick={() =>
                                onMoveFormField?.(
                                  section.id,
                                  formField.id,
                                  'down',
                                )
                              }
                            >
                              DN
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              disabled={mutationBusy || !onDeleteFormField || section.formFields.length <= 1}
                              aria-label={l('Delete')}
                              title={l('Delete')}
                              onClick={() =>
                                onDeleteFormField?.(
                                  section.id,
                                  formField.id,
                                )
                              }
                            >
                              DEL
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )}

                  <div className="tayar-v2-form-add-grid">
                    {(['text', 'email', 'tel', 'textarea', 'select', 'checkbox'] as const).map((type) => (
                      <button
                        type="button"
                        key={type}
                        disabled={mutationBusy || !onAddFormField}
                        onClick={() => onAddFormField?.(section.id, type)}
                      >
                        + {type === 'tel' ? l('Phone') : l(type)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ),
        )}
      </div>
    </div>
  );
}
