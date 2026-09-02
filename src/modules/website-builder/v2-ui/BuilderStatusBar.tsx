import { useLocalizer } from '@/lib/ui-localization';
﻿import type {
  EditorShellContract,
} from '../core/editor-shell-contract';

export interface BuilderStatusBarProps {
  shell: EditorShellContract;
}

export function BuilderStatusBar({
shell,
}: BuilderStatusBarProps) {
  const l = useLocalizer();
  const { view, status } =
    shell;

  return (
    <footer className="tayar-v2-statusbar">
      <div className="tayar-v2-statusbar__left">
        {status.publishedUrl ? (
          <a
            href={status.publishedUrl}
            target="_blank"
            rel="noreferrer"
            className="tayar-v2-statusbar__live"
            data-state={status.liveVerification || 'idle'}
            title={status.publishedUrl}
          >
            <strong>
              {status.liveVerification === 'checking'
                ? 'VERIFYING'
                : status.liveVerification === 'failed'
                  ? 'CHECK FAILED'
                  : status.liveVerification === 'healthy'
                    ? 'LIVE'
                    : 'PUBLISHED'}
            </strong>
            <span>
              {status.publishedOutdated
                ? 'Saved changes need republish · Open site ↗'
                : 'Up to date · Open site ↗'}
            </span>
          </a>
        ) : (
          <span className="tayar-v2-statusbar__draft">{l('DRAFT')}<span>
        )}

        {typeof status.checkScore === 'number' && (
          <span
            className="tayar-v2-statusbar__check"
            data-errors={status.checkErrors ? 'true' : 'false'}
          >
            Check {status.checkScore}/100
            {status.checkErrors ? ` · ${status.checkErrors} critical` : ''}
            {status.checkWarnings ? ` · ${status.checkWarnings} warnings` : ''}
          </span>
        )}
      </div>

      <div className="tayar-v2-statusbar__right">
        {(status.publishError || status.saveError) && (
          <span
            className="tayar-v2-statusbar__error"
            title={status.publishError || status.saveError}
          >
            {status.publishError || status.saveError}
          </span>
        )}

        {view.publish.blockers.length > 0 && (
          <span>
            {view.publish.blockers.length} issue
            {view.publish.blockers.length === 1 ? '' : 's'}
          </span>
        )}

        <span data-publish-outdated={status.publishedOutdated ? 'true' : 'false'}>
          {status.saving
            ? 'Saving…'
            : view.dirty
              ? 'Unsaved'
              : status.publishedOutdated
                ? 'Saved · Not live yet'
                : status.publishedUrl
                  ? 'Saved · Live'
                  : 'Saved'}
        </span>
      </div>
    </footer>
  );
}
