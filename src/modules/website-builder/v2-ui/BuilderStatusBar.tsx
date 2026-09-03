import { useLocalizer } from '@/lib/ui-localization';
import type {
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
                ? l('VERIFYING')
                : status.liveVerification === 'failed'
                  ? l('CHECK FAILED')
                  : status.liveVerification === 'healthy'
                    ? l('LIVE')
                    : l('PUBLISHED')}
            </strong>
            <span>
              {status.publishedOutdated
                ? l('Saved changes need republish · Open site ↗')
                : l('Up to date · Open site ↗')}
            </span>
          </a>
        ) : (
          <span className="tayar-v2-statusbar__draft">{l('DRAFT')}</span>
        )}

        {typeof status.checkScore === 'number' && (
          <span
            className="tayar-v2-statusbar__check"
            data-errors={status.checkErrors ? 'true' : 'false'}
          >
            {l('Check')} {status.checkScore}/100
            {status.checkErrors ? ` · ${status.checkErrors} ${l('critical')}` : ''}
            {status.checkWarnings ? ` · ${status.checkWarnings} ${l('warnings')}` : ''}
          </span>
        )}
      </div>

      <div className="tayar-v2-statusbar__right">
        {(status.publishError || status.saveError) && (
          <span
            className="tayar-v2-statusbar__error"
            title={l(status.publishError || status.saveError || '')}
          >
            {l(status.publishError || status.saveError || '')}
          </span>
        )}

        {view.publish.blockers.length > 0 && (
          <span>
            {view.publish.blockers.length} {view.publish.blockers.length === 1 ? l('issue') : l('issues')}
          </span>
        )}

        <span data-publish-outdated={status.publishedOutdated ? 'true' : 'false'}>
          {status.saving
            ? l('Saving…')
            : view.dirty
              ? l('Unsaved')
              : status.publishedOutdated
                ? l('Saved · Not live yet')
                : status.publishedUrl
                  ? l('Saved · Live')
                  : l('Saved')}
        </span>
      </div>
    </footer>
  );
}
