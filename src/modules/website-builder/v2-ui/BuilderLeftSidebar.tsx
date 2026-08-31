import type { KeyboardEvent, ReactNode } from 'react';
import {
  Sparkles,
  FileText,
  Layers,
  Plus,
  Image as ImageIcon,
  Boxes,
  Palette,
  Settings2,
  History,
} from 'lucide-react';

import {
  EDITOR_LEFT_PANEL_REGISTRY,
  type EditorShellContract,
} from '../core/editor-shell-contract';

import type {
  EditorLeftPanel,
} from '../core/editor-layout';

import {
  resolveEditorSidebarKey,
} from '../core/editor-sidebar-navigation';

export interface BuilderLeftSidebarProps {
  shell: EditorShellContract;
  renderPanel(panel: EditorLeftPanel): ReactNode;
}

const ICONS = {
  ai: Sparkles,
  pages: FileText,
  layers: Layers,
  insert: Plus,
  media: ImageIcon,
  components: Boxes,
  site: Palette,
  settings: Settings2,
  history: History,
};

export function BuilderLeftSidebar({
  shell,
  renderPanel,
}: BuilderLeftSidebarProps) {
  const { view, actions } = shell;

  const onRailKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const next = resolveEditorSidebarKey(
      view.leftPanel as EditorLeftPanel,
      event.key,
    );

    if (!next) return;

    event.preventDefault?.();
    actions.onOpenLeftPanel(next);

    const target =
      event.currentTarget.querySelector<HTMLButtonElement>(
        `[data-panel-id="${next}"]`,
      );

    target?.focus();
  };

  return (
    <aside
      className="tayar-v2-left-sidebar"
      data-open={view.focusMode ? 'false' : 'true'}
    >
      <nav
        className="tayar-v2-left-sidebar__rail"
        aria-label="Builder tools"
        onKeyDown={onRailKeyDown}
      >
        {EDITOR_LEFT_PANEL_REGISTRY.map((item) => {
          const Icon =
            ICONS[item.id as EditorLeftPanel];

          return (
            <button
              key={item.id}
              type="button"
              data-panel-id={item.id}
              aria-label={item.label}
              aria-pressed={view.leftPanel === item.id}
              title={item.label}
              onClick={() =>
                actions.onOpenLeftPanel(
                  item.id as EditorLeftPanel,
                )
              }
            >
              <Icon size={18} />
            </button>
          );
        })}
      </nav>

      <section
        className="tayar-v2-left-sidebar__panel"
        data-panel={view.leftPanel}
      >
        {renderPanel(
          view.leftPanel as EditorLeftPanel,
        )}
      </section>
    </aside>
  );
}
