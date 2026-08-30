import type { ReactNode } from 'react';
import { EDITOR_LEFT_PANEL_REGISTRY, type EditorShellContract } from '../core/editor-shell-contract';
import type { EditorLeftPanel } from '../core/editor-layout';
import { resolveEditorSidebarKey } from '../core/editor-sidebar-navigation';

export interface BuilderLeftSidebarProps {
  shell: EditorShellContract;
  renderPanel(panel: EditorLeftPanel): ReactNode;
}

export function BuilderLeftSidebar({ shell, renderPanel }: BuilderLeftSidebarProps) {
  const { view, actions } = shell;

  const onRailKeyDown = (event: any) => {
    const next = resolveEditorSidebarKey(view.leftPanel as EditorLeftPanel, event.key);
    if (!next) return;
    event.preventDefault?.();
    actions.onOpenLeftPanel(next);
    const target = event.currentTarget?.querySelector?.(`[data-panel-id="${next}"]`);
    target?.focus?.();
  };

  return (
    <aside className="tayar-v2-left-sidebar" data-open={view.focusMode ? 'false' : 'true'}>
      <nav className="tayar-v2-left-sidebar__rail" aria-label="Website builder tools" onKeyDown={onRailKeyDown}>
        {EDITOR_LEFT_PANEL_REGISTRY.map((item) => (
          <button
            key={item.id}
            type="button"
            data-panel-id={item.id}
            aria-pressed={view.leftPanel === item.id}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            onClick={() => actions.onOpenLeftPanel(item.id as EditorLeftPanel)}
          >
            {item.compactLabel || item.label}
          </button>
        ))}
      </nav>
      <section className="tayar-v2-left-sidebar__panel" data-panel={view.leftPanel}>
        {renderPanel(view.leftPanel as EditorLeftPanel)}
      </section>
    </aside>
  );
}
