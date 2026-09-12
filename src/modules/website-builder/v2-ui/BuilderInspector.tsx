import { useLocalizer } from '@/lib/ui-localization';
import type {
  KeyboardEvent,
  ReactNode,
} from 'react';

import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

import type {
  EditorInspectorTab,
} from '../core/editor-layout';

const TABS: Array<{
  id: EditorInspectorTab;
  label: string;
}> = [
  {
    id: 'content',
    label: 'Content',
  },
  {
    id: 'design',
    label: 'Style',
  },
  {
    id: 'responsive',
    label: 'Device',
  },
  {
    id: 'settings',
    label: 'Settings',
  },
];

export interface BuilderInspectorProps {
  shell: EditorShellContract;

  renderInspector(
    target:
      EditorShellContract['view']['inspectorTarget'],
    tab:
      EditorInspectorTab,
  ): ReactNode;
}

export function BuilderInspector({
  shell,
  renderInspector,
}: BuilderInspectorProps) {
  const l = useLocalizer();
  const { view, actions } =
    shell;

  const onTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TABS.findIndex((tab) => tab.id === view.inspectorTab);
    const lastIndex = TABS.length - 1;
    const nextIndex =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (currentIndex + 1) % TABS.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (currentIndex - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? lastIndex
              : -1;

    if (nextIndex < 0) return;
    event.preventDefault();
    const next = TABS[nextIndex];
    actions.onOpenInspectorTab(next.id);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`[data-inspector-tab="${next.id}"]`)
      ?.focus();
  };

  return (
    <aside
      className="tayar-v2-inspector"
      aria-label={l('Inspector')}
      data-target={
        view.inspectorTarget.kind
      }
    >
      <div
        className="tayar-v2-inspector__tabs"
        role="tablist"
        aria-label={l('Inspector')}
        onKeyDown={onTabsKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tayar-v2-inspector-tab-${tab.id}`}
            data-inspector-tab={tab.id}
            aria-controls="tayar-v2-inspector-panel"
            tabIndex={view.inspectorTab === tab.id ? 0 : -1}
            aria-selected={
              view.inspectorTab ===
              tab.id
            }
            onClick={() =>
              actions.onOpenInspectorTab(
                tab.id,
              )
            }
          >
            {l(tab.label)}
          </button>
        ))}
      </div>

      <div
        className="tayar-v2-inspector__body"
        id="tayar-v2-inspector-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`tayar-v2-inspector-tab-${view.inspectorTab}`}
      >
        {renderInspector(
          view.inspectorTarget,
          view.inspectorTab as EditorInspectorTab,
        )}
      </div>
    </aside>
  );
}
