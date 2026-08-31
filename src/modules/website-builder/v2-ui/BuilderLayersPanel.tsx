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
  const pages =
    shell.view.navigation;

  const page =
    pages.find(
      (candidate) =>
        candidate.selected,
    ) ||
    pages[0];

  if (!page) {
    return (
      <div className="tayar-v2-empty-panel">
        No page
      </div>
    );
  }

  return (
    <div className="tayar-v2-layers-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Layers</strong>
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
                    disabled={
                      sectionIndex === 0
                    }
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
                      sectionIndex ===
                      page.sections.length - 1
                    }
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
                    disabled={
                      page.sections.length <= 1
                    }
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
                    Containers
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
                              onClick={() =>
                                onUngroupContainer?.(
                                  section.id,
                                  container.id,
                                )
                              }
                            >
                              UNGROUP
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
                          <span title="Component">
                            ◆
                          </span>
                        )}
                      </button>

                      {element.selected && (
                        <div className="tayar-v2-direct-actions tayar-v2-direct-actions--element">
                          <button
                            type="button"
                            disabled={
                              elementIndex === 0
                            }
                            onClick={() =>
                              onMoveElement?.(
                                section.id,
                                element.id,
                                'up',
                              )
                            }
                          >
                            UP
                          </button>

                          <button
                            type="button"
                            disabled={
                              elementIndex ===
                              section.elements.length - 1
                            }
                            onClick={() =>
                              onMoveElement?.(
                                section.id,
                                element.id,
                                'down',
                              )
                            }
                          >
                            DN
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onDuplicateElement?.(
                                section.id,
                                element.id,
                              )
                            }
                          >
                            COPY
                          </button>

                          <button
                            type="button"
                            className="is-danger"
                            disabled={
                              section.elements.length <= 1
                            }
                            onClick={() =>
                              onDeleteElement?.(
                                section.id,
                                element.id,
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
              </div>

              {section.type === 'contact' && (
                <div className="tayar-v2-layer-group">
                  <div className="tayar-v2-layer-group__title tayar-v2-layer-group__title--actions">
                    <span>Form fields</span>
                    <button
                      type="button"
                      onClick={() => onResetForm?.(section.id)}
                    >
                      Reset
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
                            {formField.type}
                          </small>
                        </button>

                        {formField.selected && (
                          <div className="tayar-v2-direct-actions tayar-v2-direct-actions--element">
                            <button
                              type="button"
                              disabled={formFieldIndex === 0}
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
                                formFieldIndex ===
                                section.formFields.length - 1
                              }
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
                              disabled={section.formFields.length <= 1}
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
                        onClick={() => onAddFormField?.(section.id, type)}
                      >
                        + {type === 'tel' ? 'Phone' : type}
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
