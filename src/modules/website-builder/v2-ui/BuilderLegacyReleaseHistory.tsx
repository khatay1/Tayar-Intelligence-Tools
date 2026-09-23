import type { User } from '@supabase/supabase-js';
import type * as React from 'react';
import type { WebsitePublishVersion } from '../core/website-builder-model';

interface BuilderLegacyReleaseHistoryProps {
  cloudProjectId: string | null;
  createSharePreview: () => Promise<void>;
  currentAIEditableFingerprint: string;
  darkMode: boolean;
  deletePublishVersion: (version: WebsitePublishVersion) => Promise<void>;
  hasUnpublishedChanges: boolean;
  l: (text: string) => string;
  lastPublishedVersionId: string | null;
  previewBusy: boolean;
  previewCreatedAt: string | null;
  previewError: string;
  previewFingerprint: string;
  previewUrl: string;
  promoteSharePreviewToLive: () => Promise<void>;
  publishBusy: boolean;
  publishedUrl: string;
  publishVersions: WebsitePublishVersion[];
  publishVersionsError: string;
  publishVersionsLoading: boolean;
  refreshPublishVersions: (expectedProjectId?: string | null, expectedOwnerId?: string, expectedLoadSequence?: number) => Promise<void>;
  releaseDiffSummary: (version: WebsitePublishVersion) => string;
  releaseNote: string;
  restorePublishVersionToEditor: (version: WebsitePublishVersion) => void;
  revokeSharePreview: (updateBusy?: boolean) => Promise<void>;
  rollbackPublishVersion: (version: WebsitePublishVersion) => Promise<void>;
  setReleaseHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReleaseNote: React.Dispatch<React.SetStateAction<string>>;
  user: User | null;
}

export function BuilderLegacyReleaseHistory({
  cloudProjectId,
  createSharePreview,
  currentAIEditableFingerprint,
  darkMode,
  deletePublishVersion,
  hasUnpublishedChanges,
  l,
  lastPublishedVersionId,
  previewBusy,
  previewCreatedAt,
  previewError,
  previewFingerprint,
  previewUrl,
  promoteSharePreviewToLive,
  publishBusy,
  publishedUrl,
  publishVersions,
  publishVersionsError,
  publishVersionsLoading,
  refreshPublishVersions,
  releaseDiffSummary,
  releaseNote,
  restorePublishVersionToEditor,
  revokeSharePreview,
  rollbackPublishVersion,
  setReleaseHistoryOpen,
  setReleaseNote,
  user,
}: BuilderLegacyReleaseHistoryProps) {
  return (
<div className={`border-b px-4 py-3 ${darkMode ? 'border-indigo-500/20 bg-[#0b0d1d]' : 'border-indigo-200 bg-indigo-50/40'}`}>
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold">{l('Release Management')}</p>
                <p className="text-[10px] text-gray-500">{l('Immutable publish archives, live rollback and unlisted draft previews.')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => void refreshPublishVersions()} disabled={publishVersionsLoading} className="text-xs font-semibold text-indigo-400">{publishVersionsLoading ? 'Refreshing…' : 'Refresh'}</button>
                <button onClick={() => setReleaseHistoryOpen(false)} className="text-xs font-semibold text-violet-400">{l('Close')}</button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-indigo-400">{l('Next release')}</p>
                <textarea value={releaseNote} onChange={(e) => setReleaseNote(e.target.value.slice(0, 500))} rows={2} placeholder={l('Release note (optional): what changed?')} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-white/10 bg-black/20 text-white' : 'border-gray-200 bg-white'}`} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className={`rounded-full px-2 py-1 ${hasUnpublishedChanges ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{publishedUrl ? (hasUnpublishedChanges ? 'Unpublished changes' : 'Editor matches live release') : 'Not published yet'}</span>
                  {lastPublishedVersionId && <span className="text-gray-500">Release: {lastPublishedVersionId.slice(0, 8)}</span>}
                </div>
              </div>

              <div className={`rounded-xl border p-3 ${darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'}`}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-cyan-400">{l('Unlisted share preview')}</p>
                {previewUrl ? (
                  <>
                    <p className="truncate text-[10px] text-cyan-400">{previewUrl}</p>
                    <p className="mt-1 text-[9px] text-gray-500">{l('Anyone with this URL can open it. Tracking integrations are disabled in preview.')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')} className="text-xs font-semibold text-cyan-400">{l('Open')}</button>
                      <button onClick={() => void navigator.clipboard.writeText(previewUrl)} className="text-xs font-semibold text-sky-400">{l("Copy")}</button>
                      <button onClick={() => void promoteSharePreviewToLive()} disabled={publishBusy || previewBusy || previewFingerprint !== currentAIEditableFingerprint} className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">{publishBusy ? l('Promoting…') : l('Promote to live')}</button>
                      <button onClick={() => void createSharePreview()} disabled={previewBusy} className="text-xs font-semibold text-indigo-400">{l('Regenerate')}</button>
                      <button onClick={() => void revokeSharePreview()} disabled={previewBusy} className="text-xs font-semibold text-rose-400">{l('Revoke')}</button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => void createSharePreview()} disabled={previewBusy || !user || !cloudProjectId} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{previewBusy ? 'Creating…' : 'Create share preview'}</button>
                )}
                {previewCreatedAt && <p className="mt-2 text-[9px] text-gray-500">Created {new Date(previewCreatedAt).toLocaleString()}</p>}
                {previewFingerprint && previewFingerprint !== currentAIEditableFingerprint && <p className="mt-1 text-[9px] font-semibold text-amber-400">{l('Staging is behind the current editor. Regenerate it before promotion if these changes should go live.')}</p>}
                {previewError && <p className="mt-2 text-[10px] text-rose-400">{l(previewError)}</p>}
              </div>
            </div>

            {publishVersionsError && <p className="text-xs text-rose-400">{l(publishVersionsError)}</p>}
            {!publishVersionsLoading && !publishVersions.length ? (
              <div className={`rounded-lg border p-4 text-xs ${darkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-gray-200 bg-white text-gray-500'}`}>{l('No releases yet. Add an optional release note and click Publish.')}</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {publishVersions.map((version, index) => (
                  <article key={version.id} className={`rounded-xl border p-3 text-xs ${darkMode ? 'border-white/10 bg-white/[0.04]' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">Release {publishVersions.length - index}</p>
                        <p className="text-[9px] text-gray-500">{new Date(version.created_at).toLocaleString()}</p>
                      </div>
                      {version.id === lastPublishedVersionId && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-bold text-emerald-400">{l('LIVE REF')}</span>}
                    </div>
                    <p className={`mt-2 min-h-8 text-[10px] ${version.release_note ? (darkMode ? 'text-gray-300' : 'text-gray-700') : 'text-gray-500'}`}>{version.release_note || 'No release note.'}</p>
                    <p className="mt-2 text-[9px] text-indigo-400">Current vs release: {releaseDiffSummary(version)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => void rollbackPublishVersion(version)} disabled={publishBusy} className="font-semibold text-amber-400">{l('Rollback live')}</button>
                      <button onClick={() => restorePublishVersionToEditor(version)} className="font-semibold text-violet-400">{l('Restore editor')}</button>
                      <button onClick={() => void deletePublishVersion(version)} disabled={publishVersionsLoading || version.id === lastPublishedVersionId} className="font-semibold text-rose-400 disabled:opacity-30">{l('Delete archive')}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
  );
}
