import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

export interface BuilderStatusBarProps {
  shell: EditorShellContract;
}

export function BuilderStatusBar({
  shell,
}: BuilderStatusBarProps) {
  const { view, status } =
    shell;

  return (
    <footer className="tayar-v2-statusbar">
      {view.publish.blockers.length > 0 && (
        <span>
          {view.publish.blockers.length} issue
          {view.publish.blockers.length === 1
            ? ''
            : 's'}
        </span>
      )}

      <span>
        {status.saving
          ? 'Saving…'
          : view.dirty
            ? 'Unsaved'
            : 'Saved'}
      </span>
    </footer>
  );
}
