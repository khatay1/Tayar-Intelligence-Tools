import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SocialConnectPanel from './SocialConnectPanel';
import SocialAssistantPanel from './SocialAssistantPanel';
import SocialAutomationPanel from './SocialAutomationPanel';
import { useAdmin } from '@/context/AdminContext';
import { useAuth } from '@/context/AuthContext';
import { socialHubClient as client, type SocialInbox, type SocialScope, type SocialProject } from './client';
import { useLocalizer } from '@/lib/ui-localization';

export default function SocialHubTool({ darkMode }: { darkMode: boolean }) {
  const l = useLocalizer();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [scopes, setScopes] = useState<SocialScope[]>([]);
  const [scopeId, setScopeId] = useState('');
  const [projects,setProjects]=useState<SocialProject[]>([]);
  const [projectId,setProjectId]=useState('');
  const [projectsIdentity,setProjectsIdentity]=useState('');
  const [inboxIdentity,setInboxIdentity] = useState('');
  const [scopesIdentity,setScopesIdentity] = useState('');
  const [inbox, setInbox] = useState<SocialInbox | null>(null);
  const [conversationId, setConversationId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [followupTitle, setFollowupTitle] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const activeIdentity = useRef('');
  activeIdentity.current = `${user?.id ?? ''}:${scopeId}`;
  const sendAttempt = useRef<{ text: string; conversation: string; key: string } | null>(null);
  const userId = user?.id;
  const refresh = useCallback(async () => {
    if (!scopeId || !userId) return;
    const revision = ++generation.current;
    try {
      const result = await client.inbox(scopeId);
      if (revision === generation.current) { setInbox(result); setInboxIdentity(`${userId}:${scopeId}`); }
    } catch { if (revision === generation.current) setNotice(l('Inbox unavailable. Access or activation is required.')); }
  }, [l, scopeId, userId]);
  useEffect(() => {
    let current = true;
    setScopes([]); setScopeId(''); setInbox(null); setConversationId(''); setDraft(''); setNote(''); setFollowupTitle(''); setNotice('');
    setProjects([]);setProjectId('');setProjectsIdentity('');
    if(userId)void client.projects(userId).then(rows=>{if(current){setProjects(rows);setProjectsIdentity(userId);}})
      .catch(()=>{if(current)setNotice(l('Project list unavailable.'));});
    if (userId) void client.scopes().then(rows => { if (current) {setScopes(rows);setScopesIdentity(userId);} })
      .catch(() => { if (current) setNotice(l('Social Hub requires an approved deployment and access.')); });
    const revisionRef = generation;
    return () => { current = false; revisionRef.current++; };
  }, [l, userId]);
  useEffect(() => {
    setInbox(null); setConversationId(''); setDraft(''); setNote(''); setFollowupTitle(''); sendAttempt.current = null;
    void refresh();
    // Bounded polling is read-only; visibility avoids background message reads.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    const revisionRef = generation;
    return () => { revisionRef.current++; window.clearInterval(timer); };
  }, [refresh]);
  const currentInbox = inboxIdentity === `${userId}:${scopeId}` ? inbox : null;
  const currentScopes = scopesIdentity === userId ? scopes : [];
  const currentProjects=projectsIdentity===userId?projects:[];
  const visible = useMemo(() => (currentInbox?.conversations ?? []).filter(item =>
    (status === 'all' || item.status === status) && `${item.external_id} ${currentInbox?.messages.filter(m => m.conversation_id === item.id).map(m => m.text).join(' ')}`
      .toLocaleLowerCase().includes(query.toLocaleLowerCase())), [currentInbox, query, status]);
  const selected = currentInbox?.conversations.find(item => item.id === conversationId);
  const assistantMessage = currentInbox?.messages.find(message => message.conversation_id === selected?.id && message.direction === 'inbound');
  async function mutate(operation: () => Promise<unknown>, success: string) {
    const identity = activeIdentity.current;
    if (busy) return;
    setBusy(true); setNotice('');
    try { await operation(); if (activeIdentity.current === identity) { setNotice(success); await refresh(); } }
    catch { if (activeIdentity.current === identity) setNotice(l('Operation unavailable. Check access and connection readiness.')); }
    finally { setBusy(false); }
  }
  function enqueue() {
    const text = draft.trim();
    if (!selected || !text) return;
    // Keep the key after uncertain responses; retries cannot enqueue duplicates.
    if (sendAttempt.current?.text !== text || sendAttempt.current.conversation !== selected.id)
      sendAttempt.current = { text, conversation: selected.id, key: crypto.randomUUID() };
    const attempt = sendAttempt.current;
    void mutate(async () => { await client.enqueue(selected.id, text, attempt.key); sendAttempt.current=null; setDraft(''); },
      l('Reply queued. Provider acceptance and delivery are separate states.'));
  }
  return <section className={`p-5 space-y-4 ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>
    <h1 className="text-xl font-semibold">{l('Social Media Hub')}</h1>
    <p>{l('Private beta. Channels require approved Connect deployment, account verification and real channel tests.')}</p>
    <div className="flex flex-wrap gap-3">
      <label>{l('Account scope')} <select aria-label={l('Account scope')} disabled={busy} className="text-slate-900" value={scopeId} onChange={e => setScopeId(e.target.value)}>
        <option value="">{l('Select account scope')}</option>{currentScopes.map(scope => <option key={scope.id} value={scope.id}>{scope.kind} · {scope.id.slice(0, 8)} · {l(scope.enabled ? 'enabled' : 'disabled')}</option>)}
      </select></label>
      <button disabled={busy || !userId} onClick={() => void mutate(async () => {
        await client.createScope('customer'); setScopes(await client.scopes());
      }, l('Private customer scope created; activation remains disabled.'))}>{l('Create private inbox')}</button>
      <label>{l('Owned website project')} <select aria-label={l('Owned website project')} className="text-slate-900" disabled={busy} value={projectId} onChange={e=>setProjectId(e.target.value)}>
        <option value="">{l('Select project')}</option>{currentProjects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}
      </select></label>
      <button disabled={busy||!userId||!currentProjects.some(project=>project.id===projectId)} onClick={()=>{
        const project=currentProjects.find(item=>item.id===projectId);if(!project)return;
        const identity=activeIdentity.current;
        void mutate(async()=>{const id=await client.createScope('customer',project);const rows=await client.scopes();
          if(activeIdentity.current===identity){setScopes(rows);setScopesIdentity(userId??'');setScopeId(id);}},l('Project inbox created; activation remains disabled.'));
      }}>{l('Create project inbox')}</button>
      {isAdmin && <button disabled={busy} onClick={() => void mutate(async () => {
        await client.createScope('official'); setScopes(await client.scopes());
      }, l('Official inbox created; activation remains disabled.'))}>{l('Create Tayar official inbox')}</button>}
      <button disabled={!scopeId} onClick={() => void refresh()}>{l('Refresh')}</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {currentInbox && <>
      <SocialConnectPanel key={currentInbox.scope.id} scope={currentInbox.scope} connections={currentInbox.connections} onChange={refresh}/>
      <SocialAutomationPanel key={`${userId}:${currentInbox.scope.id}`} scope={currentInbox.scope} onChange={refresh}/>
      <SocialAssistantPanel key={`${userId}:${currentInbox.scope.id}:${selected?.id ?? ''}:${assistantMessage?.id ?? ''}`}
        scopeId={currentInbox.scope.id} conversationId={selected?.id}
        messageId={assistantMessage?.id}
        onReply={setDraft}/>
      <div className="flex flex-wrap gap-3">{currentInbox.connections.map(connection => <span key={connection.id}>{connection.channel} · {connection.external_account_id} · {connection.status}</span>)}</div>
      {!currentInbox.scope.enabled && <p>{l('Inbox activation is disabled.')}</p>}
      <label>{l('Search')} <input className="text-slate-900" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>{l('Status')} <select className="text-slate-900" value={status} onChange={e => setStatus(e.target.value)}>{['all','open','pending','resolved','human_required','archived'].map(value => <option key={value}>{l(value)}</option>)}</select></label>
      <div className="grid gap-4 md:grid-cols-2">
        <nav aria-label="Conversations" className="space-y-2">{visible.map(item => <button key={item.id} className="block rounded border p-3 text-start w-full" aria-pressed={item.id === conversationId} onClick={() => { setConversationId(item.id); setDraft(''); setNote(''); setFollowupTitle(''); }}>
          {currentInbox.connections.find(c => c.id === item.connection_id)?.channel} · {item.external_id} · {item.status}
        </button>)}{!visible.length && <p>{l('No conversations.')}</p>}</nav>
        {selected && <div className="space-y-3">
          <div role="log" aria-label="Conversation messages">{currentInbox.messages.filter(m => m.conversation_id === selected.id).map(m => <p key={m.id} className="border-b p-2">{m.direction}: {m.text}</p>)}</div>
          {(currentInbox.outbox ?? []).filter(job => job.conversation_id === selected.id).map(job => <p key={job.id}>Outgoing ({job.status}): {job.text}</p>)}
          <label>{l('Reply')}<textarea className="block w-full text-slate-900" maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} /></label>
          <button disabled={busy || !draft.trim() || !currentInbox.scope.enabled} onClick={enqueue}>{l('Queue reply')}</button>
          <label>{l('Internal note')}<textarea className="block w-full text-slate-900" maxLength={4000} value={note} onChange={e => setNote(e.target.value)} /></label>
          <button disabled={busy || !note.trim()} onClick={() => void mutate(async () => { await client.update(selected.id, {note}); setNote(''); }, l('Internal note saved.'))}>{l('Save note')}</button>
          {currentInbox.notes.filter(n => n.conversation_id === selected.id).map(n => <p key={n.id}>{l('Internal')}: {n.text}</p>)}
          <label>{l('Conversation status')} <select className="text-slate-900" disabled={busy} value={selected.status} onChange={e => void mutate(() => client.update(selected.id, { status:e.target.value }), l('Status saved.'))}>
            {['open','pending','resolved','human_required','archived'].map(value => <option key={value}>{l(value)}</option>)}
          </select></label>
          <button disabled={busy} onClick={() => void mutate(() => client.update(selected.id,{assignedTo:userId}), l('Assigned to you.'))}>{l('Assign to me')}</button>
          <button disabled={busy} onClick={() => void mutate(() => client.update(selected.id,{assignedTo:null}), l('Assignment cleared.'))}>{l('Unassign')}</button>
          {currentInbox.crmLeads && <label>{l('CRM lead')} <select aria-label={l('CRM lead')} className="text-slate-900" disabled={busy} value={selected.crm_lead_id ?? ''}
            onChange={e => void mutate(() => client.linkCrmLead(selected.id,e.target.value||null),l('CRM link saved.'))}>
            <option value="">{l('No CRM link')}</option>{currentInbox.crmLeads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.email} · {lead.stage}</option>)}
          </select></label>}
          <div className="space-y-2">
            <h2 className="font-medium">{l('Follow-ups')}</h2>
            <label>{l('Follow-up title')}<input className="block w-full text-slate-900" maxLength={200} value={followupTitle} onChange={e=>setFollowupTitle(e.target.value)}/></label>
            <button disabled={busy||!followupTitle.trim()} onClick={()=>void mutate(async()=>{await client.createFollowup(selected.id,followupTitle.trim());setFollowupTitle('');},l('Follow-up created.'))}>{l('Create follow-up')}</button>
            {currentInbox.followups.filter(item=>item.conversation_id===selected.id).map(item=><div key={item.id} className="rounded border p-2">
              <span>{item.title} · {l(item.status)}</span>
              {item.status==='open'&&<button className="ms-2" disabled={busy} onClick={()=>void mutate(()=>client.updateFollowup(item.id,{status:'done'}),l('Follow-up completed.'))}>{l('Mark done')}</button>}
            </div>)}
          </div>
        </div>}
      </div>
    </>}
  </section>;
}
