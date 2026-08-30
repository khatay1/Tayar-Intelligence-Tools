import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

export interface BuilderLayersPanelProps {
  shell: EditorShellContract;
}

export function BuilderLayersPanel({
  shell,
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
        {page.sections.map((section) => (
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
                  pageId: page.id,
                  sectionId:
                    section.id,
                })
              }
            >
              <span>
                {section.label}
              </span>
            </button>

            <div className="tayar-v2-layer-elements">
              {section.elements.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  className="tayar-v2-layer-element"
                  aria-current={
                    element.selected
                      ? 'true'
                      : undefined
                  }
                  onClick={() =>
                    shell.actions.onSelect({
                      pageId: page.id,
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
                    <span
                      title="Component"
                    >
                      ◆
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
