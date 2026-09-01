import type { EditorShellContract } from '../core/editor-shell-contract';

function formatTime(timestamp: number) {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export interface BuilderHistoryPanelProps {
  shell: EditorShellContract;
  onRestoreEntry?(entryId: string): void;
}

export function BuilderHistoryPanel({ shell, onRestoreEntry }: BuilderHistoryPanelProps) {
  const { history } = shell.view;
  return (
    <div className="tayar-v2-history-panel">
      <div className="tayar-v2-panel-heading">
        <strong>History</strong>
        <span>{history.total} changes</span>
      </div>
      <div className="tayar-v2-panel-actions">
        <button type="button" disabled={!shell.view.canUndo} onClick={shell.actions.onUndo}>Undo</button>
        <button type="button" disabled={!shell.view.canRedo} onClick={shell.actions.onRedo}>Redo</button>
      </div>
      <div className="tayar-v2-history-list">
        {history.undo.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className="tayar-v2-history-entry"
            data-current={index === 0 ? 'true' : 'false'}
            onClick={() => onRestoreEntry?.(entry.id)}
            disabled={!onRestoreEntry}
            title="Restore this editor state"
          >
            <span className="tayar-v2-history-entry__label">{entry.label}</span>
            <span className="tayar-v2-history-entry__meta">
              {entry.source} · {formatTime(entry.createdAt)} · Restore
            </span>
          </button>
        ))}
        {!history.undo.length && <div className="tayar-v2-empty-panel">No changes yet.</div>}
        {history.redo.length > 0 && (
          <div className="tayar-v2-history-redo">
            <small>Redo queue</small>
            {history.redo.map((entry) => (
              <div key={entry.id} className="tayar-v2-history-entry" data-redo="true">
                <span className="tayar-v2-history-entry__label">{entry.label}</span>
                <span className="tayar-v2-history-entry__meta">{entry.source}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
