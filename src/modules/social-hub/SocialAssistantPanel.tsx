import { useEffect, useRef, useState } from 'react';
import { useLocalizer } from '@/lib/ui-localization';
import { socialAssistantClient as client, type AssistantSettings, type AssistantConfiguration, type KnowledgeAnswer } from './assistant-client';

const emptyAnswer = { id: null as string | null, question: '', answer: '', language: 'en', approved: false, sensitive: false };
export default function SocialAssistantPanel({ scopeId, conversationId, messageId, onReply }: {
  scopeId: string; conversationId?: string; messageId?: string; onReply: (text: string) => void;
}) {
  const l = useLocalizer();
  const alive = useRef(true);
  const [configuration, setConfiguration] = useState<AssistantConfiguration | null>(null);
  const [settings, setSettings] = useState<AssistantSettings>({ enabled: false, external_approved: false, language: 'en', daily_limit: 0 });
  const [answer, setAnswer] = useState(emptyAnswer);
  const [redactedText, setRedactedText] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    alive.current = true;
    void client.configuration(scopeId).then(data => { if (alive.current) { setConfiguration(data); if (data?.settings) setSettings(data.settings); } }).catch(() => undefined);
    return () => { alive.current = false; };
  }, [scopeId]);
  async function run(operation: () => Promise<void>) {
    if (busy) return; setBusy(true); setNotice(''); setSuggestion(null);
    try { await operation(); } catch { if (alive.current) setNotice(l('Assistant unavailable. Check access and activation.')); }
    finally { if (alive.current) setBusy(false); }
  }
  async function reload() { const data = await client.configuration(scopeId); if (alive.current) setConfiguration(data); }
  function selectAnswer(value: string) {
    const item: KnowledgeAnswer | undefined = configuration?.knowledge.find(row => row.id === value);
    setAnswer(item ? { ...item } : emptyAnswer);
  }
  return <details className="rounded border p-3 space-y-3"><summary>{l('Social Assistant')}</summary>
    <p>{l('Suggestions use approved business answers. Review every reply before sending.')}</p>
    {messageId && conversationId && <>
      <button disabled={busy} onClick={() => void run(async () => {
        const result = await client.suggest(scopeId, conversationId, messageId);
        if (alive.current) { setSuggestion(result); if (!result) setNotice(l('No confirmed answer. A human should follow up.')); }
      })}>{l('Suggest reply')}</button>
      {suggestion && <div><p>{suggestion}</p><button onClick={() => onReply(suggestion)}>{l('Use suggestion in draft')}</button></div>}
    </>}
    {configuration && <details><summary>{l('Assistant settings and knowledge')}</summary>
      <label><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })}/>{l('Enable assistant suggestions')}</label>
      <label>{l('Language')}<select value={settings.language} onChange={e => setSettings({ ...settings, language: e.target.value })}>{['en','ar','sv'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={settings.external_approved} onChange={e => setSettings({ ...settings, external_approved: e.target.checked })}/>{l('Allow reviewed redacted questions through managed AI providers')}</label>
      <p>{l('External AI requires a separate reviewed text for each message. Never include medical data or personal identifiers.')}</p>
      <label>{l('Daily classification limit')}<input type="number" min={0} max={1000} value={settings.daily_limit} onChange={e => setSettings({ ...settings, daily_limit: Number(e.target.value) })}/></label>
      <button disabled={busy} onClick={() => void run(async () => { await client.configure(scopeId, settings); await reload(); })}>{l('Save assistant settings')}</button>
      <label>{l('Approved business answers')}<select value={answer.id ?? ''} onChange={e => selectAnswer(e.target.value)}><option value="">{l('New answer')}</option>{configuration.knowledge.map(item => <option key={item.id} value={item.id}>{item.question}</option>)}</select></label>
      <label>{l('Question')}<input maxLength={400} value={answer.question} onChange={e => setAnswer({ ...answer, question: e.target.value })}/></label>
      <label>{l('Answer')}<textarea maxLength={4000} value={answer.answer} onChange={e => setAnswer({ ...answer, answer: e.target.value })}/></label>
      <label>{l('Language')}<select value={answer.language} onChange={e => setAnswer({ ...answer, language: e.target.value })}>{['en','ar','sv'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label><input type="checkbox" checked={answer.approved} onChange={e => setAnswer({ ...answer, approved: e.target.checked })}/>{l('Approved for suggestions')}</label>
      <label><input type="checkbox" checked={answer.sensitive} onChange={e => setAnswer({ ...answer, sensitive: e.target.checked })}/>{l('Sensitive content')}</label>
      <button disabled={busy || !answer.question.trim() || !answer.answer.trim()} onClick={() => void run(async () => { await client.saveAnswer(scopeId, answer); await reload(); if (alive.current) setAnswer(emptyAnswer); })}>{l('Save answer')}</button>
      {messageId && settings.external_approved && <>
        <label>{l('Reviewed redacted question')}<textarea maxLength={1000} value={redactedText} onChange={e => setRedactedText(e.target.value)}/></label>
        <button disabled={busy || !redactedText.trim()} onClick={() => void run(async () => { await client.review(scopeId, messageId, redactedText, settings.language); if (alive.current) setRedactedText(''); })}>{l('Approve reviewed question')}</button>
      </>}
    </details>}
    {notice && <p role="status">{notice}</p>}
  </details>;
}
