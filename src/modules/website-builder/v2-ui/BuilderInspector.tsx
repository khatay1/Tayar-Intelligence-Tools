import type {
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
  const { view, actions } =
    shell;

  return (
    <aside
      className="tayar-v2-inspector"
      data-target={
        view.inspectorTarget.kind
      }
    >
      <div
        className="tayar-v2-inspector__tabs"
        role="tablist"
        aria-label="Inspector"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
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

      <div className="tayar-v2-inspector__body">
        {renderInspector(
          view.inspectorTarget,
          view.inspectorTab as EditorInspectorTab,
        )}
      </div>
    </aside>
  );
}
