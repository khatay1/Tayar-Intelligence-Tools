import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, Bot, CheckCircle2, Clock3, Inbox, Loader2, MessageCircle, MessagesSquare,
  RefreshCw, Send, Settings2, ShieldCheck, UserRound, WifiOff,
} from 'lucide-react';
import { useLocalizer } from '@/lib/ui-localization';
import { ToolShell } from '../shared/ToolShell';
import {
  SOCIAL_PROVIDERS, type ConversationPriority, type ConversationStatus, type SocialConversationSummary,
  type SocialAutomation, type SocialConversationThread, type SocialHubOverview, type SocialProvider, type SocialWorkspace,
} from './social-hub-model';
import {
  ensureSocialHub, generateSocialAiDraft, getSocialConversation, getSocialHubOverview, listSocialAutomations, listSocialConversations,
  listSocialWorkspaces, queueSocialReply, resolveSocialHub, reviewSocialAiDraft, saveSocialAutomation, updateSocialConversation,
} from './social-hub-service';

type Panel = 'inbox' | 'channels' | 'automation';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Social Hub request failed.';
}

function providerLabel(provider: SocialProvider) {
  return SOCIAL_PROVIDERS.find(item => item.id === provider)?.label ?? provider;
}

export default function SocialHubTool({ darkMode: _darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const [workspaces, setWorkspaces] = useState<SocialWorkspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [hubId, setHubId] = useState<string | null>(null);
  const [overview, setOverview] = useState<SocialHubOverview | null>(null);
  const [conversations, setConversations] = useState<SocialConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<SocialConversationThread | null>(null);
  const [panel, setPanel] = useState<Panel>('inbox');
  const [status, setStatus] = useState<ConversationStatus | 'all'>('open');
  const [provider, setProvider] = useState<SocialProvider | 'all'>('all');
  const [reply, setReply] = useState('');
  const [aiDraft, setAiDraft] = useState<{ id: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const workspace = useMemo(() => workspaces.find(item => item.id === workspaceId) ?? null, [workspaces, workspaceId]);
  const canEdit = workspace?.my_role !== 'viewer';
  const canManage = workspace?.my_role === 'owner' || workspace?.my_role === 'admin';

  const loadHub = useCallback(async (nextHubId: string) => {
    const [nextOverview, nextConversations] = await Promise.all([
      getSocialHubOverview(nextHubId),
      listSocialConversations({ hubId: nextHubId, status: status === 'all' ? null : status, provider: provider === 'all' ? null : provider }),
    ]);
    setOverview(nextOverview);
    setConversations(nextConversations);
    const nextSelected = nextConversations[0]?.id ?? null;
    setSelectedId(nextSelected);
    if (nextSelected) setThread(await getSocialConversation(nextHubId, nextSelected));
    else setThread(null);
  }, [provider, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSocialWorkspaces().then(rows => {
      if (cancelled) return;
      setWorkspaces(rows);
      const first = rows[0]?.id ?? '';
      if (first) setWorkspaceId(first);
    }).catch(caught => !cancelled && setError(messageOf(caught))).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHubId(null); setOverview(null); setConversations([]); setThread(null); setSelectedId(null); setError('');
    if (!workspaceId) return () => { cancelled = true; };
    resolveSocialHub(workspaceId).then(resolved => { if (!cancelled) setHubId(resolved); })
      .catch(caught => !cancelled && setError(messageOf(caught)));
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    if (!hubId) return;
    void loadHub(hubId).catch(caught => setError(messageOf(caught)));
  }, [hubId, status, provider, loadHub]);

  async function createHub() {
    if (!workspaceId || !canManage) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await ensureSocialHub(workspaceId);
      setHubId(created);
      await loadHub(created);
      setNotice(l('Social Hub created for this workspace.'));
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  async function openConversation(id: string) {
    if (!hubId) return;
    setSelectedId(id); setBusy(true); setError(''); setReply(''); setAiDraft(null);
    try {
      setThread(await getSocialConversation(hubId, id));
      setConversations(current => current.map(item => item.id === id ? { ...item, unreadCount: 0 } : item));
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  async function sendReply() {
    const body = reply.trim();
    if (!hubId || !selectedId || !body || !canEdit || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (aiDraft) await reviewSocialAiDraft(hubId, aiDraft.id, true, crypto.randomUUID());
      else await queueSocialReply(hubId, selectedId, body, crypto.randomUUID());
      setReply('');
      setAiDraft(null);
      setThread(await getSocialConversation(hubId, selectedId));
      setNotice(l('Reply queued for secure delivery.'));
      await loadHub(hubId);
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  async function draftReply() {
    if (!hubId || !thread || !canEdit || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const draft = await generateSocialAiDraft(hubId, thread);
      setAiDraft(draft); setReply(draft.body);
      setNotice(l('AI draft created. Review it before approving delivery.'));
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  async function discardAiDraft(keepText: boolean) {
    if (!hubId || !aiDraft || busy) return;
    setBusy(true); setError('');
    try {
      await reviewSocialAiDraft(hubId, aiDraft.id, false);
      setAiDraft(null);
      if (!keepText) setReply('');
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  async function changeConversation(nextStatus: ConversationStatus, nextPriority: ConversationPriority) {
    if (!hubId || !selectedId || !canEdit) return;
    setBusy(true); setError('');
    try {
      await updateSocialConversation(hubId, selectedId, nextStatus, nextPriority);
      setThread(current => current ? { ...current, conversation: { ...current.conversation, status: nextStatus, priority: nextPriority } } : current);
      await loadHub(hubId);
    } catch (caught) { setError(messageOf(caught)); }
    finally { setBusy(false); }
  }

  return (
    <ToolShell icon={MessagesSquare} title={l('Social Hub')} description={l('One secure inbox for WhatsApp Business, Telegram, Facebook Messenger and Instagram.')} badge="v1.0">
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="min-w-64 flex-1 text-xs font-semibold text-gray-400">
              {l('Team workspace')}
              <select value={workspaceId} onChange={event => setWorkspaceId(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-[#11111d] px-3 py-2.5 text-sm text-white">
                <option value="">{l('Select a workspace')}</option>
                {workspaces.map(item => <option key={item.id} value={item.id}>{item.name} · {item.my_role}</option>)}
              </select>
            </label>
            {hubId && <button type="button" onClick={() => void loadHub(hubId)} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/5 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{l('Refresh')}</button>}
          </div>
        </section>

        {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{l(error)}</div>}
        {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

        {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-violet-400" /></div>
          : !workspaces.length ? <Empty icon={ShieldCheck} title={l('A team workspace is required')} text={l('Create a Team Workspace first so conversations, permissions and customer data remain isolated.')} />
            : !hubId ? <Empty icon={MessagesSquare} title={l('Social Hub is not initialized')} text={canManage ? l('Create the isolated inbox for this workspace. Account connections stay deferred to the final activation step.') : l('Ask a workspace owner or admin to initialize Social Hub.')} action={canManage ? <button type="button" onClick={() => void createHub()} disabled={busy} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{busy ? l('Creating…') : l('Create Social Hub')}</button> : undefined} />
              : <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Metric label={l('Open conversations')} value={overview?.counts.open ?? 0} icon={Inbox} />
                  <Metric label={l('Unread messages')} value={overview?.counts.unread ?? 0} icon={MessageCircle} />
                  <Metric label={l('AI drafts awaiting approval')} value={overview?.counts.pendingDrafts ?? 0} icon={Bot} />
                  <Metric label={l('Failed deliveries')} value={overview?.counts.failed ?? 0} icon={AlertTriangle} warning={Boolean(overview?.counts.failed)} />
                </div>

                <nav className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2" aria-label={l('Social Hub sections')}>
                  {([['inbox', Inbox, 'Unified inbox'], ['channels', Settings2, 'Channels'], ['automation', Bot, 'AI and automations']] as const).map(([id, Icon, label]) => (
                    <button key={id} type="button" onClick={() => setPanel(id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${panel === id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" />{l(label)}</button>
                  ))}
                </nav>

                {panel === 'channels' && <ChannelsPanel overview={overview} l={l} />}
                {panel === 'automation' && <AutomationPanel hubId={hubId} canManage={canManage} l={l} />}
                {panel === 'inbox' && <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b14] lg:grid-cols-[340px_minmax(0,1fr)_280px]">
                  <aside className="border-b border-white/10 lg:border-b-0 lg:border-r">
                    <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-3">
                      <select value={status} onChange={event => setStatus(event.target.value as ConversationStatus | 'all')} className="rounded-lg border border-white/10 bg-[#151522] px-2 py-2 text-xs text-white">
                        <option value="all">{l('All statuses')}</option><option value="open">{l('Open')}</option><option value="pending">{l('Pending')}</option><option value="resolved">{l('Resolved')}</option><option value="spam">{l('Spam')}</option>
                      </select>
                      <select value={provider} onChange={event => setProvider(event.target.value as SocialProvider | 'all')} className="rounded-lg border border-white/10 bg-[#151522] px-2 py-2 text-xs text-white">
                        <option value="all">{l('All channels')}</option>{SOCIAL_PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </div>
                    <div className="max-h-[560px] overflow-y-auto">
                      {!conversations.length && <p className="p-6 text-center text-sm text-gray-500">{l('No conversations match these filters.')}</p>}
                      {conversations.map(item => <button key={item.id} type="button" onClick={() => void openConversation(item.id)} className={`w-full border-b border-white/5 p-4 text-left hover:bg-white/[0.04] ${selectedId === item.id ? 'bg-violet-500/10' : ''}`}>
                        <div className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-white">{item.contact.displayName || l('Unknown contact')}</strong>{item.unreadCount > 0 && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">{item.unreadCount}</span>}</div>
                        <div className="mt-1 text-[11px] text-violet-300">{providerLabel(item.provider)} · {item.priority}</div>
                        <p className="mt-2 line-clamp-2 text-xs text-gray-400">{item.lastMessage?.body ?? l('No messages yet')}</p>
                      </button>)}
                    </div>
                  </aside>

                  <main className="flex min-w-0 flex-col border-b border-white/10 lg:border-b-0 lg:border-r">
                    {!thread ? <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-500">{l('Select a conversation to read and reply.')}</div> : <>
                      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-4">
                        <div><strong className="text-white">{thread.contact.displayName || l('Unknown contact')}</strong><div className="text-xs text-gray-500">{providerLabel(thread.conversation.provider)} · {thread.conversation.connectionName}</div></div>
                        <div className="flex gap-2">
                          <select disabled={!canEdit || busy} value={thread.conversation.priority} onChange={event => void changeConversation(thread.conversation.status, event.target.value as ConversationPriority)} className="rounded-lg border border-white/10 bg-[#151522] px-2 py-1.5 text-xs text-white"><option value="low">{l('Low')}</option><option value="normal">{l('Normal')}</option><option value="high">{l('High')}</option><option value="urgent">{l('Urgent')}</option></select>
                          <select disabled={!canEdit || busy} value={thread.conversation.status} onChange={event => void changeConversation(event.target.value as ConversationStatus, thread.conversation.priority)} className="rounded-lg border border-white/10 bg-[#151522] px-2 py-1.5 text-xs text-white"><option value="open">{l('Open')}</option><option value="pending">{l('Pending')}</option><option value="resolved">{l('Resolved')}</option><option value="spam">{l('Spam')}</option></select>
                        </div>
                      </header>
                      <div className="flex-1 space-y-3 overflow-y-auto p-4">
                        {thread.messages.map(message => <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-3 py-2 ${message.direction === 'outbound' ? 'bg-violet-600 text-white' : 'bg-white/10 text-gray-100'}`}><p className="whitespace-pre-wrap break-words text-sm">{message.body}</p><div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70"><Clock3 className="h-3 w-3" />{new Date(message.createdAt).toLocaleString()} · {message.deliveryStatus}</div></div></div>)}
                      </div>
                      <div className="border-t border-white/10 p-3">
                        <textarea value={reply} onChange={event => setReply(event.target.value)} readOnly={Boolean(aiDraft)} disabled={!canEdit || busy} maxLength={4000} rows={3} placeholder={canEdit ? l('Write a reply…') : l('Viewers cannot send replies.')} className="w-full resize-none rounded-xl border border-white/10 bg-[#151522] px-3 py-2 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50" />
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] text-gray-600">{reply.length}/4000</span><div className="flex flex-wrap gap-2">{aiDraft ? <><button type="button" onClick={() => void discardAiDraft(true)} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-300">{l('Edit manually')}</button><button type="button" onClick={() => void discardAiDraft(false)} disabled={busy} className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300">{l('Reject draft')}</button></> : <button type="button" onClick={() => void draftReply()} disabled={!canEdit || busy || !thread.messages.length} className="inline-flex items-center gap-2 rounded-xl border border-violet-500/30 px-3 py-2 text-xs font-semibold text-violet-200 disabled:opacity-50"><Bot className="h-4 w-4" />{l('Draft with AI')}</button>}<button type="button" onClick={() => void sendReply()} disabled={!canEdit || !reply.trim() || busy} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"><Send className="h-4 w-4" />{aiDraft ? l('Approve and send') : l('Send')}</button></div></div>
                      </div>
                    </>}
                  </main>

                  <aside className="p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><UserRound className="h-4 w-4 text-violet-300" />{l('CRM contact')}</h3>
                    {thread ? <dl className="mt-4 space-y-3 text-xs"><ContactField label={l('Name')} value={thread.contact.displayName} /><ContactField label={l('Lifecycle')} value={thread.contact.lifecycle} /><ContactField label={l('Email')} value={thread.contact.email ?? '—'} /><ContactField label={l('Phone')} value={thread.contact.phone ?? '—'} /><ContactField label={l('Tags')} value={thread.contact.tags.join(', ') || '—'} /><ContactField label={l('Notes')} value={thread.contact.notes || '—'} /></dl> : <p className="mt-4 text-xs text-gray-500">{l('Contact details appear with the selected conversation.')}</p>}
                  </aside>
                </div>}
              </>}
      </div>
    </ToolShell>
  );
}

function Metric({ label, value, icon: Icon, warning = false }: { label: string; value: number; icon: typeof Inbox; warning?: boolean }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between"><span className="text-xs text-gray-500">{label}</span><Icon className={`h-4 w-4 ${warning ? 'text-red-400' : 'text-violet-300'}`} /></div><strong className="mt-2 block text-2xl text-white">{value}</strong></div>;
}

function Empty({ icon: Icon, title, text, action }: { icon: typeof Inbox; title: string; text: string; action?: ReactNode }) {
  return <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center"><Icon className="h-10 w-10 text-violet-300" /><h2 className="mt-4 text-lg font-bold text-white">{title}</h2><p className="mt-2 max-w-xl text-sm text-gray-400">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function ContactField({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-semibold text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-gray-200">{value}</dd></div>;
}

function ChannelsPanel({ overview, l }: { overview: SocialHubOverview | null; l: (value: string) => string }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{SOCIAL_PROVIDERS.map(provider => {
    const connection = overview?.connections.find(item => item.provider === provider.id);
    return <article key={provider.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-white">{provider.label}</h3><p className="mt-1 text-xs text-gray-500">{connection?.displayName ?? l('Not connected')}</p></div>{connection?.status === 'connected' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-gray-600" />}</div><div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-gray-400">{connection ? l(`Status: ${connection.status}`) : l('Account and credential linking is reserved for the final activation step.')}</div><button type="button" disabled className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-gray-500">{connection ? l('Manage in final activation') : l('Connect in final activation')}</button></article>;
  })}</div>;
}

function AutomationPanel({ hubId, canManage, l }: { hubId: string; canManage: boolean; l: (value: string) => string }) {
  const [rules, setRules] = useState<SocialAutomation[]>([]), [name, setName] = useState(''), [keyword, setKeyword] = useState(''), [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = useCallback(async () => { try { setRules(await listSocialAutomations(hubId)); } catch (caught) { setError(messageOf(caught)); } }, [hubId]);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    if (!canManage || !name.trim() || !keyword.trim() || !reply.trim()) return;
    setBusy(true); setError('');
    try { await saveSocialAutomation(hubId, { name: name.trim(), keyword: keyword.trim(), reply: reply.trim(), enabled: false }); setName(''); setKeyword(''); setReply(''); await load(); }
    catch (caught) { setError(messageOf(caught)); } finally { setBusy(false); }
  }
  async function toggle(rule: SocialAutomation) {
    setBusy(true); setError('');
    try { await saveSocialAutomation(hubId, { id: rule.id, name: rule.name, enabled: !rule.enabled, keyword: String(rule.conditions.keyword || ''), reply: String(rule.actionConfig.text || '') }); await load(); }
    catch (caught) { setError(messageOf(caught)); } finally { setBusy(false); }
  }
  return <div className="space-y-4"><div className="grid gap-3 lg:grid-cols-3"><InfoCard icon={Bot} title={l('AI reply approval')} text={l('AI replies remain drafts until an authorized teammate approves them. Automatic unreviewed sending is blocked.')} /><InfoCard icon={ShieldCheck} title={l('Safe automations')} text={l('Assignment, tags and reply templates are isolated per workspace and recorded in the audit log.')} /><InfoCard icon={AlertTriangle} title={l('Failure handling')} text={l('Outbound delivery uses idempotent jobs, bounded retries and a dead-letter state for operator review.')} /></div>{error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}<section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><h3 className="font-bold text-white">{l('Keyword reply automations')}</h3><div className="mt-3 space-y-2">{rules.map(rule => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><strong className="text-sm text-white">{rule.name}</strong><p className="text-xs text-gray-500">{l('Keyword')}: {String(rule.conditions.keyword || '')} · {rule.enabled ? l('Enabled') : l('Disabled')}</p></div><button type="button" onClick={() => void toggle(rule)} disabled={!canManage || busy} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 disabled:opacity-50">{rule.enabled ? l('Disable') : l('Enable')}</button></div>)}{!rules.length && <p className="text-sm text-gray-500">{l('No automation rules yet.')}</p>}</div>{canManage && <div className="mt-4 grid gap-2 lg:grid-cols-3"><input value={name} onChange={event => setName(event.target.value)} maxLength={160} placeholder={l('Rule name')} className="rounded-xl border border-white/10 bg-[#151522] px-3 py-2 text-sm text-white" /><input value={keyword} onChange={event => setKeyword(event.target.value)} maxLength={100} placeholder={l('Keyword')} className="rounded-xl border border-white/10 bg-[#151522] px-3 py-2 text-sm text-white" /><input value={reply} onChange={event => setReply(event.target.value)} maxLength={4000} placeholder={l('Reply template')} className="rounded-xl border border-white/10 bg-[#151522] px-3 py-2 text-sm text-white" /><button type="button" onClick={() => void save()} disabled={busy || !name.trim() || !keyword.trim() || !reply.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 lg:col-start-3">{l('Save disabled rule')}</button></div>}</section></div>;
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof Inbox; title: string; text: string }) {
  return <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Icon className="h-6 w-6 text-violet-300" /><h3 className="mt-3 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-400">{text}</p></article>;
}
