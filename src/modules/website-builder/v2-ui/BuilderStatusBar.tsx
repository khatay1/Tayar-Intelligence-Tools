import type { EditorShellContract } from '../core/editor-shell-contract';

export interface BuilderStatusBarProps { shell: EditorShellContract }

export function BuilderStatusBar({ shell }: BuilderStatusBarProps) {
  const { view, status } = shell;
  return (
    <footer className="tayar-v2-statusbar">
      <span>{view.counts.pages} pages</span>
      <span>{view.counts.sections} sections</span>
      <span>{view.counts.elements} elements</span>
      <span>Publish score: {view.publish.score}</span>
      {view.publish.blockers.length > 0 && <span>{view.publish.blockers.length} blockers</span>}
      {view.publish.warnings.length > 0 && <span>{view.publish.warnings.length} warnings</span>}
      <span>{status.saving ? 'Saving…' : view.dirty ? 'Unsaved changes' : 'All changes saved'}</span>
    </footer>
  );
}
