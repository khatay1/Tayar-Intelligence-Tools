import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, CircleDot, MessageSquare, RefreshCw, Send, Trash2, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocalizer } from '@/lib/ui-localization';
import { supabase } from '@/lib/supabase';
import {
  createWebsiteProjectComment,
  deleteWebsiteProjectComment,
  heartbeatWebsiteProjectPresence,
  listWebsiteProjectComments,
  listWebsiteProjectPresence,
  resolveWebsiteProjectComment,
  type WebsiteCommentAnchor,
  type WebsiteProjectComment,
  type WebsiteProjectPresence,
} from '../services/websiteCollaborationService';

import { createLatestAsyncRequest } from '../core/latest-async-request';

type CommentMutation = ReturnType<typeof deleteWebsiteProjectComment>;

type Props = {
  projectId: string | null;
  canEdit: boolean;
  canManage: boolean;
  pageId: string;
  pageName: string;
  sectionId?: string | null;
  elementId?: string | null;
  darkMode: boolean;
  onNavigate: (anchor: WebsiteCommentAnchor) => void;
};

function messageOf(value: unknown) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'message' in value) return String(value.message || 'Unexpected error');
  return 'Unexpected error';
}

export function WebsiteCollaborationPanel(props: Props) {
  const { user } = useAuth();
  return <CollaborationSession key={`${props.projectId || ''}:${user?.id || ''}`} {...props} />;
}

function CollaborationSession({
  projectId,
  canEdit,
  canManage,
  pageId,
  pageName,
  sectionId,
  elementId,
  darkMode,
  onNavigate,
}: Props) {
  const l = useLocalizer();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<WebsiteProjectComment[]>([]);
  const [presence, setPresence] = useState<WebsiteProjectPresence[]>([]);
  const [draft, setDraft] = useState('');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const anchor = useMemo<WebsiteCommentAnchor>(() => ({
    pageId,
    pageName,
    ...(sectionId ? { sectionId } : {}),
    ...(elementId ? { elementId } : {}),
  }), [elementId, pageId, pageName, sectionId]);

  const mounted = useRef(false);
  const selection = useRef(anchor);
  selection.current = anchor;
  const [now, setNow] = useState(Date.now);
  const userId = user?.id;
  const displayName = String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Teammate').slice(0, 100);
  const commentsRequest = useMemo(() => createLatestAsyncRequest<Awaited<ReturnType<typeof listWebsiteProjectComments>>>(
    (result) => {
      if (result.error) setError(result.error.message);
      else { setComments((result.data || []) as WebsiteProjectComment[]); setError(''); }
    },
    (caught) => setError(messageOf(caught)),
  ), []);
  const presenceRequest = useMemo(() => createLatestAsyncRequest<Awaited<ReturnType<typeof listWebsiteProjectPresence>>>(
    (result) => { if (!result.error) setPresence((result.data || []) as WebsiteProjectPresence[]); },
    (caught) => setError(messageOf(caught)),
  ), []);
  const refreshComments = useCallback(() => projectId && userId
    ? commentsRequest.run(() => listWebsiteProjectComments(projectId, includeResolved))
    : Promise.resolve(), [commentsRequest, includeResolved, projectId, userId]);
  const refreshPresence = useCallback(() => projectId && userId
    ? presenceRequest.run(() => listWebsiteProjectPresence(projectId))
    : Promise.resolve(), [presenceRequest, projectId, userId]);
  const refresh = useCallback(() => Promise.all([refreshComments(), refreshPresence()]), [refreshComments, refreshPresence]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; commentsRequest.invalidate(); presenceRequest.invalidate(); };
  }, [commentsRequest, presenceRequest]);

  useEffect(() => {
    if (!projectId || !userId) return;
    let active = true;
    let inFlight = false;
    const heartbeat = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await heartbeatWebsiteProjectPresence({
          project_id: projectId, user_id: userId, display_name: displayName,
          page_id: selection.current.pageId || null, selection: selection.current,
          last_seen_at: new Date().toISOString(),
        });
        if (active && result.error) setError(result.error.message);
      } catch (caught) {
        if (active) setError(messageOf(caught));
      } finally { inFlight = false; }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 25_000);
    // Presence is shared across tabs: allow its lease to expire instead of
    // deleting another active tab's presence when this panel closes.
    return () => { active = false; window.clearInterval(timer); };
  }, [displayName, projectId, userId]);

  useEffect(() => {
    void refreshComments();
    return () => commentsRequest.invalidate();
  }, [commentsRequest, refreshComments]);

  useEffect(() => {
    if (!projectId || !userId) return;
    let active = true;
    void refreshPresence();
    const channel = supabase
      .channel(`website-collaboration:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_project_comments', filter: `project_id=eq.${projectId}` }, () => { if (active) void refreshComments(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'website_project_presence', filter: `project_id=eq.${projectId}` }, () => { if (active) void refreshPresence(); })
      .subscribe();
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => { active = false; window.clearInterval(timer); presenceRequest.invalidate(); void supabase.removeChannel(channel); };
  }, [presenceRequest, projectId, refreshComments, refreshPresence, userId]);

  async function addComment() {
    if (!projectId || !draft.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { error: createError } = await createWebsiteProjectComment(projectId, draft.trim(), anchor);
      if (createError) throw createError;
      if (!mounted.current) return;
      setDraft('');
      await refreshComments();
    } catch (caught) {
      if (mounted.current) setError(messageOf(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function mutateComment(request: () => CommentMutation) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await request();
      if (result.error) throw result.error;
      if (mounted.current) await refreshComments();
    } catch (caught) {
      if (mounted.current) setError(messageOf(caught));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function setResolved(comment: WebsiteProjectComment, resolved: boolean) {
    await mutateComment(() => resolveWebsiteProjectComment(comment.id, resolved));
  }

  async function removeComment(comment: WebsiteProjectComment) {
    if (!window.confirm(l('Delete this review comment?'))) return;
    await mutateComment(() => deleteWebsiteProjectComment(comment.id));
  }

  if (!projectId || !user) return null;
  const online = presence.filter((item) => now - Date.parse(item.last_seen_at) < 90_000);
  const unresolved = comments.filter((comment) => !comment.resolvedAt).length;
  const panel = darkMode ? 'border-white/10 bg-[#0b0f18] text-white' : 'border-gray-200 bg-white text-gray-900';
  const muted = darkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="fixed bottom-5 right-5 z-[230] flex flex-col items-end gap-2">
      {open && (
        <section className={`flex max-h-[min(680px,78vh)] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel}`} aria-label={l('Project collaboration')}>
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black"><Users className="h-4 w-4 text-violet-400" />{l('Collaboration')}</div>
              <div className={`mt-0.5 text-[10px] ${muted}`}>{online.length} {l('online')} · {unresolved} {l('open comments')}</div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void refresh()} className="rounded-lg p-2 text-gray-400 hover:bg-white/5" aria-label={l('Refresh')}><RefreshCw className="h-4 w-4" /></button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-white/5" aria-label={l('Close')}><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {online.map((item) => (
                <button key={item.user_id} type="button" onClick={() => onNavigate(item.selection || {})} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400" title={item.page_id || undefined}>
                  <CircleDot className="h-3 w-3" />{item.user_id === user.id ? l('You') : item.display_name}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-white/10 p-3">
            <p className={`mb-2 text-[10px] ${muted}`}>{l('Comment on')} {pageName}{sectionId ? ` · ${elementId ? l('selected element') : l('selected section')}` : ''}</p>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value.slice(0, 2000))} rows={3} placeholder={l('Write a review comment…')} className={`w-full resize-none rounded-xl border px-3 py-2 text-xs outline-none focus:border-violet-500 ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`} />
            <div className="mt-2 flex items-center justify-between">
              <label className={`flex items-center gap-2 text-[10px] ${muted}`}><input type="checkbox" checked={includeResolved} onChange={(event) => setIncludeResolved(event.target.checked)} />{l('Show resolved')}</label>
              <button type="button" disabled={busy || !draft.trim()} onClick={() => void addComment()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Send className="h-3.5 w-3.5" />{l('Comment')}</button>
            </div>
            {error && <p className="mt-2 text-[10px] text-rose-400">{l(error)}</p>}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {comments.map((comment) => (
              <article key={comment.id} className={`rounded-xl border p-3 ${comment.resolvedAt ? 'border-emerald-500/15 opacity-65' : darkMode ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onNavigate(comment.anchor || {})} className="min-w-0 text-left">
                    <p className="truncate text-[11px] font-bold">{comment.authorName}</p>
                    <p className={`text-[9px] ${muted}`}>{comment.anchor?.pageName || l('Website')} · {new Date(comment.createdAt).toLocaleString()}</p>
                  </button>
                  <div className="flex items-center gap-1">
                    {canEdit && <button type="button" disabled={busy} onClick={() => void setResolved(comment, !comment.resolvedAt)} className="rounded p-1 text-emerald-400" title={l(comment.resolvedAt ? 'Reopen' : 'Resolve')}><Check className="h-3.5 w-3.5" /></button>}
                    {(comment.userId === user.id || canManage) && <button type="button" disabled={busy} onClick={() => void removeComment(comment)} className="rounded p-1 text-rose-400" title={l('Delete')}><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">{comment.body}</p>
              </article>
            ))}
            {!comments.length && <p className={`py-8 text-center text-xs ${muted}`}>{l('No review comments yet.')}</p>}
          </div>
        </section>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} className="relative inline-flex h-12 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-black text-white shadow-xl shadow-violet-950/30 hover:bg-violet-500" aria-expanded={open} aria-label={l('Project collaboration')}>
        <MessageSquare className="h-5 w-5" />
        <span>{online.length}</span>
        {unresolved > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px]">{unresolved > 99 ? '99+' : unresolved}</span>}
      </button>
    </div>
  );
}
