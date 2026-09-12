import type { ReactNode } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import type { EditorShellContract } from '../core/editor-shell-contract';

export interface BuilderTopbarProps {
  shell: EditorShellContract;
  brandSlot?: ReactNode;
  centerSlot?: ReactNode;
  trailingSlot?: ReactNode;
}

export function BuilderTopbar({ shell, brandSlot, centerSlot, trailingSlot }: BuilderTopbarProps) {
  const l = useLocalizer();
  const { view, status, actions } = shell;
  const operationBusy = Boolean(status.saving || status.publishing || status.checking);
  const operation = status.publishing ? 'publishing' : status.saving ? 'saving' : status.checking ? 'checking' : 'idle';
  return (
    <header
      className="tayar-v2-topbar"
      data-dirty={view.dirty ? 'true' : 'false'}
      data-operation={operation}
      aria-busy={operationBusy}
    >
      <div className="tayar-v2-topbar__brand">{brandSlot}</div>
      <div className="tayar-v2-desktop-workflow" role="group" aria-label={l('Builder tools')}>
        <button
          type="button"
          aria-pressed={!view.focusMode && view.leftSidebarOpen && view.leftPanel === 'ai'}
          onClick={() => {
            if (view.focusMode) actions.onToggleFocus();
            actions.onOpenLeftPanel('ai');
          }}
        >{l('Tayar AI')}</button>
        <button
          type="button"
          aria-pressed={!view.focusMode && view.leftSidebarOpen && view.leftPanel !== 'ai'}
          onClick={() => {
            if (view.focusMode) actions.onToggleFocus();
            actions.onOpenLeftPanel('layers');
            if (!view.inspectorOpen) actions.onToggleInspector();
          }}
        >{l('Edit')}</button>
      </div>
      <div className="tayar-v2-topbar__mobile-panels" aria-label={l('Builder tools')}>
        <button
          type="button"
          className="tayar-v2-mobile-panel-button"
          aria-pressed={!view.focusMode && view.leftSidebarOpen}
          onClick={() => {
            if (view.focusMode) actions.onToggleFocus();
            if (view.inspectorOpen) actions.onToggleInspector();
            if (view.focusMode && view.leftSidebarOpen) return;
            actions.onToggleLeftSidebar();
          }}
        >
          {l('Tools')}
        </button>
        <button
          type="button"
          className="tayar-v2-mobile-panel-button"
          aria-pressed={!view.focusMode && view.inspectorOpen}
          onClick={() => {
            if (view.focusMode) actions.onToggleFocus();
            if (view.leftSidebarOpen) actions.onToggleLeftSidebar();
            if (view.focusMode && view.inspectorOpen) return;
            actions.onToggleInspector();
          }}
        >
          {l('Edit')}
        </button>
      </div>
      <div className="tayar-v2-topbar__history" aria-label={l('Editor history')}>
        <button type="button" onClick={actions.onUndo} disabled={operationBusy || !view.canUndo}>{l('Undo')}</button>
        <button type="button" onClick={actions.onRedo} disabled={operationBusy || !view.canRedo}>{l('Redo')}</button>
      </div>
      <div className="tayar-v2-topbar__center">{centerSlot}</div>
      <div className="tayar-v2-topbar__actions">
        <button type="button" className="tayar-v2-preview-button" onClick={actions.onPreview} disabled={operationBusy}>{l('Preview')}</button>
        <button type="button" className="tayar-v2-check-button" onClick={actions.onRunCheck} disabled={operationBusy}>
          {status.checking
            ? l('Checking…')
            : typeof status.checkScore === 'number'
              ? `${l('Check')} ${status.checkScore}`
               : l('Check')}
        </button>
        <button type="button" className="tayar-v2-save-button" onClick={actions.onSave} disabled={operationBusy || !view.dirty}>
          {status.saving ? l('Saving…') : view.dirty ? l('Save') : l('Saved')}
        </button>
        <button type="button" className="tayar-v2-publish-button" onClick={actions.onPublish} disabled={operationBusy || view.publish.blockers.length > 0}>
          {status.publishing
            ? l('Publishing…')
            : status.publishedUrl && status.publishedOutdated
              ? l('Republish')
              : status.publishedUrl
                ? l('Publish again')
                : l('Publish')}
        </button>
        {trailingSlot}
      </div>
    </header>
  );
}
