import type { ReactNode } from 'react';
import type { EditorShellContract } from '../core/editor-shell-contract';

export interface BuilderTopbarProps {
  shell: EditorShellContract;
  brandSlot?: ReactNode;
  centerSlot?: ReactNode;
  trailingSlot?: ReactNode;
}

export function BuilderTopbar({ shell, brandSlot, centerSlot, trailingSlot }: BuilderTopbarProps) {
  const { view, status, actions } = shell;
  return (
    <header className="tayar-v2-topbar" data-dirty={view.dirty ? 'true' : 'false'}>
      <div className="tayar-v2-topbar__brand">{brandSlot}</div>
      <div className="tayar-v2-topbar__history" aria-label="Editor history">
        <button type="button" onClick={actions.onUndo} disabled={!view.canUndo}>Undo</button>
        <button type="button" onClick={actions.onRedo} disabled={!view.canRedo}>Redo</button>
      </div>
      <div className="tayar-v2-topbar__center">{centerSlot}</div>
      <div className="tayar-v2-topbar__actions">
        <button type="button" onClick={actions.onPreview}>Preview</button>
        <button type="button" onClick={actions.onRunCheck} disabled={Boolean(status.checking)}>
          {status.checking
            ? 'Checking…'
            : typeof status.checkScore === 'number'
              ? `Check ${status.checkScore}`
              : 'Check'}
        </button>
        <button type="button" onClick={actions.onSave} disabled={Boolean(status.saving) || !view.dirty}>
          {status.saving ? 'Saving…' : view.dirty ? 'Save' : 'Saved'}
        </button>
        <button type="button" onClick={actions.onPublish} disabled={Boolean(status.publishing) || view.publish.blockers.length > 0}>
          {status.publishing ? 'Publishing…' : 'Publish'}
        </button>
        {trailingSlot}
      </div>
    </header>
  );
}
