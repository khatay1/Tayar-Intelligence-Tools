import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

export interface BuilderPagesPanelProps {
  shell: EditorShellContract;

  onAddPage?(): void;

  onMovePage?(
    pageId: string,
    direction: 'up' | 'down',
  ): void;

  onDuplicatePage?(): void;

  onDeletePage?(): void;

  onSetHomePage?(): void;
}

export function BuilderPagesPanel({
  shell,
  onAddPage,
  onMovePage,
  onDuplicatePage,
  onDeletePage,
  onSetHomePage,
}: BuilderPagesPanelProps) {
  const { navigation } =
    shell.view;

  return (
    <div className="tayar-v2-pages-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Pages</strong>

        <button
          type="button"
          className="tayar-v2-mini-action"
          onClick={onAddPage}
          title="Add page"
        >
          +
        </button>
      </div>

      <div className="tayar-v2-page-list">
        {navigation.map(
          (page, index) => (
            <div
              key={page.id}
              className="tayar-v2-page-item"
              data-selected={
                page.selected
                  ? 'true'
                  : 'false'
              }
            >
              <button
                type="button"
                className="tayar-v2-page-row"
                title={page.slug}
                aria-current={
                  page.selected
                    ? 'page'
                    : undefined
                }
                onClick={() =>
                  shell.actions.onSelect({
                    pageId:
                      page.id,

                    sectionId:
                      page.sections[0]
                        ?.id,
                  })
                }
              >
                <span className="tayar-v2-page-row__name">
                  {page.label}
                </span>

                {page.home && (
                  <span className="tayar-v2-page-row__badge">
                    Home
                  </span>
                )}
              </button>

              {page.selected && (
                <div className="tayar-v2-direct-actions">
                  <button
                    type="button"
                    disabled={index === 0}
                    title="Move page up"
                    onClick={() =>
                      onMovePage?.(
                        page.id,
                        'up',
                      )
                    }
                  >
                    UP
                  </button>

                  <button
                    type="button"
                    disabled={
                      index ===
                      navigation.length - 1
                    }
                    title="Move page down"
                    onClick={() =>
                      onMovePage?.(
                        page.id,
                        'down',
                      )
                    }
                  >
                    DN
                  </button>

                  <button
                    type="button"
                    title="Duplicate page"
                    onClick={
                      onDuplicatePage
                    }
                  >
                    COPY
                  </button>

                  {!page.home && (
                    <button
                      type="button"
                      title="Set as home page"
                      onClick={
                        onSetHomePage
                      }
                    >
                      HOME
                    </button>
                  )}

                  <button
                    type="button"
                    className="is-danger"
                    disabled={
                      navigation.length <= 1
                    }
                    title="Delete page"
                    onClick={
                      onDeletePage
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
    </div>
  );
}
