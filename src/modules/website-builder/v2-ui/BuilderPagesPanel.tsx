import type { EditorShellContract } from '../core/editor-shell-contract';

export interface BuilderPagesPanelProps { shell: EditorShellContract }

export function BuilderPagesPanel({ shell }: BuilderPagesPanelProps) {
  const { navigation } = shell.view;
  return (
    <div className="tayar-v2-pages-panel">
      <div className="tayar-v2-panel-heading">
        <strong>Pages</strong>
        <span>{navigation.length}</span>
      </div>
      <div className="tayar-v2-page-list">
        {navigation.map((page) => (
          <button
            key={page.id}
            type="button"
            className="tayar-v2-page-row"
            aria-current={page.selected ? 'page' : undefined}
            onClick={() => shell.actions.onSelect({ pageId: page.id, sectionId: page.sections[0]?.id })}
          >
            <span className="tayar-v2-page-row__name">{page.label}</span>
            {page.home && <span className="tayar-v2-page-row__badge">Home</span>}
            <span className="tayar-v2-page-row__slug">{page.slug}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
